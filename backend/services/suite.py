"""Product taxonomy from the proposal; capability status describes current execution."""
import json
from fastapi import HTTPException
from backend.core.config import ROOT

TYPE_CAPABILITIES = {
    "Chat": ["chat"], "Voice": ["voice"], "Analysis": ["analytics"],
    "Document": ["documents", "knowledge"], "Workflow": ["automation"],
    "Agent Team": ["orchestration"],
}
CAPABILITY_TYPES = {
    "chat": "Chat", "voice": "Voice", "analytics": "Analysis",
    "documents": "Document", "knowledge": "Document",
    "automation": "Workflow", "orchestration": "Agent Team",
}


def suite_catalog():
    return json.loads((ROOT / "foundry_agents/suite.json").read_text(encoding="utf-8"))


def domain_id(name):
    for domain in suite_catalog()["domains"]:
        if name == domain["name"] or name in domain["aliases"]:
            return domain["id"]
    return None


def agent_metadata(agent):
    capabilities = agent.get("capabilities") or TYPE_CAPABILITIES[agent["type"]]
    result = {
        "domain_id": agent.get("domain_id") or domain_id(agent["domain"]),
        "capabilities": capabilities,
        "primary_capability": agent.get("primary_capability") or capabilities[0],
        "tools": agent.get("tools") or [],
        "integrations": agent.get("integrations") or [],
        "channels": agent.get("channels") or [],
        "approval_required": agent.get("approval_required") is not False,
    }
    result["execution_status"] = execution_status(result)
    return result


def validate_connections(values):
    catalog = {row['id']: row for row in suite_catalog()['integrations']}
    for key, kind in (("tools", "tool"), ("integrations", "integration")):
        for identifier in values.get(key) or []:
            if identifier not in catalog or catalog[identifier]['kind'] != kind:
                raise HTTPException(400, f"Unknown {kind}: {identifier}")
    if set(values.get('channels') or []) - {'web', 'phone', 'whatsapp', 'instagram', 'email', 'sms'}:
        raise HTTPException(400, 'Unknown deployment channel.')


def normalize_agent(values, template=None):
    values = dict(values)
    template = template or {}
    primary = values.get('primary_capability') or template.get('primary_capability')
    capabilities = values.get('capabilities') or template.get('capabilities') or TYPE_CAPABILITIES.get(values.get('type'), ['chat'])
    primary = primary or capabilities[0]
    valid = {row['id'] for row in suite_catalog()['capabilities']}
    if primary not in valid or set(capabilities) - valid:
        raise HTTPException(400, 'Choose agent categories from the suite catalog.')
    capabilities = list(dict.fromkeys([primary] + capabilities))
    runtime = CAPABILITY_TYPES.get(primary, 'Chat')
    if values.get('type') and values['type'] != runtime:
        raise HTTPException(400, 'Primary agent category does not match the runtime type.')
    for key in ('tools', 'integrations', 'channels'):
        if key not in values:
            values[key] = template.get(key) or []
        values[key] = list(dict.fromkeys(values[key] or []))
    values.update(type=runtime, primary_capability=primary, capabilities=capabilities)
    required_tools = []
    if set(capabilities) & {'documents', 'knowledge'}:
        required_tools.append('knowledge_lookup')
    if primary == 'analytics':
        required_tools.append('spreadsheet_analysis')
    if primary == 'voice':
        required_tools.append('browser_voice')
    values['tools'] = list(dict.fromkeys(values['tools'] + required_tools))
    if primary in ('chat', 'voice', 'documents', 'knowledge'):
        values['integrations'] = list(dict.fromkeys(values['integrations'] + ['groq']))
    validate_connections(values)
    values.update(agent_metadata(values))
    # Status is derived, not persisted as a user-controllable field.
    values.pop('execution_status', None)
    return values


def execution_status(agent):
    suite = suite_catalog()
    caps = {row['id']: row['status'] for row in suite['capabilities']}
    connections = {row['id']: row['status'] for row in suite['integrations']}
    states = [caps.get(identifier, 'Planned') for identifier in agent.get('capabilities') or []]
    states += [connections.get(identifier, 'Planned') for identifier in (agent.get('tools') or []) + (agent.get('integrations') or [])]
    primary = agent.get('primary_capability')
    supported = {
        'chat': {'chat', 'knowledge', 'documents'},
        'voice': {'voice', 'chat', 'knowledge', 'documents'},
        'documents': {'documents', 'knowledge', 'chat'},
        'knowledge': {'knowledge', 'documents', 'chat'},
        'analytics': {'analytics'}, 'automation': {'automation'},
        'orchestration': {'orchestration'},
    }
    if primary and set(agent.get('capabilities') or []) - supported.get(primary, set()):
        return 'draft'
    if primary and 'spreadsheet_analysis' in (agent.get('tools') or []) and primary != 'analytics':
        return 'draft'
    if primary and 'browser_voice' in (agent.get('tools') or []) and primary != 'voice':
        return 'draft'
    if 'Planned' in states or any(channel != 'web' for channel in agent.get('channels') or []):
        return 'draft'
    if 'Simulation' in states:
        return 'simulation'
    if 'Browser demo' in states:
        return 'demo'
    return 'ready'


def require_runnable(agent):
    if execution_status(agent) == 'draft':
        raise HTTPException(409, 'This configuration needs providers or capabilities that are not connected yet. It is saved as a draft.')
