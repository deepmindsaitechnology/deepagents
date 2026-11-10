import re

from helpers import PlatformCase
from backend.services.suite import suite_catalog


class FrontendDeliveryTests(PlatformCase):
    def test_workspace_uses_one_versioned_script_and_revalidates_html(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        scripts = re.findall(r'<script src="([^"]+)"', response.text)
        self.assertEqual(len(scripts), 1)
        self.assertRegex(scripts[0], r'^/static/workspace\.js\?v=[0-9a-f]{12}$')
        script = self.client.get(scripts[0])
        self.assertEqual(script.status_code, 200)
        self.assertIn('function playground()', script.text)
        self.assertIn('function legacyPlayground()', script.text)
        self.assertIn('play-category-filter', script.text)
        self.assertIn('play-domain-filter', script.text)
        self.assertIn('function openBuilder(', script.text)

    def test_short_category_names_match_requested_selection(self):
        self.assertEqual([row['short_name'] for row in suite_catalog()['capabilities']], [
            'Chat', 'Voice', 'Analytics', 'Documents', 'Automation', 'Research',
            'Knowledge', 'Communication', 'Creative', 'Video', 'Monitoring',
            'Prediction', 'Computer Action', 'Orchestration',
        ])
