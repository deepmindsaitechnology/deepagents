"""Persistent sparse TF-IDF vector search using SQLite's indexed term postings.

The workbook remains the source of truth. A fingerprint rebuilds this derived
database after changes, including for agents created before SQLite indexing.
"""
import hashlib
import json
import sqlite3
from contextlib import closing


def search(path, rows, vector, limit=3):
    fingerprint = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path, timeout=5)) as db, db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS metadata (fingerprint TEXT);
            CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY, body TEXT);
            CREATE TABLE IF NOT EXISTS vectors (
                term TEXT, chunk_id INTEGER, weight REAL,
                PRIMARY KEY (term, chunk_id)
            );
        """)
        current = db.execute("SELECT fingerprint FROM metadata").fetchone()
        if not current or current[0] != fingerprint:
            db.execute("DELETE FROM vectors")
            db.execute("DELETE FROM chunks")
            db.execute("DELETE FROM metadata")
            for row in rows:
                db.execute("INSERT INTO chunks VALUES (?, ?)", (row["id"], json.dumps(row)))
                db.executemany("INSERT INTO vectors VALUES (?, ?, ?)",
                               ((term, row["id"], weight) for term, weight in row["embedding"].items()))
            db.execute("INSERT INTO metadata VALUES (?)", (fingerprint,))
        db.execute("CREATE TEMP TABLE query (term TEXT, weight REAL)")
        db.executemany("INSERT INTO query VALUES (?, ?)", vector.items())
        matches = db.execute("""
            SELECT c.body, SUM(v.weight * q.weight) AS score
            FROM query q JOIN vectors v ON v.term = q.term
            JOIN chunks c ON c.id = v.chunk_id
            GROUP BY c.id HAVING score > 0.05
            ORDER BY score DESC, c.id LIMIT ?
        """, (limit,)).fetchall()
        return [(json.loads(body), score) for body, score in matches]
