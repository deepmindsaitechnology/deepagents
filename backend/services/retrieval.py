import math
import re
from collections import Counter
from fastapi import HTTPException
from backend.services.documents import MAX_CHUNKS, tokens, embed
from backend.services.vector_store import search
from backend.services.workspaces import safe_path


def focus_excerpt(text, query, size=900):
    """Keep the densest matching passage, including text following a field label."""
    terms = set(tokens(query))
    hits = [match for match in re.finditer(r"\b\w+\b", text.lower())
            if match.group() in terms]
    if len(text) <= size or not hits:
        return text[:size]
    best = max(hits, key=lambda hit: len({m.group() for m in hits
                                         if hit.start() - 100 <= m.start() < hit.start() + size - 100}))
    start = max(0, best.start() - 100)
    end = min(len(text), start + size)
    return ("…" if start else "") + text[start:end].strip() + ("…" if end < len(text) else "")


def index_chunks(tx, owner_id, agent_id, chunks):
    if len(chunks) > MAX_CHUNKS:
        raise HTTPException(
            413, "Knowledge exceeds 1,000 text chunks. Use fewer or smaller documents."
        )
    frequencies = Counter(
        word for chunk in chunks for word in set(tokens(chunk["text"]))
    )
    idf = {
        word: math.log((1 + len(chunks)) / (1 + count)) + 1
        for word, count in frequencies.items()
    }
    tx.insert(
        "vector_indexes", {"owner_id": owner_id, "agent_id": agent_id, "idf": idf}
    )
    for chunk in chunks:
        tx.insert(
            "knowledge_chunks",
            {
                "owner_id": owner_id,
                "agent_id": agent_id,
                "source": chunk["source"],
                "location": chunk["location"],
                "content": chunk["text"],
                "embedding": embed(chunk["text"], idf),
            },
        )
    # Build at upload time; a later query checks the workbook fingerprint again.
    _search_agent(tx, owner_id, agent_id, {}, 0)


def _search_agent(tx, owner_id, agent_id, vector, limit):
    agent = tx.one("agents", owner_id=owner_id, id=agent_id)
    rows = tx.all("knowledge_chunks", owner_id=owner_id, agent_id=agent_id)
    if not agent or not agent.get("knowledge_path"):
        return [(row, sum(weight * row["embedding"].get(term, 0)
                          for term, weight in vector.items())) for row in rows]
    path = safe_path(agent["knowledge_path"], "user_agents") / "indexes/knowledge.db"
    return search(path, rows, vector, limit)


def retrieve(tx, owner_id, agent_id, query, limit=3):
    index = tx.one("vector_indexes", owner_id=owner_id, agent_id=agent_id)
    if not index:
        return []
    vector = embed(query, index["idf"])
    results = []
    query_terms = set(tokens(query))
    phrase = " ".join(tokens(query))
    for row, score in _search_agent(tx, owner_id, agent_id, vector, max(limit, 12)):
        if score > 0.05:
            content_terms = tokens(row["content"])
            coverage = len(query_terms & set(content_terms)) / max(1, len(query_terms))
            score += coverage + (0.5 if phrase and phrase in " ".join(content_terms) else 0)
            results.append(
                {
                    "chunk_id": row["id"],
                    "source": row["source"],
                    "location": row["location"],
                    "text": focus_excerpt(row["content"], query),
                    "score": round(score, 4),
                }
            )
    return sorted(results, key=lambda row: row["score"], reverse=True)[:limit]


def retrieve_foundry(folder, query, limit=4):
    """Rank local template documents independently of every user's knowledge."""
    from backend.services.documents import extract_text, chunk_document, MAX_FILE_BYTES

    chunks = []
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        if path.stat().st_size > MAX_FILE_BYTES:
            raise HTTPException(413, "Foundry knowledge file exceeds 5 MB.")
        chunks.extend(chunk_document(path.name, extract_text(path.name, path.read_bytes())))
        if len(chunks) > MAX_CHUNKS:
            raise HTTPException(413, "Foundry knowledge exceeds 1,000 chunks.")
    frequencies = Counter(word for chunk in chunks for word in set(tokens(chunk["text"])))
    idf = {word: math.log((1 + len(chunks)) / (1 + count)) + 1 for word, count in frequencies.items()}
    vector = embed(query, idf)
    results = []
    for chunk in chunks:
        embedding = embed(chunk["text"], idf)
        score = sum(weight * embedding.get(word, 0) for word, weight in vector.items())
        if score > 0.05:
            results.append({**chunk, "score": round(score, 4)})
    return sorted(results, key=lambda row: row["score"], reverse=True)[:limit], bool(chunks)
