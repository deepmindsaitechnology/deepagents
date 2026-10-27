from foundry_agents.base import BaseAgent
from services.analysis import make_report


class AnalysisAgent(BaseAgent):
    def run(self, filename, tables):
        return make_report(filename, tables)
