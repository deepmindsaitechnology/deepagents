from foundry_agents.capabilities.base import BaseAgent
from backend.services.analysis import make_report


class AnalysisAgent(BaseAgent):
    def run(self, filename, tables):
        return make_report(filename, tables)
