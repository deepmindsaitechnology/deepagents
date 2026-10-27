from contextlib import contextmanager
import uuid
from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from api.dependencies import current_user, store_for, require_agent, now
from api.schemas import AgentInput, AgentType, PromptInput
from services.catalog import catalog
from services.documents import read_upload, extract_text, chunk_document
from services.retrieval import index_chunks
from services.analysis import parse_dataset, make_report
from services.workspaces import (
    ensure_workspace,
    prompt_text,
    safe_path,
    slugify,
    cleanup_new_workspace,
)
from platform_core.config import ROOT

router = APIRouter(prefix="/api", tags=["Agents"])


def serialize(tx, agent):
    result = dict(agent)
    result["instructions"] = prompt_text(agent)
    result["documents"] = tx.all(
        "knowledge_documents", owner_id=agent["owner_id"], agent_id=agent["id"]
    )
    dataset = tx.one("datasets", owner_id=agent["owner_id"], agent_id=agent["id"])
    result["dataset"] = dataset["filename"] if dataset else None
    return result


@router.get("/catalog")
def foundry(user=Depends(current_user)):
    return catalog()


@router.get("/agents")
def list_agents(request: Request, user=Depends(current_user)):
    with store_for(request).transaction() as tx:
        return [
            serialize(tx, row)
            for row in reversed(tx.all("agents", owner_id=user["id"]))
        ]


def insert_agent(tx, user, values):
    agent = tx.insert(
        "agents", {**values, "owner_id": user["id"], "source": "user", "created": now()}
    )
    return tx.update("agents", agent["id"], ensure_workspace(agent))


@contextmanager
def managed_agent(store, user, values):
    agent = None
    try:
        with store.transaction() as tx:
            agent = insert_agent(tx, user, values)
            yield tx, agent
    except Exception:
        if agent:
            cleanup_new_workspace(agent)
        raise


@router.post("/agents", status_code=201)
def create_agent(body: AgentInput, request: Request, user=Depends(current_user)):
    with managed_agent(store_for(request), user, body.model_dump()) as (tx, agent):
        return serialize(tx, agent)


@router.post("/agents/upload", status_code=201)
async def upload_agent(
    request: Request,
    name: Annotated[str, Form(min_length=1, max_length=80)],
    domain: Annotated[str, Form(min_length=1, max_length=80)],
    type: Annotated[AgentType, Form()],
    instructions: Annotated[str, Form(max_length=24000)] = "",
    prompt_file: UploadFile | None = File(None),
    knowledge_files: list[UploadFile] | None = File(None),
    dataset_file: UploadFile | None = File(None),
    user=Depends(current_user),
):
    files = knowledge_files or []
    if len(files) > 5:
        raise HTTPException(400, "Attach at most five knowledge documents.")
    documents, chunks = [], []
    if prompt_file and prompt_file.filename:
        filename, data = await read_upload(prompt_file)
        prompt = "\n".join(text for text, _ in extract_text(filename, data))
        instructions = "\n\n".join(
            part for part in (instructions.strip(), prompt) if part
        )
        if len(instructions) > 24000:
            raise HTTPException(
                413, "Combined system instructions exceed 24,000 characters."
            )
    for file in files:
        filename, data = await read_upload(file)
        segments = extract_text(filename, data)
        parts = chunk_document(filename, segments)
        chunks.extend(parts)
        documents.append((filename, data, segments, len(parts)))
    if len(chunks) > 1000:
        raise HTTPException(413, "Knowledge exceeds 1,000 chunks.")
    dataset = None
    if dataset_file and dataset_file.filename:
        if type != "Analysis":
            raise HTTPException(400, "Dataset attachments require an Analysis agent.")
        filename, data = await read_upload(dataset_file)
        tables = parse_dataset(filename, data)
        make_report(filename, tables)
        dataset = (filename, data, tables)
    with managed_agent(
        store_for(request),
        user,
        {
            "name": name.strip(),
            "domain": domain,
            "type": type,
            "instructions": instructions,
        },
    ) as (tx, agent):
        folder = safe_path(agent["knowledge_path"], "knowledge_base/user_agents")
        for filename, data, segments, count in documents:
            token = uuid.uuid4().hex[:12]
            stored = (
                folder
                / "documents"
                / (
                    token
                    + "_"
                    + slugify(Path(filename).stem)
                    + Path(filename).suffix.lower()
                )
            )
            text_path = folder / "extracted" / (token + ".txt")
            stored.write_bytes(data)
            text_path.write_text(
                "\n\n".join(text for text, _ in segments), encoding="utf-8"
            )
            tx.insert(
                "knowledge_documents",
                {
                    "owner_id": user["id"],
                    "agent_id": agent["id"],
                    "filename": filename,
                    "chunks": count,
                    "file_path": stored.relative_to(ROOT).as_posix(),
                    "text_path": text_path.relative_to(ROOT).as_posix(),
                    "created": now(),
                },
            )
        if chunks:
            index_chunks(tx, user["id"], agent["id"], chunks)
        if dataset:
            filename, data, tables = dataset
            stored = (
                folder
                / "datasets"
                / (uuid.uuid4().hex[:12] + Path(filename).suffix.lower())
            )
            stored.write_bytes(data)
            tx.insert(
                "datasets",
                {
                    "owner_id": user["id"],
                    "agent_id": agent["id"],
                    "filename": filename,
                    "tables": tables,
                    "file_path": stored.relative_to(ROOT).as_posix(),
                },
            )
        return serialize(tx, agent)


@router.put("/agents/{agent_id}/prompt")
def edit_prompt(
    agent_id: int, body: PromptInput, request: Request, user=Depends(current_user)
):
    path, old = None, None
    try:
        with store_for(request).transaction() as tx:
            agent = require_agent(tx, user["id"], agent_id)
            path = safe_path(agent["prompt_path"], "user_prompts")
            old = path.read_text(encoding="utf-8") if path.exists() else ""
            path.write_text(body.instructions, encoding="utf-8")
            tx.update("agents", agent_id, {"instructions": body.instructions})
    except Exception:
        if path is not None and old is not None:
            path.write_text(old, encoding="utf-8")
        raise
    return {"ok": True}


@router.get("/agents/{agent_id}/knowledge")
def knowledge(agent_id: int, request: Request, user=Depends(current_user)):
    with store_for(request).transaction() as tx:
        agent = require_agent(tx, user["id"], agent_id)
        return {
            "method": "Local TF-IDF embeddings + Excel cosine vector search",
            "folder": agent["knowledge_path"],
            "documents": tx.all(
                "knowledge_documents", owner_id=user["id"], agent_id=agent_id
            ),
        }


@router.get("/agents/{agent_id}/documents/{document_id}")
def download_document(
    agent_id: int, document_id: int, request: Request, user=Depends(current_user)
):
    with store_for(request).transaction() as tx:
        require_agent(tx, user["id"], agent_id)
        document = tx.one(
            "knowledge_documents",
            id=document_id,
            owner_id=user["id"],
            agent_id=agent_id,
        )
    if not document or not document.get("file_path"):
        raise HTTPException(
            404, "Original file unavailable; extracted knowledge may still be indexed."
        )
    path = safe_path(document["file_path"], "knowledge_base/user_agents")
    if not path.is_file():
        raise HTTPException(404, "Original document not found.")
    return FileResponse(path, filename=document["filename"])
