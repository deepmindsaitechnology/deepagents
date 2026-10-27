import hashlib
import json
import re
import unicodedata
import uuid
import shutil
from platform_core.config import ROOT
from foundry_agents.registry import HANDLERS, MODULES


def owner_folder(owner_id):
    return hashlib.sha256(owner_id.encode()).hexdigest()[:16]


def slugify(name):
    text = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    )
    return re.sub("[^a-z0-9]+", "_", text).strip("_")[:55] or "agent"


def ensure_workspace(agent):
    owner = owner_folder(agent["owner_id"])
    slug = agent.get("slug") or f"{slugify(agent['name'])}_{agent['id']}"
    if not agent.get("slug"):
        while (ROOT / "user_agents" / owner / slug).exists() or (
            ROOT / "user_prompts" / owner / f"{slug}.md"
        ).exists():
            slug = f"{slugify(agent['name'])}_{agent['id']}_{uuid.uuid4().hex[:6]}"
    folder = ROOT / "user_agents" / owner / slug
    prompt = ROOT / "user_prompts" / owner / f"{slug}.md"
    knowledge = ROOT / "knowledge_base/user_agents" / owner / slug
    folder.mkdir(parents=True, exist_ok=True)
    prompt.parent.mkdir(parents=True, exist_ok=True)
    for sub in ("documents", "extracted", "datasets", "indexes"):
        (knowledge / sub).mkdir(parents=True, exist_ok=True)
    code = folder / f"{slug}.py"
    if not code.exists():
        module = MODULES[agent["type"]]
        base = HANDLERS[agent["type"]].__name__
        code.write_text(
            f'"""Trusted local extension for this agent. Uploaded files are never executed."""\nfrom foundry_agents.{module} import {base}\n\n\nclass Agent({base}):\n    def prepare(self, context):\n        # Add developer-written behavior here. Restart after changes.\n        return context\n'
        )
    if not prompt.exists():
        prompt.write_text(agent.get("instructions") or "", encoding="utf-8")
    paths = {
        "slug": slug,
        "prompt_path": prompt.relative_to(ROOT).as_posix(),
        "code_path": code.relative_to(ROOT).as_posix(),
        "knowledge_path": knowledge.relative_to(ROOT).as_posix(),
    }
    (folder / "agent.json").write_text(
        json.dumps(
            {k: agent.get(k) for k in ("id", "name", "domain", "type")} | paths,
            indent=2,
        ),
        encoding="utf-8",
    )
    return paths


def safe_path(relative, allowed):
    path = (ROOT / relative).resolve()
    if not path.is_relative_to((ROOT / allowed).resolve()):
        raise ValueError("Path is outside its managed folder.")
    return path


def prompt_text(agent):
    path = (
        safe_path(agent["prompt_path"], "user_prompts")
        if agent.get("prompt_path")
        else None
    )
    return (
        path.read_text(encoding="utf-8")[:24000]
        if path and path.exists()
        else agent.get("instructions") or ""
    )


def cleanup_new_workspace(agent):
    """Compensate only a freshly generated workspace when its table transaction fails."""
    code = safe_path(agent["code_path"], "user_agents")
    prompt = safe_path(agent["prompt_path"], "user_prompts")
    knowledge = safe_path(agent["knowledge_path"], "knowledge_base/user_agents")
    shutil.rmtree(code.parent, ignore_errors=True)
    shutil.rmtree(knowledge, ignore_errors=True)
    prompt.unlink(missing_ok=True)
