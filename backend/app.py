"""Application entry point. Routes, storage, and agent capabilities live in separate modules."""

import os
import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from backend.core import config
from database.store import ExcelStore
from backend.api import agents, analysis, auth, conversations
from backend.services.migration import migrate_legacy
from backend.services.workspaces import migrate_workspaces
from database.migration import prepare_workbook
from backend.services.frontend import frontend_version, workspace_script


@asynccontextmanager
async def lifespan(application):
    legacy = config.project_path(os.getenv("DEEPAGENT_DB") or "deepagent.db")
    if os.getenv("IMPORT_LEGACY_SQLITE", "true").lower() == "true":
        migrate_legacy(application.state.store, legacy)
    migrate_workspaces(application.state.store)
    with application.state.store.transaction():
        pass
    yield


def create_app(store=None):
    application = FastAPI(title="DeepAgent Foundry", lifespan=lifespan)
    if store is None:
        prepare_workbook(config.ROOT, config.WORKBOOK)
    application.state.store = store or ExcelStore(config.WORKBOOK)
    application.add_middleware(
        SessionMiddleware,
        secret_key=config.SESSION_SECRET or secrets.token_urlsafe(48),
        same_site="lax",
        https_only=config.COOKIE_SECURE,
        max_age=60 * 60 * 24 * 7,
    )

    @application.middleware("http")
    async def origin_check(request: Request, call_next):
        origin = request.headers.get("origin")
        if (
            request.method in ("POST", "PUT", "PATCH", "DELETE")
            and origin
            and origin.rstrip("/") != str(request.base_url).rstrip("/")
        ):
            return JSONResponse(
                {"detail": "Cross-origin writes are not allowed."}, status_code=403
            )
        return await call_next(request)

    @application.exception_handler(RuntimeError)
    async def storage_error(request, error):
        return JSONResponse({"detail": str(error)}, status_code=503)

    @application.get('/static/workspace.js')
    def workspace_javascript():
        return Response(workspace_script(), media_type='application/javascript', headers={'Cache-Control': 'no-cache'})

    application.mount(
        "/static", StaticFiles(directory=config.ROOT / "frontend/static"), name="static"
    )
    for router in (auth.router, agents.router, analysis.router, conversations.router):
        application.include_router(router)

    @application.get("/")
    def index():
        html = (config.ROOT / 'frontend/static/index.html').read_text(encoding='utf-8')
        return HTMLResponse(html.replace('__ASSET_VERSION__', frontend_version()), headers={'Cache-Control': 'no-store'})

    @application.get("/api/status")
    def status():
        return {
            "provider": "Groq" if os.getenv("GROQ_API_KEY") else "Demo",
            "model": os.getenv("GROQ_MODEL") or "llama-3.3-70b-versatile",
            "storage": "Excel",
            "frontend_version": frontend_version(),
        }

    return application


app = create_app()
