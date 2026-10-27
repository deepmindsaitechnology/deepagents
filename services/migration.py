"""Read-only, one-time import of the previous SQLite POC into Excel. Never deletes the source."""

import json
import sqlite3
from datetime import datetime, timezone
from services.workspaces import ensure_workspace


def migrate_legacy(store, source):
    if not source.is_file():
        return False
    with store.transaction() as tx:
        if tx.all("agents") or tx.one("migrations", source=str(source)):
            return False
        connection = sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        try:
            existing = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            for table in (
                "agents",
                "runs",
                "knowledge_documents",
                "knowledge_chunks",
                "vector_indexes",
                "datasets",
                "reports",
            ):
                if table not in existing:
                    continue
                for row in connection.execute(f"SELECT * FROM {table}"):
                    values = dict(row)
                    values["owner_id"] = "demo"
                    if table == "agents":
                        values.update(
                            source="user",
                            created=datetime.now(timezone.utc).isoformat(),
                        )
                    if table == "vector_indexes":
                        values["idf"] = json.loads(values["idf"])
                    if table == "knowledge_chunks":
                        values["embedding"] = json.loads(values["embedding"])
                    if table == "datasets":
                        values["tables"] = json.loads(values.pop("tables_json"))
                    if table == "reports":
                        values["body"] = json.loads(values["body"])
                    record = tx.insert(table, values)
                    if table == "agents":
                        tx.update("agents", record["id"], ensure_workspace(record))
            tx.insert(
                "migrations",
                {
                    "owner_id": "demo",
                    "source": str(source),
                    "created": datetime.now(timezone.utc).isoformat(),
                },
            )
        finally:
            connection.close()
    return True
