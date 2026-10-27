from foundry_agents.base import BaseAgent


class WorkflowAgent(BaseAgent):
    def preview(self):
        return {
            "simulation": True,
            "steps": [
                "Receive request",
                "Classify & check context",
                "Human reviews proposed action",
                "Complete & record outcome",
            ],
        }
