# Excel storage

`DEEPAGENT_WORKBOOK` defaults to `data/platform.xlsx`. `ExcelStore` is the only runtime table repository. There is no runtime SQLite database; SQLite is used solely by the optional read-only legacy importer.

| Worksheet | Contents |
|---|---|
| users | Verified account identity and profile; no OAuth tokens |
| agents | Account, agent metadata, instructions and managed file paths |
| runs | Account-owned execution history |
| knowledge_documents | Original document metadata, paths and chunk counts |
| knowledge_chunks | Extracted chunks and normalized TF-IDF vectors |
| vector_indexes | Agent-specific vocabulary and IDF weights |
| datasets | Parsed spreadsheets and original upload paths |
| reports | Analysis report snapshots |
| auth_events | Login audit events |
| migrations | One-time legacy import markers |
| _long_values | Numbered pieces for values larger than a safe Excel cell size |

List/dictionary fields use an `@json:` prefix. Values exceeding 28,000 characters use an `@long:` reference to `_long_values`, preventing Excel's 32,767-character cell limit from truncating datasets or embeddings. Preserve these sheets together; do not edit IDs, encoded values, headers, or long-value references by hand. Uploaded strings are literal cell values, so spreadsheet formulas are not executed by exports.

A process/file lock covers each read-modify-save transaction. Writes save to a temporary workbook in the same directory and atomically replace the previous file. Failed transactions do not save partial table changes. Keep the live workbook closed in Excel or writes may fail on Windows. Use a single server worker for this prototype; high-volume concurrent workloads need a proper database.

The application workbook includes all accounts and must be accessible only to trusted local operators. The authenticated **GET /api/storage/export** API creates a separate workbook filtered to the signed-in account, never the full live workbook. Original files remain in that account's knowledge folders and are downloaded through ownership-checked routes.

## Existing SQLite POC

Automatic import runs only when the destination has no agents and the source has not been marked imported. It preserves IDs and copies agent configuration, runs, indexed chunks, vectors, datasets and reports into the demo account. The old database is opened read-only and is not removed. Generated named prompts/code folders are added for the imported agents. Data imported into the shared demo account is not silently reassigned to a Google user.

To import an old database into a separate, empty workbook:

```sh
python scripts/import_legacy.py --source deepagent.db --workbook data/imported-platform.xlsx
```

Then choose that workbook in `.env` if desired. An existing destination with agents is not merged or overwritten.

## Backups and future databases

Stop the server before backing up the live workbook, `user_agents/`, `user_prompts/`, and `knowledge_base/user_agents/` together. Keep `.env` in a separate secure backup. Prompts can be edited through the ownership-checked PUT /api/agents/{id}/prompt API (updates file and workbook) or locally in VS Code (file content takes precedence at execution).

A future database adapter can replace `ExcelStore.transaction()` and its `all`, `one`, `insert`, `update` operations. Agents and services do not embed SQL. Workbook schema is also available as `docs/platform_schema.xlsx`. This is account isolation for individual workspaces, not a company/role permission system.
