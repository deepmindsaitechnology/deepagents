# Architecture and agent development

The UI and HTTP endpoints are preserved. Start with `python -m uvicorn app:app --reload --port 8000`; `app.py` re-exports `backend.app` for compatibility.

## Application layers

- `backend/app.py`: application assembly, middleware, startup migrations and static routing.
- `backend/api/`: HTTP validation, authenticated ownership checks and feature routes.
- `backend/core/config.py`: root `.env` loading and configurable paths.
- `backend/services/`: document extraction, retrieval, calculations, managed agent files and legacy import.
- `frontend/static/`: original HTML, CSS and JavaScript; no build step.
- `integrations/`: Groq client and Google OIDC provider setup.
- `database/store.py`: Excel repository, atomic transactions and file locking.
- `database/data/platform.xlsx`: default runtime workbook, ignored by Git.
- `database/inputs/`: optional read-only legacy SQLite input databases.

## Agent layout

```
foundry_agents/
  capabilities/                   Shared base implementations
  registry.py
  catalog.json
  <template-name>/
    agent.json
    agent.py
    prompts/system.md
    knowledge/{documents,extracted,datasets,indexes}/
user_agents/
  <account-hash>/
    <agent-name>_<id>/
      agent.json
      agent.py
      prompts/
        system.md
        uploads/                  Original uploaded prompt files
      knowledge/
        documents/                Original uploaded RAG files
        extracted/                Extracted RAG text
        datasets/                 Analysis CSV/XLSX inputs
        indexes/                  Reserved for a future index adapter
```

Every template and created user agent has separate system-prompt and knowledge directories, even when empty. Each template owns its prompt, manifest, implementation and sources. User agents extend a Foundry capability, and own an independent editable prompt and private documents. Prompts are read from disk at execution; knowledge never becomes system instructions. User retrieval filters by authenticated account and agent before ranking; embeddings and metadata remain in Excel.

Template RAG reads TXT/MD/PDF/DOCX files from that template's `knowledge/documents/` and ranks chunks using TF-IDF. It does not search other templates or user folders. Built-in knowledge is shared and should contain only public/sample content.

## Developer extensions

```python
from foundry_agents.capabilities.chat_agent import ChatAgent

class Agent(ChatAgent):
    def prepare(self, context):
        context['instructions'] += '\nUse concise bullet points.'
        return context
```

Analysis extensions expose `run(filename, tables)` and preserve the report shape from `backend.services.analysis.make_report`. These modules are trusted local code. Document uploads are never executed. Restart after code changes.

## Existing installations

Startup copies the previous default `data/platform.xlsx` to `database/data/platform.xlsx` only when the new workbook does not exist. Copying uses both workbook locks and atomic replacement. The old default environment value `DEEPAGENT_WORKBOOK=data/platform.xlsx` maps to the new location. Explicit custom workbook paths are otherwise honored.

Startup consolidates old `user_prompts/<account>/<slug>.md`, `user_agents/<account>/<slug>/<slug>.py` and `knowledge_base/user_agents/<account>/<slug>/` files, then commits new agent/document/dataset paths in a workbook transaction. Original files remain as backups; repeated startup does not overwrite new prompts or documents. Generated extension imports are updated to `foundry_agents.capabilities`. Review custom developer extensions for imports of the former `api`, `services`, or `platform_core` packages.

The previous SQLite database remains a read-only one-time demo import. Database source files can be placed under `database/inputs/` and selected with `DEEPAGENT_DB`. Excel remains the active database engine.

## API groups

- `/api/suite`: authenticated product taxonomy, availability, domains and roadmap concepts.

- `/api/auth/*`: Google OIDC, demo sign-in, session status, logout.
- `/api/catalog`, `/api/agents*`: templates, account-owned agents, prompts and documents.
- `/api/chat`, `/api/preview`: selected capability/extension execution.
- `/api/analyze*`, `/api/reports*`: calculated reports and downloads.
- `/api/storage*`: scoped counts and workbook export.

One Uvicorn worker is supported for the Excel prototype. Keep the workbook closed in Excel while the app writes it.

## Proposal-aligned configuration

`foundry_agents/catalog.json` contains the exact 17 configurable proposal templates. Each has its own manifest, code adapter, system prompt and knowledge directories. `legacy_catalog.json` preserves the previous 11 template IDs for existing clients. Only the canonical templates are exposed in the current catalog UI.

The primary category and multi-capability selection are independent of the internal six-type dispatch used for existing executors. `backend/services/suite.py` validates configuration and derives readiness. Planned capabilities, missing adapters, non-web channels and unsupported multi-engine combinations remain saved drafts and cannot execute.

Agent records and manifests include `primary_capability`, `tools`, `integrations`, `channels`, and `approval_required`. The authenticated connections API updates selections for one agent and restores the manifest if the workbook commit fails. Provider credentials remain in server configuration, outside agent files. The approval flag records a future execution policy and does not imply a durable approval engine exists.

`frontend/static/suite-ui.js` contains proposal-aligned discovery, the four-step builder, the illustrated suite home and per-agent connection configuration. It shares existing API/authentication/chat/upload helpers with `app.js`; both scripts are served by FastAPI.

## Frontend delivery and selection controls

FastAPI serves one `/static/workspace.js` assembled from the existing `app.js` helpers and `suite-ui.js` before starting the workspace. Older overridden functions are explicitly renamed, so the initial six-type selector cannot remain visible because a second enhancement script was cached or missed. The HTML includes a content fingerprint in script and stylesheet URLs, is served with `Cache-Control: no-store`, and API reads bypass browser caches.

The product catalog includes the short category labels Chat, Voice, Analytics, Documents, Automation, Research, Knowledge, Communication, Creative, Video, Monitoring, Prediction, Computer Action and Orchestration. Creation, marketplace filtering and testing expose all 14 choices and all 12 domains. The testing screen also lists matching templates and saved agents; combinations without a current template offer creation with the selected category/domain. The template marketplace exposes all 17 proposal templates.
