import json
from fastapi import HTTPException
from backend.core.config import ROOT


def catalog(filename="catalog.json"):
    templates = json.loads((ROOT / "foundry_agents" / filename).read_text())
    for template in templates:
        template["instructions"] = (ROOT / template["prompt_path"]).read_text()
        folder = ROOT / template["knowledge_path"] / "documents"
        template["documents"] = [
            {"filename": p.name, "chunks": 0, "sample": True}
            for p in sorted(folder.iterdir()) if p.is_file() and not p.name.startswith(".")
        ]
    return templates


def get_template(template_id):
    for template in catalog():
        if template["template_id"] == template_id:
            return template
    for template in catalog("legacy_catalog.json"):
        if template["template_id"] == template_id:
            return template
    raise HTTPException(404, "Foundry template not found.")
