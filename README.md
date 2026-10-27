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
- Agent builder with SQLite persistence, typed instructions, and system prompt file uploads (TXT/MD, PDF, DOCX).
- Chat with server-side Groq or clearly labeled scripted responses.
- Agent-specific PDF/Word/text ingestion, chunking, local TF-IDF embeddings, SQLite vector storage, and cosine retrieval with source filenames and PDF page references. Groq generates answers from retrieved context; without a key, retrieved excerpts are shown.
- CSV/XLSX uploads during creation or in the playground, persistent datasets, multi-worksheet statistics (count, total, average, median, min/max), missing/unique values, previews, and Excel/JSON report downloads. No generated code execution.
- Browser dictation/read-aloud when supported; browser speech services may process audio remotely. Microphone requires a secure context. No phone calling.
- Workflow/team simulations with explicit human approval; no external execution.
- Run history from actual chat and analysis requests.

## Create a document-grounded chat agent

1. Choose **Create agent**, then Chat (or Document).
2. Enter a role in **System instructions**, or upload a **System prompt document**. Uploaded prompt text is appended to typed instructions and saved as trusted configuration.
3. Add reference files under **Agent knowledge documents**. These are reference data, not system instructions.
4. Submit. The server extracts text, splits it into overlapping chunks, computes normalized TF-IDF embeddings, and persists the index in SQLite under this agent’s ID.
5. Ask questions in the playground. Source cards show the exact retrieved excerpts and PDF page references. The Knowledge Base screen lists indexed documents.

Retrieval is local term-based vector search, not a neural semantic model. Use wording related to the source documents. No model download or additional embedding API key is needed. An unmatched question returns an explicit no-match response. Groq receives only the selected agent’s retrieved chunks. Generated answers can still be incorrect; inspect the source excerpts.

**Limits:** five knowledge files per creation, 5 MB per file, 300,000 extracted characters per document, 150 PDF pages, 1,000 chunks per agent, 24,000 combined instruction characters. UTF-8 TXT/MD, text-based PDF, and DOCX are supported. Convert legacy DOC first. Scanned PDFs require OCR; encrypted PDFs are rejected. Word extraction covers paragraphs and tables, not embedded images.

## Create an analysis agent and download results

1. Choose **Create agent → Analysis** and optionally attach a CSV or Excel XLSX file.
2. In the playground, click **Analyze attached data**, or upload a dataset there. A successful playground upload replaces the saved agent’s dataset. Failed uploads preserve existing data.
3. View per-worksheet numeric statistics and data quality. Use **Excel report** or **JSON** to download a snapshot of the analysis, including statistics and the first eight rows of each worksheet.

CSV supports comma, semicolon, and tab separators with UTF-8 encoding. XLSX supports up to ten populated worksheets. Maximum 5 MB per upload, 10,000 data rows per worksheet, 100 columns, and 200,000 cells across the workbook. Use a header in row one, with unique nonblank column names. Legacy XLS must be converted to XLSX. Excel formulas are not recalculated: cached results are read. Numeric-looking values must use plain decimal notation without currency symbols or thousands separators. Identifier columns that look numeric are included in numeric statistics; interpret totals accordingly.

Reports are calculated descriptive summaries, not arbitrary natural-language analysis or Python execution. System prompts control conversational agents; spreadsheet calculations use the fixed statistical methods above. Report exports store uploaded strings as literal text so they do not execute as Excel formulas.

Existing agent/run data is preserved: the new tables are added automatically on first use. Reports and attached datasets persist across restarts in the same SQLite database.

## Boundaries

A single-user development POC. No authentication, multi-tenant isolation, billing, production rate limiting, external business integrations, durable orchestration, OCR, or neural semantic embeddings. Do not expose publicly or use sensitive data. The visible user/workspace is fictional. Local SQLite stores instructions, extracted knowledge text, TF-IDF index and chunk vectors, attached spreadsheet data, report snapshots, and run metadata. Chat bodies and original file binaries are not retained. Database path can be overridden with `DEEPAGENT_DB`. Optional Google Fonts have system fallbacks.

## Verify

```sh
python -m unittest discover -s tests -v
node --check static/app.js
```

API tests use temporary databases. Groq success and failure paths are mocked; no real Groq request is claimed without a configured key.
