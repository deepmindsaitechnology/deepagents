# Google sign-in setup

1. Create or select a project at https://console.cloud.google.com/.
2. In **Google Auth Platform**, configure branding and choose an **External** audience so Gmail users can sign in. Set your app name and support/contact email.
3. Request only the identity scopes **openid**, **email**, and **profile**. No Gmail mailbox permissions are needed.
4. Create an OAuth client with application type **Web application**.
5. Add the exact authorized redirect URI:

   `http://localhost:8000/api/auth/google/callback`

6. Copy the client ID and client secret into your local `.env`:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
SESSION_SECRET=your-random-secret-at-least-32-characters
COOKIE_SECURE=false
```

Generate the session secret locally:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

7. Restart the server and open **http://localhost:8000** (not 127.0.0.1). Click **Continue with Google**.

While the consent configuration is in **Testing**, add allowed test accounts in Google Auth Platform. To allow other Gmail accounts, move the External app to production according to Google's publication/verification requirements. This is controlled by your Google project, not by the DeepAgent UI. Workspace administrators can also restrict account access.

For HTTPS deployment, update the registered redirect URI and `.env` to the exact deployed hostname and set `COOKIE_SECURE=true`. Keep the session secret stable across restarts. Any missing or invalid OAuth credential is an external configuration prerequisite; do not replace real login with an email-only login form.

The app uses OAuth authorization code + OpenID Connect. Authlib verifies state, nonce, ID token signature, issuer and audience. Only verified email identities are accepted. Access/refresh tokens are not retained in Excel or cookies. Signed HttpOnly session cookies contain only the user ID. Every private API verifies the session and account ownership. Demo login is unavailable once Google is configured.

Server network access is needed to `accounts.google.com`, `oauth2.googleapis.com`, and Google's published signing-key hosts such as `www.googleapis.com`. Browser access is needed to Google's login pages. Never share the client secret or session secret in chat, prompts or Git.
