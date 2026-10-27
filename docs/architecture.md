# Architecture and agent development

`app.py` assembles the application. `api/` owns HTTP validation and account checks. `platform_core/` owns .env configuration and the workbook repository. `services/` owns document extraction, retrieval, calculations, Groq calls, managed files, and legacy import.

## Foundry

Each capability has its own module in `foundry_agents/`: `chat_agent.py`, `voice_agent.py`, `document_agent.py`, `analysis_agent.py`, `workflow_agent.py`, `team_agent.py`. `registry.py` maps capabilities to implementations. `catalog.json` lists the named templates. Each template has a corresponding Markdown file in `foundry_prompts/`.

Edit Foundry prompt repository files to change their defaults. Foundry sample documents are under `knowledge_base/foundry/<template>/` and are explicitly fictional. Workflow/team classes expose simulation previews; they do not execute external tasks.

## User agents

Creating an agent generates:

```text
user_agents/<account-hash>/<agent-name>_<id>/
  agent.json
  <agent-name>_<id>.py
user_prompts/<account-hash>/<agent-name>_<id>.md
knowledge_base/user_agents/<account-hash>/<agent-name>_<id>/
  documents/
  extracted/
  datasets/
  indexes/
```

The Python module defines an `Agent` class extending its Foundry capability. For conversation agents, `prepare(context)` runs before `run(context)`:

```python
from foundry_agents.chat_agent import ChatAgent

class Agent(ChatAgent):
    def prepare(self, context):
        context['instructions'] += '\nUse concise bullet points.'
        return context
```

Analysis classes expose `run(filename, tables)` for developer-written extensions. Returned reports must preserve the shape used by `services.analysis.make_report`. These Python modules are trusted local server code; uploaded PDFs, Word files, and spreadsheets are never imported or executed as code. Restrict filesystem access accordingly. Restart after developer changes.

System prompt files are authoritative at execution. Prompt API edits also synchronize workbook instructions. Knowledge document text is reference data, not system instructions. Retrieval selects only rows with the authenticated owner ID and chosen agent ID before ranking.

## API groups

- `/api/auth/*`: Google OIDC, demo sign-in, session status, logout
- `/api/catalog`: shared Foundry templates
- `/api/agents*`: account-owned agents, prompts and documents
- `/api/chat`: dispatch through the selected capability/extension
- `/api/analyze*`, `/api/reports*`: calculated summaries and downloads
- `/api/storage*`: account table counts and scoped workbook export

The original POC's JSON and multipart agent/analysis API shapes are retained where possible, with authentication now required. Direct API clients must sign in first and retain the session cookie.
