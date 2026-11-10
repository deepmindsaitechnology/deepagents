import importlib.util
from backend.core.config import ROOT
from foundry_agents.capabilities.chat_agent import ChatAgent
from foundry_agents.capabilities.voice_agent import VoiceAgent
from foundry_agents.capabilities.document_agent import DocumentAgent
from foundry_agents.capabilities.analysis_agent import AnalysisAgent
from foundry_agents.capabilities.workflow_agent import WorkflowAgent
from foundry_agents.capabilities.team_agent import TeamAgent

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
    if agent.get("source") in ("user", "foundry") and agent.get("code_path"):
        path = (ROOT / agent["code_path"]).resolve()
        if (
            not path.is_relative_to((ROOT / ("user_agents" if agent["source"] == "user" else "foundry_agents")).resolve())
            or path.suffix != ".py"
        ):
            raise ValueError("Invalid agent extension path.")
        if path.exists():
            spec = importlib.util.spec_from_file_location(
                f"managed_agent_{agent.get('id', agent.get('template_id'))}", path
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if not issubclass(module.Agent, base):
                raise ValueError(
                    "User agent must extend its registered foundry capability."
                )
            return module.Agent()
    return base()
