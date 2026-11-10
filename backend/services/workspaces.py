from pathlib import Path
import hashlib
import json
import re
import unicodedata
import uuid
import shutil
from backend.core.config import ROOT
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
    if Path(slug).name != slug or slug in (".", ".."):
        raise ValueError("Invalid agent folder name.")
    if not agent.get("slug"):
        while (ROOT / "user_agents" / owner / slug).exists():
            slug = f"{slugify(agent['name'])}_{agent['id']}_{uuid.uuid4().hex[:6]}"
    folder = ROOT / "user_agents" / owner / slug
    prompt = folder / "prompts/system.md"
    knowledge = folder / "knowledge"
    folder.mkdir(parents=True, exist_ok=True)
    prompt.parent.mkdir(parents=True, exist_ok=True)
    for sub in ("documents", "extracted", "datasets", "indexes"):
        (knowledge / sub).mkdir(parents=True, exist_ok=True)
    (folder / "prompts/uploads").mkdir(parents=True, exist_ok=True)
    code = folder / "agent.py"
    # Copy old artifacts before changing workbook paths. Originals remain available.
    legacy_code = folder / f"{slug}.py"
    if not code.exists() and legacy_code.is_file():
        text = legacy_code.read_text(encoding="utf-8")
        for module in MODULES.values():
            text = text.replace(f"from foundry_agents.{module}", f"from foundry_agents.capabilities.{module}")
        code.write_text(text, encoding="utf-8")
    legacy_prompt = ROOT / "user_prompts" / owner / f"{slug}.md"
    if not prompt.exists() and legacy_prompt.is_file():
        shutil.copy2(legacy_prompt, prompt)
    legacy_knowledge = ROOT / "knowledge_base/user_agents" / owner / slug
    if legacy_knowledge.is_dir():
        for source in legacy_knowledge.rglob("*"):
            if source.is_file():
                target = knowledge / source.relative_to(legacy_knowledge)
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists():
                    shutil.copy2(source, target)
    if not code.exists():
        module = MODULES[agent["type"]]
        base = HANDLERS[agent["type"]].__name__
        code.write_text(
            f'"""Trusted local extension for this agent. Uploaded files are never executed."""\nfrom foundry_agents.capabilities.{module} import {base}\n\n\nclass Agent({base}):\n    def prepare(self, context):\n        # Add developer-written behavior here. Restart after changes.\n        return context\n'
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
            {k: agent.get(k) for k in ("id", "name", "domain", "type", "template_id", "domain_id", "capabilities", "primary_capability", "tools", "integrations", "channels", "approval_required")} | paths,
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
        safe_path(agent["prompt_path"], "user_agents")
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
    shutil.rmtree(code.parent, ignore_errors=True)



def migrate_workspaces(store):
    """Idempotently consolidate legacy files and update paths in one transaction.

    Copies happen before the workbook commit; retries are safe and originals stay intact.
    """
    with store.transaction() as tx:
        for agent in tx.all("agents"):
            expected = f"user_agents/{owner_folder(agent['owner_id'])}/{agent.get('slug') or (slugify(agent['name']) + '_' + str(agent['id']))}/knowledge"
            if agent.get("knowledge_path") == expected:
                continue
            old_knowledge = agent.get("knowledge_path")
            paths = ensure_workspace({**agent, "slug": agent.get("slug") or (slugify(agent["name"]) + "_" + str(agent["id"]))})
            tx.update("agents", agent["id"], paths)
            if not old_knowledge:
                continue
            for table, columns in (("knowledge_documents", ("file_path", "text_path")), ("datasets", ("file_path",))):
                for row in tx.all(table, owner_id=agent["owner_id"], agent_id=agent["id"]):
                    updates = {}
                    for column in columns:
                        value = row.get(column)
                        if value and value.startswith(old_knowledge.rstrip("/") + "/"):
                            updates[column] = paths["knowledge_path"] + value[len(old_knowledge.rstrip("/")):]
                    if updates:
                        tx.update(table, row["id"], updates)
