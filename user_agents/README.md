# User agents

Every created agent lives under `<account-hash>/<agent-name>_<id>/`. The account prefix keeps users isolated; the ID prevents name collisions.

```
agent.json
agent.py
prompts/
  system.md
  uploads/             Original uploaded system-prompt documents
knowledge/
  documents/           Original RAG source documents
  extracted/           Extracted RAG text
  datasets/            Analysis CSV/XLSX inputs
  indexes/             Reserved for a future index adapter
```

`prompts/system.md` is authoritative at execution and editable via the prompt API. Uploaded prompt documents are kept apart from RAG documents. `agent.py` extends the chosen shared Foundry capability in `foundry_agents/capabilities/`. It is trusted developer code, never uploaded executable code.

Existing split prompt/knowledge files are copied into this layout at startup, and workbook paths are updated atomically. Original legacy files remain as migration backups. Runtime agent folders are ignored by Git.
