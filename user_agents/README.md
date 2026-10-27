# User agent extensions

Runtime folders are created as `<account-hash>/<agent-name>_<id>/` with an agent JSON manifest and a Python module named after the agent. The generated `Agent` class extends its capability from `foundry_agents/`. Edit `prepare()` for conversation context or override the base methods for additional developer-written behavior. Restart after editing. These are trusted local Python extensions; the web UI never uploads or executes arbitrary code. User data is ignored by Git.
