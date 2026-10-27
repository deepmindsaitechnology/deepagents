from fastapi import HTTPException, Request
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc).isoformat()


def store_for(request: Request):
    return request.app.state.store


def current_user(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(401, "Sign in to access your workspace.")
    with store_for(request).transaction() as tx:
        user = tx.one("users", id=user_id)
    if not user:
        request.session.clear()
        raise HTTPException(401, "Session expired. Sign in again.")
    return user


def require_agent(tx, owner_id, agent_id):
    agent = tx.one("agents", id=agent_id, owner_id=owner_id)
    if not agent:
        raise HTTPException(404, "Agent not found.")
    return agent


def record(store, owner_id, agent, mode, agent_id=None):
    with store.transaction() as tx:
        tx.insert(
            "runs",
            {
                "owner_id": owner_id,
                "agent_id": agent_id,
                "agent": agent,
                "mode": mode,
                "created": now(),
            },
        )
