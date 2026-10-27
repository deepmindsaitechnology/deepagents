from foundry_agents.base import BaseAgent
from services.llm import generate_answer


class ChatAgent(BaseAgent):
    async def run(self, context):
        return await generate_answer(context)
