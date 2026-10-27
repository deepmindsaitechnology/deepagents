import os
import tempfile
import unittest
import shutil
import subprocess
import sys
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
import httpx
import app

class PlatformTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = patch.object(app, 'DB', app.Path(self.temp.name) / 'test.db')
        self.db.start()
        self.env = patch.dict(os.environ, {'GROQ_API_KEY': ''})
        self.env.start()
        self.client = TestClient(app.app)

    def tearDown(self):
        self.env.stop()
        self.db.stop()
        self.temp.cleanup()

    def test_agent_persistence(self):
        data = {'name':'Test HR','domain':'HR','type':'Chat','instructions':'Be helpful'}
        self.assertEqual(self.client.post('/api/agents', json=data).status_code, 201)
        self.assertEqual(self.client.get('/api/agents').json()[0]['name'], 'Test HR')

    def test_demo_chat_and_audit(self):
        result = self.client.post('/api/chat', json={'message':'How much leave?'}).json()
        self.assertEqual(result['mode'], 'Demo')
        self.assertIn('fictional', result['answer'])
        self.assertEqual(len(self.client.get('/api/runs').json()), 1)

    def test_reference_lookup(self):
        result = self.client.post('/api/chat', json={'message':'refund window','knowledge':'Refund window: 30 days.\nSupport hours: 9 to 5.'}).json()
        self.assertIn('30 days', result['answer'])

    def test_csv_calculations_and_rejection(self):
        response = self.client.post('/api/analyze', json={'content':'Month,Sales\nJan,10\nFeb,30'})
        self.assertEqual(response.json()['metrics'][0]['sum'], 40)
        self.assertEqual(response.json()['metrics'][0]['average'], 20)
        self.assertEqual(self.client.post('/api/analyze', json={'content':'a,a\n1,2'}).status_code, 400)
        self.assertEqual(self.client.post('/api/analyze', json={'content':'a,b\n1'}).status_code, 400)

    def test_groq_request_and_error(self):
        with patch.dict(os.environ, {'GROQ_API_KEY':'test-key'}):
            with patch('httpx.AsyncClient.post', new_callable=AsyncMock) as post:
                post.return_value = httpx.Response(200, json={'choices':[{'message':{'content':'Generated answer'}}]})
                result = self.client.post('/api/chat', json={'message':'Hello','history':[{'role':'system','content':'invalid'}]}).json()
                self.assertEqual(result['mode'], 'Groq')
                self.assertEqual(len(post.call_args.kwargs['json']['messages']), 2)
                for status, expected in [(401, 'API key'), (403, 'denied access'), (404, 'model'), (429, 'quota'), (503, 'service')]:
                    post.return_value = httpx.Response(status, text='sensitive upstream content')
                    response = self.client.post('/api/chat', json={'message':'Hello'})
                    self.assertEqual(response.status_code, 502)
                    self.assertIn(expected, response.json()['detail'])
                    self.assertIn(str(status), response.json()['detail'])
                    self.assertNotIn('sensitive', response.text)
                    self.assertNotIn('test-key', response.text)

class EnvironmentTests(unittest.TestCase):
    def test_dotenv_load_and_environment_precedence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = app.Path(folder)
            for filename in ('app.py', 'knowledge.py', 'analysis_engine.py'):
                shutil.copy(app.ROOT / filename, root / filename)
            (root / 'static').mkdir()
            (root / '.env').write_text('GROQ_API_KEY=local-test-key\nGROQ_MODEL=local-model\nDEEPAGENT_DB=local.db\n')
            environment = {k: v for k, v in os.environ.items() if k not in ('GROQ_API_KEY', 'GROQ_MODEL', 'DEEPAGENT_DB', 'PYTHON_DOTENV_DISABLED')}
            script = "import app, os; assert os.environ['GROQ_API_KEY']=='local-test-key'; assert app.status()['model']=='local-model'; assert app.DB==app.ROOT/'local.db'"
            subprocess.run([sys.executable, '-c', script], cwd=root, env=environment, check=True)
            environment['GROQ_API_KEY'] = 'injected-test-key'
            script = "import app, os; assert os.environ['GROQ_API_KEY']=='injected-test-key'"
            subprocess.run([sys.executable, '-c', script], cwd=root, env=environment, check=True)

if __name__ == '__main__':
    unittest.main()
