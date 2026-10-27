import json
from fastapi import HTTPException
from platform_core.config import ROOT


def catalog():
    templates = json.loads((ROOT / "foundry_agents/catalog.json").read_text())
    for template in templates:
        template["instructions"] = (ROOT / template["prompt_path"]).read_text()
        folder = ROOT / "knowledge_base/foundry" / template["template_id"]
        template["documents"] = [
            {"filename": p.name, "chunks": 0, "sample": True}
            for p in folder.glob("*.md")
        ]
    return templates


def get_template(template_id):
    for template in catalog():
        if template["template_id"] == template_id:
            return template
    raise HTTPException(404, "Foundry template not found.")
