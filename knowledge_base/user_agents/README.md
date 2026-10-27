# User knowledge

`<account-hash>/<agent-name>_<id>/documents/` retains original knowledge uploads. `extracted/` contains extracted plain text. `datasets/` retains analysis uploads. Embeddings and retrieval indexes are stored in the workbook's knowledge_chunks and vector_indexes sheets; the indexes folder is reserved for a future separate vector database. Existing SQLite uploads may only have extracted chunks, because the earlier POC did not retain original binaries. User files are ignored by Git.
