import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from backend.services.documents import embed
from backend.services.retrieval import focus_excerpt
from backend.services.vector_store import search
from helpers import PlatformCase


class VectorStoreTests(unittest.TestCase):
    def test_persistence_and_rebuild_remove_stale_vectors(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "knowledge.db"
            idf = {"brokerage": 1, "remarks": 1, "price": 1}
            def row(text):
                return {"id": 1, "content": text, "embedding": embed(text, idf)}
            query = embed("brokerage remarks", idf)
            self.assertEqual(search(path, [row("brokerage remarks")], query)[0][0]["id"], 1)
            with closing(sqlite3.connect(path)) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM vectors").fetchone()[0], 2)
            self.assertEqual(search(path, [row("price")], query), [])
            self.assertEqual(search(path, [], query), [])

    def test_excerpt_targets_field_instead_of_unrelated_preamble(self):
        text = "Unrelated preamble. " * 150 + "BROKERAGE REMARKS: Offers accepted Friday. " + "Footer. " * 150
        excerpt = focus_excerpt(text, "what is BROKERAGE REMARKS?")
        self.assertIn("Offers accepted Friday", excerpt)
        self.assertLessEqual(len(excerpt), 902)


class KnowledgeDatabaseTests(PlatformCase):
    def test_upload_builds_database_and_existing_agent_rebuilds_it(self):
        response = self.client.post('/api/agents/upload', data={
            'name': 'Property', 'domain': 'Sales', 'type': 'Chat',
        }, files=[('knowledge_files', ('listing.txt', b'BROKERAGE REMARKS: Offers accepted Friday.'))])
        self.assertEqual(response.status_code, 201, response.text)
        agent = response.json()
        path = self.root / agent['knowledge_path'] / 'indexes/knowledge.db'
        self.assertTrue(path.is_file())
        path.unlink()  # Simulate an agent created before SQLite indexing.
        result = self.client.post('/api/chat', json={
            'agent_id': agent['id'], 'message': 'what is brokerage remarks?'
        })
        self.assertEqual(result.status_code, 200, result.text)
        self.assertTrue(path.is_file())
        self.assertIn('Offers accepted Friday', result.json()['answer'])
