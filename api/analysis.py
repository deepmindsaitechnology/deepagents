import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from api.dependencies import current_user, store_for, require_agent, now, record
from api.schemas import CSVInput
from foundry_agents.analysis_agent import AnalysisAgent
from foundry_agents.registry import handler_for
from services.analysis import parse_dataset, report_workbook
from services.documents import read_upload
from services.workspaces import safe_path
from platform_core.config import ROOT

router = APIRouter(prefix="/api", tags=["Analysis and storage"])


def persist_report(tx, user, filename, tables, agent=None):
    handler = handler_for(agent) if agent else AnalysisAgent()
    report = handler.run(filename, tables)
    report["created"] = now()
    row = tx.insert(
        "reports",
        {
            "owner_id": user["id"],
            "agent_id": agent["id"] if agent else None,
            "body": report,
        },
    )
    return {**report, "report_id": row["id"]}


@router.post("/agents/{agent_id}/analyze")
def analyze_saved(agent_id: int, request: Request, user=Depends(current_user)):
    with store_for(request).transaction() as tx:
        agent = require_agent(tx, user["id"], agent_id)
        if agent["type"] != "Analysis":
            raise HTTPException(400, "Choose an Analysis agent.")
        dataset = tx.one("datasets", owner_id=user["id"], agent_id=agent_id)
        if not dataset:
            raise HTTPException(404, "No dataset attached. Upload CSV or XLSX first.")
        report = persist_report(tx, user, dataset["filename"], dataset["tables"], agent)
    record(store_for(request), user["id"], agent["name"], "Calculated", agent_id)
    return report


@router.post("/analyze/upload")
async def analyze_upload(
    request: Request,
    file: UploadFile = File(...),
    agent_id: int | None = Form(None),
    user=Depends(current_user),
):
    filename, data = await read_upload(file)
    tables = parse_dataset(filename, data)
    with store_for(request).transaction() as tx:
        agent = (
            require_agent(tx, user["id"], agent_id) if agent_id is not None else None
        )
        if agent and agent["type"] != "Analysis":
            raise HTTPException(400, "Choose an Analysis agent.")
        report = persist_report(tx, user, filename, tables, agent)
        if agent:
            folder = (
                safe_path(agent["knowledge_path"], "knowledge_base/user_agents")
                / "datasets"
            )
            folder.mkdir(parents=True, exist_ok=True)
            path = folder / (uuid.uuid4().hex[:12] + Path(filename).suffix.lower())
            path.write_bytes(data)
            values = {
                "owner_id": user["id"],
                "agent_id": agent_id,
                "filename": filename,
                "tables": tables,
                "file_path": path.relative_to(ROOT).as_posix(),
            }
            existing = tx.one("datasets", owner_id=user["id"], agent_id=agent_id)
            tx.update("datasets", existing["id"], values) if existing else tx.insert(
                "datasets", values
            )
    record(
        store_for(request),
        user["id"],
        agent["name"] if agent else "Spreadsheet Analysis",
        "Calculated",
        agent_id,
    )
    return report


@router.post("/analyze")
def analyze_sample(body: CSVInput, request: Request, user=Depends(current_user)):
    tables = parse_dataset("sample.csv", body.content.encode())
    with store_for(request).transaction() as tx:
        report = persist_report(tx, user, "sample.csv", tables)
    record(store_for(request), user["id"], "CSV Analysis", "Calculated")
    return report


@router.get("/reports")
def reports(request: Request, user=Depends(current_user)):
    with store_for(request).transaction() as tx:
        return [
            {
                "id": row["id"],
                "agent_id": row["agent_id"],
                "filename": row["body"]["filename"],
                "created": row["body"]["created"],
            }
            for row in reversed(tx.all("reports", owner_id=user["id"]))
        ][:100]


@router.get("/reports/{report_id}/download")
def download_report(
    report_id: int, request: Request, format: str = "xlsx", user=Depends(current_user)
):
    import json

    with store_for(request).transaction() as tx:
        row = tx.one("reports", id=report_id, owner_id=user["id"])
    if not row:
        raise HTTPException(404, "Report not found.")
    if format == "json":
        return Response(
            json.dumps(row["body"], ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="analysis-{report_id}.json"'
            },
        )
    if format != "xlsx":
        raise HTTPException(400, "Choose xlsx or json.")
    return Response(
        report_workbook(row["body"]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="analysis-{report_id}.xlsx"'
        },
    )


@router.get("/storage")
def storage_info(request: Request, user=Depends(current_user)):
    from platform_core.store import SCHEMA

    with store_for(request).transaction() as tx:
        counts = {
            table: len(
                tx.all(table, id=user["id"])
                if table == "users"
                else tx.all(table, owner_id=user["id"])
            )
            for table in SCHEMA
            if table != "migrations"
        }
    return {
        "backend": "Excel workbook",
        "tables": counts,
        "export_url": "/api/storage/export",
    }


@router.get("/storage/export")
def export_tables(request: Request, user=Depends(current_user)):
    return Response(
        store_for(request).export(user["id"]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="my-workspace.xlsx"'},
    )
