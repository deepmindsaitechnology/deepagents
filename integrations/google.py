"""Google OpenID Connect provider configuration."""
from authlib.integrations.starlette_client import OAuth
from backend.core import config

oauth = OAuth()
if config.GOOGLE_CONFIGURED:
    oauth.register(
        name="google",
        client_id=config.GOOGLE_CLIENT_ID,
        client_secret=config.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

