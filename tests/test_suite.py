import json

from openpyxl import Workbook

from helpers import PlatformCase
from backend.services.catalog import get_template
from database.store import ExcelStore, SCHEMA


class SuiteTests(PlatformCase):
    def test_proposal_catalog_is_complete_and_requires_login(self):
        suite = self.client.get('/api/suite').json()
        self.assertEqual(len(suite['capabilities']), 14)
        self.assertEqual(len(suite['domains']), 12)
        self.assertEqual(len(suite['template_concepts']), 17)
        capabilities = {row['id'] for row in suite['capabilities']}
        domains = {row['id'] for row in suite['domains']}
        for concept in suite['template_concepts']:
            self.assertEqual(concept['status'], 'Planned')
            self.assertIn(concept['domain_id'], domains)
            self.assertTrue(set(concept['capabilities']).issubset(capabilities))
        for template in self.client.get('/api/catalog').json():
            self.assertIn(template['domain_id'], domains)
            self.assertTrue(set(template['capabilities']).issubset(capabilities))
        self.client.post('/api/auth/logout')
        self.assertEqual(self.client.get('/api/suite').status_code, 401)

    def test_template_creation_has_independent_prompt_and_saved_lineage(self):
        template = get_template('hr_policy_assistant')
        response = self.client.post('/api/agents', json={
            'name': 'My HR Assistant', 'domain': 'HR & Recruitment', 'type': 'Chat',
            'template_id': 'hr_policy_assistant',
        })
        self.assertEqual(response.status_code, 201, response.text)
        agent = response.json()
        self.assertEqual(agent['instructions'], template['instructions'])
        self.assertEqual(agent['domain_id'], 'hr')
        self.assertEqual(agent['capabilities'], ['chat', 'knowledge'])
        self.assertEqual(agent['template_id'], 'hr_policy_assistant')
        manifest = (self.root / agent['code_path']).parent / 'agent.json'
        self.assertEqual(json.loads(manifest.read_text())['template_id'], 'hr_policy_assistant')
        self.assertEqual(agent['documents'], [])
        self.client.put(f"/api/agents/{agent['id']}/prompt", json={'instructions': 'Only my new instructions'})
        self.assertEqual(get_template('hr_policy_assistant')['instructions'], template['instructions'])
        persisted = ExcelStore(self.store.path)
        with persisted.transaction() as tx:
            self.assertEqual(tx.one('agents', id=agent['id'])['capabilities'], ['chat', 'knowledge'])

    def test_invalid_template_capability_and_unknown_templates_are_rejected(self):
        body = {'name': 'Invalid', 'domain': 'HR', 'type': 'Analysis', 'template_id': 'hr_policy_assistant'}
        self.assertEqual(self.client.post('/api/agents', json=body).status_code, 400)
        body.update(type='Chat', template_id='unknown_template')
        self.assertEqual(self.client.post('/api/agents', json=body).status_code, 404)
        self.assertEqual(self.client.get('/api/agents').json(), [])
        self.assertEqual(list((self.root / 'user_agents').rglob('agent.json')), [])

    def test_uploaded_prompt_extends_template_without_mixing_knowledge(self):
        response = self.client.post('/api/agents/upload', data={
            'name': 'Uploaded template', 'domain': 'HR', 'type': 'Chat',
            'template_id': 'hr_policy_assistant',
        }, files=[('prompt_file', ('extra.md', b'Be concise.', 'text/markdown'))])
        self.assertEqual(response.status_code, 201, response.text)
        agent = response.json()
        self.assertIn(get_template('hr_policy_assistant')['instructions'], agent['instructions'])
        self.assertIn('Be concise.', agent['instructions'])
        self.assertEqual(agent['documents'], [])
        self.assertEqual(agent['domain_id'], 'hr')

    def test_scratch_chat_with_documents_is_discoverable_as_knowledge(self):
        response = self.client.post('/api/agents/upload', data={
            'name': 'Policy assistant', 'domain': 'HR', 'type': 'Chat',
        }, files=[('knowledge_files', ('policy.txt', b'Leave entitlement is 24 days.', 'text/plain'))])
        self.assertEqual(response.status_code, 201, response.text)
        agent = response.json()
        self.assertEqual(agent['capabilities'], ['chat', 'knowledge'])
        manifest = (self.root / agent['code_path']).parent / 'agent.json'
        self.assertEqual(json.loads(manifest.read_text())['capabilities'], ['chat', 'knowledge'])

    def test_old_workbook_headers_upgrade_without_losing_records(self):
        path = self.root / 'old.xlsx'
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'agents'
        original_columns = SCHEMA['agents'][:12]
        sheet.append(original_columns)
        sheet.append([17, 'demo', 'Existing agent', 'HR', 'Chat', 'Preserved', 'user'])
        workbook.save(path)
        workbook.close()
        with ExcelStore(path).transaction() as tx:
            agent = tx.one('agents', id=17)
            self.assertEqual(agent['instructions'], 'Preserved')
            self.assertIsNone(agent['template_id'])
            tx.update('agents', 17, {'template_id': 'hr_policy_assistant', 'capabilities': ['chat', 'knowledge']})
        with ExcelStore(path).transaction() as tx:
            agent = tx.one('agents', id=17)
            self.assertEqual(agent['owner_id'], 'demo')
            self.assertEqual(agent['capabilities'], ['chat', 'knowledge'])
            self.assertEqual([cell.value for cell in tx.workbook['agents'][1]], SCHEMA['agents'])
