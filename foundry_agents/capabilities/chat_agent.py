from foundry_agents.capabilities.base import BaseAgent
from integrations.groq import generate_answer


class ChatAgent(BaseAgent):
    async def run(self, context):
        return await generate_answer(context)
