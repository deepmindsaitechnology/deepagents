# User prompts

One editable Markdown prompt per agent, named `<account-hash>/<agent-name>_<id>.md`. The prompt file is authoritative for execution. Edit locally in VS Code and restart, or use PUT /api/agents/{id}/prompt to synchronize the file and workbook. Uploaded system prompt files are extracted into this Markdown text; they are never executed. User prompt contents are ignored by Git.
