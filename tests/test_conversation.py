import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
from integrations.groq import generate_answer


class ConversationTests(unittest.IsolatedAsyncioTestCase):
    def context(self, message, **extra):
        return dict(agent="Assistant", domain="General", message=message,
                    indexed=True, sources=[], **extra)

    async def test_small_talk_with_documents_never_waits_for_provider(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), patch(
            "httpx.AsyncClient.post", new_callable=AsyncMock
        ) as post:
            for message in ("hi", "how are you ?", "Thank you!"):
                result = await generate_answer(self.context(message))
                self.assertEqual(result["mode"], "Conversation")
                self.assertTrue(result["answer"])
                self.assertEqual(result["sources"], [])
            post.assert_not_awaited()

    async def test_general_question_with_no_document_match_uses_model(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), patch(
            "httpx.AsyncClient.post", new_callable=AsyncMock
        ) as post:
            post.return_value = httpx.Response(200, json={
                "choices": [{"message": {"content": "Gravity attracts masses."}}]
            })
            result = await generate_answer(self.context("Explain gravity"))
            self.assertEqual(result["mode"], "Groq")
            self.assertIn("Gravity", result["answer"])
            system = post.call_args.kwargs["json"]["messages"][0]["content"]
            self.assertIn("general knowledge", system)
            self.assertIn("do not invent document contents", system)

    async def test_provider_timeout_is_actionable(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), patch(
            "httpx.AsyncClient.post", new_callable=AsyncMock,
            side_effect=httpx.ReadTimeout("timeout")
        ):
            with self.assertRaises(HTTPException) as caught:
                await generate_answer(self.context("Explain gravity"))
            self.assertEqual(caught.exception.status_code, 504)
            self.assertIn("too long", caught.exception.detail)

    async def test_demo_general_question_explains_setup(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            result = await generate_answer(self.context("Explain gravity"))
            self.assertIn("GROQ_API_KEY", result["answer"])

    async def test_document_timeout_returns_excerpt_instead_of_error(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), patch(
            "httpx.AsyncClient.post", new_callable=AsyncMock,
            side_effect=httpx.ReadTimeout("timeout")
        ):
            context = self.context("brokerage remarks")
            context["sources"] = [{"text": "Offers accepted Friday.", "source": "listing.pdf"}]
            result = await generate_answer(context)
            self.assertEqual(result["mode"], "Knowledge lookup")
            self.assertIn("Offers accepted Friday", result["answer"])
            self.assertEqual(len(result["sources"]), 1)
