import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from helpers import PlatformCase
from backend.core import config
from backend.services import workspaces
from backend.services.catalog import catalog
from backend.services.retrieval import retrieve_foundry
from database.migration import prepare_workbook


class LayoutTests(PlatformCase):
    def test_uploaded_prompt_and_rag_sources_are_separate(self):
        response = self.client.post('/api/agents/upload', data={
            'name': 'Named RAG', 'domain': 'HR', 'type': 'Document', 'instructions': 'Be concise.'
        }, files=[
            ('prompt_file', ('instructions.md', b'Answer politely.', 'text/markdown')),
            ('knowledge_files', ('policy.txt', b'Annual leave is 24 days.', 'text/plain')),
        ])
        self.assertEqual(response.status_code, 201, response.text)
        agent = response.json()
        folder = (self.root / agent['code_path']).parent
        self.assertEqual(folder.name, agent['slug'])
        self.assertEqual((self.root / agent['prompt_path']), folder / 'prompts/system.md')
        self.assertEqual((folder / 'prompts/uploads/instructions.md').read_text(), 'Answer politely.')
        documents = list((folder / 'knowledge/documents').iterdir())
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0].read_text(), 'Annual leave is 24 days.')
        self.assertNotIn('Annual leave', (folder / 'prompts/system.md').read_text())
        self.assertFalse((self.root / 'user_prompts').exists())
        self.assertFalse((self.root / 'knowledge_base').exists())

    def test_legacy_workspace_migration_preserves_files_and_is_repeatable(self):
        owner = workspaces.owner_folder('demo')
        slug = 'old_agent_9'
        code = self.root / 'user_agents' / owner / slug / (slug + '.py')
        prompt = self.root / 'user_prompts' / owner / (slug + '.md')
        knowledge = self.root / 'knowledge_base/user_agents' / owner / slug
        code.parent.mkdir(parents=True)
        prompt.parent.mkdir(parents=True)
        (knowledge / 'documents').mkdir(parents=True)
        (knowledge / 'extracted').mkdir()
        (knowledge / 'datasets').mkdir()
        code.write_text('from foundry_agents.chat_agent import ChatAgent\nclass Agent(ChatAgent): pass\n')
        prompt.write_text('A locally edited prompt')
        document = knowledge / 'documents/policy.txt'
        extracted = knowledge / 'extracted/policy.txt'
        dataset = knowledge / 'datasets/sales.csv'
        document.write_text('24 days of leave')
        extracted.write_text('24 days of leave')
        dataset.write_text('Sales\n10')
        relative = lambda p: p.relative_to(self.root).as_posix()
        with self.store.transaction() as tx:
            tx.insert('agents', {'id': 9, 'owner_id': 'demo', 'source': 'user', 'name': 'Old Agent', 'type': 'Chat', 'domain': 'HR', 'slug': slug, 'instructions': 'Stale workbook prompt', 'code_path': relative(code), 'prompt_path': relative(prompt), 'knowledge_path': relative(knowledge)})
            tx.insert('knowledge_documents', {'owner_id': 'demo', 'agent_id': 9, 'file_path': relative(document), 'text_path': relative(extracted)})
            tx.insert('datasets', {'owner_id': 'demo', 'agent_id': 9, 'file_path': relative(dataset)})
        # A failed commit must leave the old records and source files usable.
        with patch('database.store.os.replace', side_effect=PermissionError('locked')):
            with self.assertRaises(RuntimeError):
                workspaces.migrate_workspaces(self.store)
        with self.store.transaction() as tx:
            self.assertEqual(tx.one('agents', id=9)['prompt_path'], relative(prompt))
        workspaces.migrate_workspaces(self.store)
        with self.store.transaction() as tx:
            agent = tx.one('agents', id=9)
            self.assertEqual(workspaces.prompt_text(agent), 'A locally edited prompt')
            for table, field in [('knowledge_documents', 'file_path'), ('knowledge_documents', 'text_path'), ('datasets', 'file_path')]:
                path = self.root / tx.one(table, agent_id=9)[field]
                self.assertTrue(path.is_relative_to(self.root / agent['knowledge_path']))
                self.assertTrue(path.is_file())
        self.assertIn('foundry_agents.capabilities.chat_agent', (self.root / agent['code_path']).read_text())
        (self.root / agent['prompt_path']).write_text('New authoritative prompt')
        workspaces.migrate_workspaces(self.store)
        self.assertEqual(workspaces.prompt_text(agent), 'New authoritative prompt')
        self.assertEqual(prompt.read_text(), 'A locally edited prompt')
        self.assertTrue(document.is_file())


class FoundryLayoutTests(unittest.TestCase):
    def test_every_foundry_template_owns_its_files(self):
        for template in catalog():
            folder = config.ROOT / 'foundry_agents' / template['template_id']
            self.assertTrue((folder / 'agent.json').is_file())
            self.assertTrue((folder / 'agent.py').is_file())
            self.assertTrue((folder / 'prompts/system.md').is_file())
            for name in ('documents', 'extracted', 'datasets', 'indexes'):
                self.assertTrue((folder / 'knowledge' / name).is_dir())
            self.assertEqual(json.loads((folder / 'agent.json').read_text())['prompt_path'], template['prompt_path'])

    def test_foundry_retrieval_uses_only_selected_knowledge(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / 'selected').mkdir()
            (folder / 'other').mkdir()
            (folder / 'selected/policy.txt').write_text('Annual leave entitlement is 24 days.')
            (folder / 'other/policy.txt').write_text('Annual leave entitlement is 99 days.')
            sources, indexed = retrieve_foundry(folder / 'selected', 'leave entitlement')
            self.assertTrue(indexed)
            self.assertEqual(len(sources), 1)
            self.assertIn('24 days', sources[0]['text'])
            self.assertNotIn('99 days', sources[0]['text'])

    def test_default_workbook_copy_preserves_source_and_newer_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            source = root / 'data/platform.xlsx'
            source.write_bytes(b'original workbook')
            destination = root / 'database/data/platform.xlsx'
            prepare_workbook(root, destination)
            self.assertEqual(source.read_bytes(), destination.read_bytes())
            destination.write_bytes(b'new workbook')
            prepare_workbook(root, destination)
            self.assertEqual(destination.read_bytes(), b'new workbook')
            self.assertEqual(source.read_bytes(), b'original workbook')
