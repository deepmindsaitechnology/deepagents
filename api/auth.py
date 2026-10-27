from urllib.parse import urlsplit
import httpx
from authlib.jose.errors import JoseError
from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from platform_core import config
from api.dependencies import current_user, store_for, now

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
oauth = OAuth()
if config.GOOGLE_CONFIGURED:
    oauth.register(
        name="google",
        client_id=config.GOOGLE_CLIENT_ID,
        client_secret=config.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


@router.get("/me")
def me(request: Request):
    user = None
    if request.session.get("user_id"):
        try:
            user = current_user(request)
        except HTTPException:
            pass
    return {
        "user": user,
        "google_configured": config.GOOGLE_CONFIGURED,
        "demo_allowed": not config.GOOGLE_CONFIGURED,
    }


@router.post("/demo")
def demo(request: Request):
    if config.GOOGLE_CONFIGURED:
        raise HTTPException(
            403, "Demo login is disabled when Google sign-in is configured."
        )
    with store_for(request).transaction() as tx:
        if not tx.one("users", id="demo"):
            tx.insert(
                "users",
                {
                    "id": "demo",
                    "email": "demo@local",
                    "name": "Demo user",
                    "picture": "",
                    "created": now(),
                },
            )
        tx.insert(
            "auth_events", {"owner_id": "demo", "event": "demo_login", "created": now()}
        )
    request.session.clear()
    request.session["user_id"] = "demo"
    return {"ok": True}


@router.get("/google")
async def google_login(request: Request):
    if not config.GOOGLE_CONFIGURED:
        raise HTTPException(
            503,
            "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and SESSION_SECRET in .env first.",
        )
    redirect = urlsplit(config.GOOGLE_REDIRECT_URI)
    if request.url.netloc != redirect.netloc or request.url.scheme != redirect.scheme:
        return RedirectResponse(
            f"{redirect.scheme}://{redirect.netloc}/?auth_error=origin"
        )
    return await oauth.google.authorize_redirect(request, config.GOOGLE_REDIRECT_URI)


@router.get("/google/callback")
async def google_callback(request: Request):
    if not config.GOOGLE_CONFIGURED:
        raise HTTPException(503, "Google sign-in is not configured.")
    try:
        # Authlib validates OAuth state and the OIDC ID token signature, issuer, audience and nonce.
        token = await oauth.google.authorize_access_token(request)
        identity = token.get("userinfo")
        if (
            not identity
            or not identity.get("sub")
            or not identity.get("email")
            or identity.get("email_verified") is not True
        ):
            raise ValueError("Verified Google identity required.")
    except (OAuthError, JoseError, httpx.HTTPError, ValueError, KeyError):
        request.session.clear()
        return RedirectResponse("/?auth_error=google", status_code=303)
    owner = "google:" + identity["sub"]
    user = {
        "email": identity["email"],
        "name": identity.get("name") or identity["email"],
        "picture": identity.get("picture") or "",
        "created": now(),
    }
    with store_for(request).transaction() as tx:
        existing = tx.one("users", id=owner)
        if existing:
            tx.update("users", owner, {k: v for k, v in user.items() if k != "created"})
        else:
            tx.insert("users", {"id": owner, **user})
        tx.insert(
            "auth_events",
            {"owner_id": owner, "event": "google_login", "created": now()},
        )
    # Access/refresh tokens are never stored in the workbook or cookie.
    request.session.clear()
    request.session["user_id"] = owner
    return RedirectResponse("/", status_code=303)


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}
