# Database inputs

Place an optional legacy SQLite import source here, then set `DEEPAGENT_DB=database/inputs/your-source.db` in the root `.env`. Import is read-only, one-time, and scoped to the demo account. The previous root `deepagent.db` remains supported.

Application records live in `database/data/platform.xlsx` by default. `DEEPAGENT_WORKBOOK` selects another workbook; `DEEPAGENT_DATA_DIR` sets the default data directory. Agent analysis input CSV/XLSX files stay in that agent's `knowledge/datasets/` folder. Agent RAG sources stay in `knowledge/documents/`.

This restructuring retains the Excel repository; it does not add a SQL database connector. Input databases and runtime workbooks are ignored by Git.
