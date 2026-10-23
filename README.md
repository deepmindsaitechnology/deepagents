# DeepAgent showcase POC

A responsive agent platform showcase with nine domains and six capabilities: chat, voice, analysis, documents, workflows, and agent teams.

## Run

Requires Python 3.12 or newer.

```sh
git clone https://github.com/deepmindsaitechnology/deepagents.git
cd deepagents
python -m venv .venv
```

Activate the environment on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Or on macOS/Linux (use `python3` above if needed):

```sh
source .venv/bin/activate
```

Install and start:

```sh
python -m pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

Open **http://localhost:8000** in your local browser. In VS Code, use **File > Open Folder** to open `deepagents`, then run these commands in **Terminal > New Terminal**. Demo mode works without a Groq key.

## Local configuration (.env)

Copy `.env.example` to `.env` in the project root. In VS Code you can copy and rename the file in Explorer.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```sh
cp .env.example .env
```

Edit `.env`:

```dotenv
GROQ_API_KEY=your_actual_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
DEEPAGENT_DB=deepagent.db
```

Restart the server after changing `.env`. It is loaded automatically from the project folder regardless of the working directory. Existing exported/injected environment variables take precedence; remove an old terminal value if it masks your `.env` change. `.env` and environment variants are ignored by Git; `.env.example` contains only non-secret defaults. Never commit or share your real keys.

This POC uses SQLite, so no database username, password, or server is needed. `DEEPAGENT_DB` selects the SQLite file; relative paths resolve against the project folder. External database credentials will be added when an external database integration is implemented.

Without a Groq key, chat uses scripted demo mode. With a key, outbound HTTPS to `api.groq.com`, a model available to your account, and sufficient quota are required. Configured does not mean verified.

## Included behavior

- Marketplace search, domain/type filters, nine domain options, eleven templates.
- Agent builder with SQLite persistence and custom instructions.
- Chat with server-side Groq or clearly labeled scripted responses.
- Reference text lookup in demo mode; context supplied to Groq when enabled. Not vector RAG.
- CSV parsing and actual numeric totals, averages, min/max, and data preview. No generated code execution.
- Browser dictation/read-aloud when supported; browser speech services may process audio remotely. Microphone requires a secure context. No phone calling.
- Workflow/team simulations with explicit human approval; no external execution.
- Run history from actual chat and analysis requests.

## Boundaries

A single-user development POC. No authentication, multi-tenant isolation, billing, production rate limiting, external business integrations, durable orchestration, PDF ingestion, or vector retrieval. Do not expose publicly or use sensitive data. The visible user/workspace is fictional. Local SQLite stores configurations and run metadata, not conversation bodies or CSV content. Database path can be overridden with `DEEPAGENT_DB`. Optional Google Fonts have system fallbacks.

## Verify

```sh
python -m unittest discover -s tests -v
node --check static/app.js
```

API tests use temporary databases. Groq success and failure paths are mocked; no real Groq request is claimed without a configured key.
