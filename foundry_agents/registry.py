import importlib.util
from platform_core.config import ROOT
from foundry_agents.chat_agent import ChatAgent
from foundry_agents.voice_agent import VoiceAgent
from foundry_agents.document_agent import DocumentAgent
from foundry_agents.analysis_agent import AnalysisAgent
from foundry_agents.workflow_agent import WorkflowAgent
from foundry_agents.team_agent import TeamAgent

HANDLERS = {
    "Chat": ChatAgent,
    "Voice": VoiceAgent,
    "Document": DocumentAgent,
    "Analysis": AnalysisAgent,
    "Workflow": WorkflowAgent,
    "Agent Team": TeamAgent,
}
MODULES = {
    "Chat": "chat_agent",
    "Voice": "voice_agent",
    "Document": "document_agent",
    "Analysis": "analysis_agent",
    "Workflow": "workflow_agent",
    "Agent Team": "team_agent",
}


def handler_for(agent):
    base = HANDLERS[agent["type"]]
    if agent.get("source") == "user" and agent.get("code_path"):
        path = (ROOT / agent["code_path"]).resolve()
        if (
            not path.is_relative_to((ROOT / "user_agents").resolve())
            or path.suffix != ".py"
        ):
            raise ValueError("Invalid agent extension path.")
        if path.exists():
            spec = importlib.util.spec_from_file_location(
                f"user_agent_{agent['id']}", path
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if not issubclass(module.Agent, base):
                raise ValueError(
                    "User agent must extend its registered foundry capability."
                )
            return module.Agent()
    return base()
