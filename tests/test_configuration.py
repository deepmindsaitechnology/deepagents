import json
from unittest.mock import patch

from helpers import PlatformCase
from backend.services.catalog import catalog
from backend.services.suite import suite_catalog


class ConfigurationTests(PlatformCase):
    def test_marketplace_uses_all_proposal_template_names(self):
        self.assertEqual([row['name'] for row in catalog()], [row['name'] for row in suite_catalog()['template_concepts']])
        self.assertEqual(len(catalog()), 17)
        self.assertTrue(all('id' not in row for row in catalog()), 'Templates must not be confused with persisted user-agent IDs.')

    def test_every_proposal_template_can_be_customized(self):
        for template in catalog():
            response = self.client.post('/api/agents', json={
                'name': 'Custom ' + template['name'], 'domain': template['domain'],
                'template_id': template['template_id'],
            })
            self.assertEqual(response.status_code, 201, response.text)
            agent = response.json()
            self.assertEqual(agent['template_id'], template['template_id'])
            self.assertEqual(agent['primary_capability'], template['primary_capability'])

    def test_every_category_can_be_configured_and_saved(self):
        for capability in suite_catalog()['capabilities']:
            response = self.client.post('/api/agents', json={
                'name': capability['product'], 'domain': 'Education & EdTech',
                'primary_capability': capability['id'], 'capabilities': [capability['id']],
            })
            self.assertEqual(response.status_code, 201, response.text)
            agent = response.json()
            self.assertEqual(agent['primary_capability'], capability['id'])
            if capability['status'] == 'Planned':
                self.assertEqual(agent['execution_status'], 'draft')
                run = self.client.post('/api/chat', json={'agent_id': agent['id'], 'message': 'Run this task'})
                self.assertEqual(run.status_code, 409)

    def test_template_configuration_persists_tools_and_blocks_unconnected_execution(self):
        response = self.client.post('/api/agents', json={
            'name': 'My Property Marketing', 'domain': 'Real Estate',
            'template_id': 'property_marketing',
        })
        self.assertEqual(response.status_code, 201, response.text)
        agent = response.json()
        self.assertEqual(agent['execution_status'], 'draft')
        self.assertEqual(agent['capabilities'], ['creative', 'video', 'communication'])
        self.assertIn('image_generator', agent['integrations'])
        manifest = (self.root / agent['code_path']).parent / 'agent.json'
        self.assertEqual(json.loads(manifest.read_text())['integrations'], agent['integrations'])
        self.assertEqual(self.client.post('/api/chat', json={'agent_id': agent['id'], 'message': 'Generate and send'}).status_code, 409)
        self.assertEqual(self.client.get('/api/runs').json(), [])

    def test_upload_configuration_keeps_system_prompt_separate_from_knowledge(self):
        response = self.client.post('/api/agents/upload', data={
            'name': 'School knowledge', 'domain': 'Education & EdTech', 'type': 'Document',
            'instructions': 'You are a school assistant.',
            'configuration': json.dumps({'primary_capability': 'knowledge', 'capabilities': ['knowledge'], 'tools': ['knowledge_lookup'], 'integrations': ['groq'], 'channels': ['web'], 'approval_required': True}),
        }, files=[('prompt_file', ('rules.txt', b'Be concise.', 'text/plain')), ('knowledge_files', ('fees.txt', b'Tuition is 500 per month.', 'text/plain'))])
        self.assertEqual(response.status_code, 201, response.text)
        agent = response.json()
        self.assertIn('Be concise.', agent['instructions'])
        self.assertNotIn('Tuition', agent['instructions'])
        self.assertEqual(agent['primary_capability'], 'knowledge')
        reply = self.client.post('/api/chat', json={'agent_id': agent['id'], 'message': 'Tuition per month'}).json()
        self.assertIn('500', reply['answer'])

    def test_connection_edits_are_owned_validated_and_rollback_with_workbook(self):
        agent = self.client.post('/api/agents', json={'name': 'Editable', 'domain': 'HR', 'type': 'Chat'}).json()
        endpoint = f"/api/agents/{agent['id']}/connections"
        self.assertEqual(self.client.put(endpoint, json={'integrations': ['not_a_provider']}).status_code, 400)
        manifest = (self.root / agent['code_path']).parent / 'agent.json'
        previous = manifest.read_bytes()
        with patch('database.store.os.replace', side_effect=PermissionError('locked')):
            self.assertEqual(self.client.put(endpoint, json={'integrations': ['whatsapp']}).status_code, 503)
        self.assertEqual(manifest.read_bytes(), previous)
        updated = self.client.put(endpoint, json={'integrations': ['whatsapp'], 'channels': ['whatsapp']}).json()
        self.assertEqual(updated['execution_status'], 'draft')
        self.assertIn('whatsapp', json.loads(manifest.read_text())['integrations'])
        self.client.post('/api/auth/logout')
        self.assertEqual(self.client.put(endpoint, json={}).status_code, 401)

    def test_incompatible_multi_engine_selection_is_saved_without_fake_execution(self):
        response = self.client.post('/api/agents', json={
            'name': 'Chat plus analytics', 'domain': 'HR', 'primary_capability': 'chat',
            'capabilities': ['chat', 'analytics'],
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['execution_status'], 'draft')
