from foundry_agents.base import BaseAgent


class TeamAgent(BaseAgent):
    def preview(self):
        return {
            "simulation": True,
            "steps": [
                "Researcher gathers references",
                "Analyst prepares findings",
                "Reviewer checks evidence",
                "Human approves final output",
            ],
        }
