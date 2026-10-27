import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
import app
from api import agents, analysis
from foundry_agents import registry
from services import workspaces
from platform_core import config
from platform_core.store import ExcelStore
from pathlib import Path


class PlatformCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.patches = [
            patch.dict(
                os.environ, {"GROQ_API_KEY": "", "IMPORT_LEGACY_SQLITE": "false"}
            ),
            patch.object(config, "GOOGLE_CONFIGURED", False),
            patch.object(config, "SESSION_SECRET", "test-session-secret-" * 3),
        ]
        self.patches += [
            patch.object(module, "ROOT", self.root)
            for module in (agents, analysis, registry, workspaces)
        ]
        for item in self.patches:
            item.start()
        self.store = ExcelStore(self.root / "platform.xlsx")
        self.application = app.create_app(self.store)
        self.client = TestClient(self.application)
        self.client.post("/api/auth/demo")

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()
