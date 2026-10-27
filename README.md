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

Open **http://localhost:8000**. Choose **Explore local demo workspace**, or configure Google login first. Restart after `.env` changes. Use one Uvicorn worker for this Excel-backed prototype.

## Google login

See [Google sign-in setup](docs/google-login.md). Real Google sign-in needs your Google Cloud OAuth client ID, client secret, and a random session secret. No passwords are collected by this app. Demo login is disabled when Google OAuth is configured.

Google users get separate account-owned agents, documents, runs, reports, and workbook exports. Foundry templates are shared read-only defaults. The local demo is a shared evaluation account, not a secure production login.

## Workspace navigation

- **Foundry Agents**: built-in templates grouped by Chat, Voice, Document, Analysis, Workflow, and Agent Team; search and filter by domain.
- **My Agents**: your saved agents, grouped by capability, with search and domain filters.
- **Domains**: nine business domains with links into Foundry and your own agents.
- **Prompts**: inspect Foundry prompts and edit your own named prompt files.
- **Playground**: test conversations, retrieval, browser voice, spreadsheet analysis, and workflow simulations.
- **Knowledge Base**: agent-specific document collections, indexed chunk counts, and original document downloads.
- **Runs & Reports**: actual activity and Excel/JSON analysis downloads.
- **Settings**: account information, table counts, repository layout, and an account-scoped Excel export.

## Repository layout

```text
app.py                         Application entry point
api/                           Authentication and feature routes
platform_core/                 Configuration and Excel repository adapter
services/                      Documents, retrieval, analysis, Groq, migration
foundry_agents/                Separate Python module per agent capability
  catalog.json                 Built-in template metadata
foundry_prompts/               One named Markdown prompt per Foundry template
user_agents/<account>/<agent>/ Agent manifest and named editable Python module
user_prompts/<account>/        One named Markdown prompt per user agent
knowledge_base/
  foundry/<template>/          Shared sample knowledge
  user_agents/<account>/<agent>/
    documents/                Original knowledge files
    extracted/                Extracted text
    datasets/                 Original analysis spreadsheets
    indexes/                  Reserved for a future vector database
data/platform.xlsx            All application tables (generated, ignored)
docs/                         Google setup, storage, architecture, blank schema
tests/                        Functional and account isolation tests
```

These are folders in one repository, not Git submodules. User artifacts and credentials are ignored by Git. Each agent name is normalized into a readable filename with an ID suffix; account folders use a stable hash, so duplicate names do not collide.

## Create agents

Choose **Create agent**. Enter name, domain and capability. Type system instructions or upload a TXT/MD, selectable-text PDF, or Word DOCX prompt. Uploaded prompt text is appended to the typed instructions.

For conversational agents, attach up to five knowledge documents. Extracted chunks and normalized **TF-IDF embeddings** are stored in Excel. Retrieval uses cosine similarity and returns sources with filenames and PDF page references. This is term-based retrieval, not neural semantic search; no extra embedding API or model download is required. Scanned PDFs require OCR first. Legacy DOC must be converted to DOCX. Word extraction covers paragraphs and tables.

For **Analysis** agents, attach CSV or Excel XLSX during creation or upload in Playground. Run **Analyze attached data** for persistent datasets. Numeric totals, averages, median, min/max, missing and unique counts are calculated for every populated worksheet. Download an Excel or JSON report with statistics and the first eight rows per worksheet. Excel formulas are not recalculated; cached values are read. Analysis uses fixed statistics, not generated Python execution or arbitrary natural-language analysis.

Limits: 5 MB per file, 300,000 extracted characters per document, 150 PDF pages, 1,000 chunks per agent, 24,000 combined instruction characters. Spreadsheets: 10 worksheets, 10,000 rows each, 100 columns, and 200,000 cells total. CSV requires UTF-8 and supports comma/semicolon/tab delimiters. Convert XLS to XLSX. Numeric values should use plain decimal notation, without currency symbols or thousands separators.

## Existing data and Excel storage

On first startup, the old `deepagent.db` (or `DEEPAGENT_DB`) is imported read-only into a fresh workbook under the **demo** account. The original SQLite file is never removed or changed. Existing workbook agents prevent automatic reimport. Old original uploads may be unavailable because the earlier version only retained extracted chunks.

Google accounts do not automatically inherit shared demo records. This prevents accidental cross-account sharing. See [storage and migration](docs/storage.md) for the tables, schema, file locking, long-value handling, and backup guidance. `docs/platform_schema.xlsx` is an empty schema workbook for reference; the live workbook is generated at startup.

## Developer extensions

See [architecture and agent extensions](docs/architecture.md). Each created agent gets a Python `Agent` class extending its Foundry capability, a JSON manifest, a named Markdown prompt, and its own knowledge folders. Developer-written extensions execute as trusted server code. The web UI never accepts Python uploads. For future deployment, restrict local filesystem access and review extensions.

## Verify

```sh
python -m unittest discover -s tests -v
node --check static/app.js
```

Tests use temporary Excel workbooks and file folders. Groq and Google provider responses are mocked; tests do not claim live provider validation. Real OAuth needs the configured Google project, and live Groq needs a valid key, supported model and quota.

## Prototype boundaries

Excel is suitable for local or small-scale evaluation, not concurrent enterprise production. Keep the workbook closed in Excel while the app writes it. Shared company workspaces, role administration, billing, OCR, neural semantic embeddings, telephone calls and external business integrations remain future work. Browser dictation/read-aloud depends on browser support and microphone permission; speech services may process audio remotely. Workflow/team previews are clearly marked simulations. Use sample data while evaluating.
