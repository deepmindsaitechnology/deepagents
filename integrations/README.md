# Integrations

`groq.py` implements generated answers and the local fallback. `google.py` configures Google OpenID Connect; HTTP callbacks and account authorization remain in `backend/api/auth.py`.

Credentials are loaded from the root `.env` by `backend/core/config.py`. Never put keys in frontend files or agent folders.
