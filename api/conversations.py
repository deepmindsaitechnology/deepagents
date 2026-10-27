from fastapi import APIRouter, Depends, HTTPException, Request
from api.dependencies import current_user, store_for, require_agent, record
from api.schemas import ChatInput
from services.catalog import get_template
from services.retrieval import retrieve
from services.workspaces import prompt_text
from platform_core.config import ROOT
from foundry_agents.registry import handler_for

router = APIRouter(prefix="/api", tags=["Conversations"])


@router.post("/chat")
async def chat(body: ChatInput, request: Request, user=Depends(current_user)):
    context = body.model_dump()
    context["sources"] = []
    context["indexed"] = False
    if body.agent_id is not None:
        with store_for(request).transaction() as tx:
            agent = require_agent(tx, user["id"], body.agent_id)
            context.update(
                agent=agent["name"],
                domain=agent["domain"],
                instructions=prompt_text(agent),
            )
            context["indexed"] = (
                tx.one("vector_indexes", owner_id=user["id"], agent_id=body.agent_id)
                is not None
            )
            context["sources"] = retrieve(tx, user["id"], body.agent_id, body.message)
    elif body.template_id:
        agent = get_template(body.template_id)
        context.update(
            agent=agent["name"],
            domain=agent["domain"],
            instructions=agent["instructions"],
        )
        sample = ROOT / "knowledge_base/foundry" / body.template_id / "sample_policy.md"
        if sample.exists():
            context["sources"] = [
                {
                    "source": "Fictional sample policy",
                    "location": "sample document",
                    "text": sample.read_text(),
                }
            ]
    else:
        agent = {"type": "Chat"}
    if agent["type"] not in ("Chat", "Document", "Voice"):
        raise HTTPException(400, "Choose a conversational agent for chat.")
    if context["sources"] or context["indexed"]:
        context["knowledge"] = "\n\n".join(
            f"[{i + 1}] {s['source']} ({s['location']}): {s['text']}"
            for i, s in enumerate(context["sources"])
        )
    handler = handler_for(agent)
    result = await handler.run(handler.prepare(context))
    record(
        store_for(request), user["id"], context["agent"], result["mode"], body.agent_id
    )
    return result


@router.get("/runs")
def runs(request: Request, user=Depends(current_user)):
    with store_for(request).transaction() as tx:
        return list(reversed(tx.all("runs", owner_id=user["id"])))[:100]


@router.post("/preview")
def preview(body: ChatInput, request: Request, user=Depends(current_user)):
    if body.agent_id is not None:
        with store_for(request).transaction() as tx:
            agent = require_agent(tx, user["id"], body.agent_id)
    elif body.template_id:
        agent = get_template(body.template_id)
    else:
        raise HTTPException(400, "Choose a workflow or team agent.")
    if agent["type"] not in ("Workflow", "Agent Team"):
        raise HTTPException(400, "Only workflow and team previews are supported.")
    result = handler_for(agent).preview()
    record(store_for(request), user["id"], agent["name"], "Simulation", body.agent_id)
    return result
