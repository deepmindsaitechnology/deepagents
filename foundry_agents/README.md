# Foundry agents

`catalog.json` lists the built-in templates. Each named template has its own folder:

```
<template-name>/
  agent.json
  agent.py
  prompts/system.md
  knowledge/
    documents/
    extracted/
    datasets/
    indexes/
```

Edit the template's `prompts/system.md` to change its system instructions. Place TXT, MD, selectable-text PDF, or DOCX reference files in its `knowledge/documents/` for local TF-IDF retrieval during template conversations. These files are reference data, never system instructions. Template documents are shared defaults and must not contain private user data. Existing limits on extraction size and chunk count apply. Template retrieval is calculated in memory; user embeddings remain in the workbook.

`capabilities/` holds shared Python base implementations for Chat, Voice, Document, Analysis, Workflow, and Agent Team. Each template's `agent.py` and each user agent extends a capability. User folders and knowledge are independent; changing a template prompt does not change an existing user's prompt.
