# DeepAgent Foundry

An organized, local-first agent platform: Foundry templates, user-created agents, per-agent prompts and knowledge, spreadsheet analysis, and Google account workspaces. Application tables are stored in **Excel**, ready for a future database adapter.

## Run locally in VS Code

Python 3.12+ is required.

```sh
git clone https://github.com/deepmindsaitechnology/deepagents.git
cd deepagents
python -m venv .venv
```

Activate on Windows PowerShell with `.\.venv\Scripts\Activate.ps1`, or on macOS/Linux with `source .venv/bin/activate` (use `python3` above if needed).

```sh
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` in VS Code Explorer. Keep your real keys only in `.env`, which Git ignores. Existing shell variables take precedence. Add a Groq API key and a model available in your Groq account if you want generated answers. Without it, document excerpts and calculated spreadsheet reports still work.

```sh
python -m uvicorn app:app --reload --port 8000
```

Open **http://localhost:8000**. The local demo opens directly to the original dashboard. Configure Google login to require account sign-in. Restart after `.env` changes. Use one Uvicorn worker for this Excel-backed prototype.

## Google login

See [Google sign-in setup](docs/google-login.md). Real Google sign-in needs your Google Cloud OAuth client ID, client secret, and a random session secret. No passwords are collected by this app. Demo login is disabled when Google OAuth is configured.

Google users get separate account-owned agents, documents, runs, reports, and workbook exports. Foundry templates are shared read-only defaults. The local demo is a shared evaluation account, not a secure production login.

## Workspace navigation

The interface follows the proposal's capabilities → business domains → solution templates model. See [suite blueprint and implementation scope](docs/suite-blueprint.md). The marketplace lists all 17 proposal templates with readiness status; **Manage workspace → Suite roadmap** shows the 14 capabilities, 12 domains and 17 proposed solutions with their current status.

Daily work is organized as **Home → Marketplace / My Agents → Test an agent**, with **Knowledge & data** alongside. Agent creation has four steps: choose, system prompt, knowledge, and tools/integrations. All 14 PDF agent categories, 12 domains and 17 templates are selectable. Templates with unimplemented services save as configuration drafts. Additional workspace tools are under an expandable navigation group.

The original visual style is retained, with fewer items shown at once.

- **Marketplace**: solution templates with combined search, domain and capability filters.
- **My Agents**: account-owned agents with the same discovery controls.
- **Test an agent**: conversations, document retrieval, browser voice, spreadsheet analysis and reports.
- **Knowledge & data**: documents and datasets grouped by their owning agent.
- **Manage workspace**: integration setup, activity, suite roadmap and settings.

Named prompt files and user agent Python extensions remain organized in the backend folders below. Edit prompts locally in VS Code or through the ownership-checked prompt API.

## Repository layout

```text
app.py                         Compatible Uvicorn entry point
backend/
  app.py                       Application assembly
  api/                         HTTP routes and account checks
  core/                        Configuration
  services/                    Documents, retrieval, analysis and migration
frontend/static/               Original HTML/CSS/JS, same design
integrations/                  Groq and Google provider integration
database/
  store.py                     Excel repository adapter
  inputs/                      Optional read-only input databases
  data/platform.xlsx           Runtime workbook (generated, ignored)
foundry_agents/
  capabilities/                Shared agent base implementations
  catalog.json                 Built-in template metadata
  <template-name>/
    agent.json
    agent.py
    prompts/system.md
    knowledge/{documents,extracted,datasets,indexes}/
user_agents/<account>/<agent-name>_<id>/
  agent.json
  agent.py
  prompts/system.md
  prompts/uploads/             Original uploaded system-prompt documents
  knowledge/{documents,extracted,datasets,indexes}/
docs/                          Setup, storage and architecture
tests/                         Functional and account isolation tests
```

These are folders in one repository, not Git submodules. User artifacts and credentials are ignored by Git. Each agent name is normalized into a readable folder name with an ID suffix; account folders use a stable hash, so duplicate names do not collide.

## Create agents

Choose **Create agent**. Enter name, domain and capability. Type system instructions or upload a TXT/MD, selectable-text PDF, or Word DOCX prompt. Uploaded prompt text is appended to the typed instructions.

For conversational agents, attach up to five knowledge documents. Extracted chunks and normalized **TF-IDF embeddings** are retained in Excel and indexed in each agent?s `knowledge/indexes/knowledge.db` SQLite database. Sparse vector search uses indexed term postings and cosine similarity, then query-term and phrase matching to rank short excerpts with filenames and page references. New uploads build the database immediately; existing agents build or refresh it automatically on their next question. The SQLite database is a rebuildable local index, isolated by account and agent. This is term-based retrieval, not neural semantic search; no extra embedding API or model download is required. Scanned PDFs require OCR first. Legacy DOC must be converted to DOCX. Word extraction covers paragraphs and tables.

For **Analysis** agents, attach CSV or Excel XLSX during creation or upload in Playground. Run **Analyze attached data** for persistent datasets. Numeric totals, averages, median, min/max, missing and unique counts are calculated for every populated worksheet. Download an Excel or JSON report with statistics and the first eight rows per worksheet. Excel formulas are not recalculated; cached values are read. Analysis uses fixed statistics, not generated Python execution or arbitrary natural-language analysis.

Limits: 5 MB per file, 300,000 extracted characters per document, 150 PDF pages, 1,000 chunks per agent, 24,000 combined instruction characters. Spreadsheets: 10 worksheets, 10,000 rows each, 100 columns, and 200,000 cells total. CSV requires UTF-8 and supports comma/semicolon/tab delimiters. Convert XLS to XLSX. Numeric values should use plain decimal notation, without currency symbols or thousands separators.

## Existing data and Excel storage

On first startup, the old `deepagent.db` (or `DEEPAGENT_DB`) is imported read-only into a fresh workbook under the **demo** account. The original SQLite file is never removed or changed. Existing workbook agents prevent automatic reimport. Old original uploads may be unavailable because the earlier version only retained extracted chunks.

Google accounts do not automatically inherit shared demo records. This prevents accidental cross-account sharing. The previous default workbook and split agent files are copied into the new layout automatically at startup; original files remain as backups. See [architecture](docs/architecture.md) for the migration details. See [storage and migration](docs/storage.md) for the tables, schema, file locking, long-value handling, and backup guidance. `docs/platform_schema.xlsx` is an empty schema workbook for reference; the live workbook is generated at startup.

## Developer extensions

See [architecture and agent extensions](docs/architecture.md). Each created agent gets a Python `Agent` class extending its Foundry capability, a JSON manifest, a named Markdown prompt, and its own knowledge folders. Developer-written extensions execute as trusted server code. The web UI never accepts Python uploads. For future deployment, restrict local filesystem access and review extensions.

## Verify

```sh
python -m unittest discover -s tests -v
node --check frontend/static/app.js
```

Tests use temporary Excel workbooks and file folders. Groq and Google provider responses are mocked; tests do not claim live provider validation. Real OAuth needs the configured Google project, and live Groq needs a valid key, supported model and quota.

## Prototype boundaries

Excel is suitable for local or small-scale evaluation, not concurrent enterprise production. Keep the workbook closed in Excel while the app writes it. Shared company workspaces, role administration, billing, OCR, neural semantic embeddings, telephone calls and external business integrations remain future work. Browser dictation/read-aloud depends on browser support and microphone permission; speech services may process audio remotely. Workflow/team previews are clearly marked simulations. Use sample data while evaluating.

Chat answers are requested in 1?3 sentences. If the AI provider times out (15-second request deadline), document questions return the best local excerpt. Without a Groq key, document lookup returns one excerpt; general AI answers require Groq. SQLite uses Python?s standard library, with no extra service or model download.
