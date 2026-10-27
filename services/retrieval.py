import math
from collections import Counter
from fastapi import HTTPException
from services.documents import MAX_CHUNKS, tokens, embed


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


def retrieve(tx, owner_id, agent_id, query, limit=4):
    index = tx.one("vector_indexes", owner_id=owner_id, agent_id=agent_id)
    if not index:
        return []
    vector = embed(query, index["idf"])
    results = []
    for row in tx.all("knowledge_chunks", owner_id=owner_id, agent_id=agent_id):
        score = sum(
            weight * row["embedding"].get(word, 0) for word, weight in vector.items()
        )
        if score > 0.05:
            results.append(
                {
                    "chunk_id": row["id"],
                    "source": row["source"],
                    "location": row["location"],
                    "text": row["content"],
                    "score": round(score, 4),
                }
            )
    return sorted(results, key=lambda row: row["score"], reverse=True)[:limit]
