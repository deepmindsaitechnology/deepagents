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

## Groq

Set `GROQ_API_KEY` securely in server environment settings before starting the server. Never put it in frontend code, commit it, or paste it into chat. Optional `GROQ_MODEL` defaults to `llama-3.3-70b-versatile`; select a model available to your account. Outbound HTTPS to `api.groq.com` must be permitted. Without a key, chat is explicitly scripted demo mode. Live Groq calls require a valid key and quota; configured does not mean verified.

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
