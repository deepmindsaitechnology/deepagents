from typing import Literal
from pydantic import BaseModel, Field

AgentType = Literal["Chat", "Voice", "Document", "Analysis", "Workflow", "Agent Team"]


class AgentInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    domain: str = Field(min_length=1, max_length=80)
    type: AgentType
    instructions: str = Field(default="", max_length=24000)


class ChatInput(BaseModel):
    agent_id: int | None = Field(default=None, ge=1)
    template_id: str | None = None
    message: str = Field(min_length=1, max_length=6000)
    agent: str = Field(default="Assistant", max_length=80)
    domain: str = Field(default="General", max_length=80)
    instructions: str = Field(default="", max_length=24000)
    knowledge: str = Field(default="", max_length=20000)
    history: list[dict] = Field(default_factory=list, max_length=20)


class CSVInput(BaseModel):
    content: str = Field(min_length=1, max_length=200000)


class PromptInput(BaseModel):
    instructions: str = Field(max_length=24000)
