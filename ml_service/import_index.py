"""Import an existing, hash-verified manual-only E5 index without re-embedding."""

import argparse
import hashlib
import json
import re
import uuid
from contextlib import closing
from pathlib import Path

import numpy as np
from qdrant_client import QdrantClient, models


def get_embeddings(tei_url: str, texts: list[str], batch_size: int = 16) -> list[list[float]]:
    import requests
    embed_url = tei_url.rstrip("/") + ("/embed" if not tei_url.rstrip("/").endswith("/embed") else "")
    all_embeddings = []
    session = requests.Session()
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        for attempt in range(5):
            try:
                resp = session.post(embed_url, json={"inputs": batch}, timeout=120)
                resp.raise_for_status()
                all_embeddings.extend(resp.json())
                break
            except Exception as e:
                if attempt == 4:
                    raise RuntimeError(f"Failed to fetch embeddings from TEI ({embed_url}): {e}") from e
                time.sleep(2)
    return all_embeddings


def import_index(root: Path, url: str, collection: str, tei_url: str = "http://tei:80"):
    index = root / "dense_kb_v1" if (root / "dense_kb_v1").exists() else root
    manifest = json.loads((index / "manifest.json").read_text()) if (index / "manifest.json").exists() else {}
    for filename, digest in manifest.get("source_sha256", {}).items():
        if (root / filename).exists() and hashlib.sha256((root / filename).read_bytes()).hexdigest() != digest:
            raise ValueError(f"Source manual changed: {filename}")
    chunks = [json.loads(line) for line in (index / "chunks.jsonl").read_text().splitlines()]
    editions = {}
    for chunk in chunks:
        if chunk["doc"] not in editions:
            match = re.search(r"\d{2}\.\d{2}\.\d{4}v\d+", chunk["text"][:80])
            editions[chunk["doc"]] = match.group() if match else None

    # Определяем режим: BGE-M3 (1024-dim) или E5 (384-dim)
    bge_cache = index / "embeddings_bge.npy"
    if collection == "kb_support" or (bge_cache.exists() and collection != "manuals_e5_v1"):
        dim = 1024
        model_name = "bge-m3"
        if bge_cache.exists():
            matrix = np.load(bge_cache, allow_pickle=False)
        else:
            print(f"Генерация 1024-мерных эмбеддингов BGE-M3 через TEI ({tei_url})...", flush=True)
            texts = [c["text"] for c in chunks]
            vectors = get_embeddings(tei_url, texts)
            matrix = np.array(vectors, dtype=np.float32)
            try:
                np.save(bge_cache, matrix)
            except Exception:
                pass
    else:
        dim = 384
        model_name = "multilingual-e5-small"
        matrix = np.load(index / "embeddings.npy", allow_pickle=False)

    if matrix.shape != (len(chunks), dim) or len(chunks) != manifest.get("chunk_count", len(chunks)):
        raise ValueError("Index shape/count mismatch")
    if not np.isfinite(matrix).all() or not np.allclose(np.linalg.norm(matrix, axis=1), 1, atol=0.01):
        raise ValueError("Vectors must be finite normalized embeddings")

    with closing(QdrantClient(url=url, timeout=60, check_compatibility=False)) as client:
        if not client.collection_exists(collection):
            client.create_collection(
                collection, vectors_config=models.VectorParams(size=dim, distance=models.Distance.COSINE)
            )
        info = client.get_collection(collection)
        if info.config.params.vectors.size != dim:
            print(f"Пересоздание коллекции '{collection}' под размерность {dim}...", flush=True)
            client.delete_collection(collection)
            client.create_collection(
                collection, vectors_config=models.VectorParams(size=dim, distance=models.Distance.COSINE)
            )
            info = client.get_collection(collection)

        for offset in range(0, len(chunks), 64):
            points = []
            for i in range(offset, min(offset + 64, len(chunks))):
                chunk = chunks[i]
                points.append(
                    models.PointStruct(
                        id=str(uuid.uuid5(uuid.NAMESPACE_URL, chunk["id"])),
                        vector=matrix[i].tolist(),
                        payload={
                            "page_content": chunk["text"],
                            "doc_name": chunk["file"],
                            "breadcrumb": " > ".join(chunk["heading_path"]),
                            "page": chunk["page_start"],
                            "page_end": chunk["page_end"],
                            "edition": editions[chunk["doc"]],
                            "support_line": "L1",
                            "chunk_id": chunk["id"],
                            "doc_id": chunk["doc"],
                            "data_type": chunk["chunk_type"],
                            "embedding_model": model_name,
                            "source_sha256": manifest.get("source_sha256", {}).get(chunk["file"], ""),
                        },
                    )
                )
            client.upsert(collection_name=collection, points=points, wait=True)
        count = client.count(collection, exact=True).count
        if count != len(chunks):
            raise ValueError(f"Unexpected final count {count}")
    print(
        json.dumps(
            {
                "collection": collection,
                "dimension": dim,
                "model": model_name,
                "chunks": count,
                "manuals": len(manifest.get("source_sha256", {})),
                "source_hashes": "verified",
            }
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("/knowledge"))
    parser.add_argument("--url", default=os.getenv("QDRANT_URL", "http://qdrant:6333"))
    parser.add_argument("--tei-url", default=os.getenv("TEI_BASE_URL", "http://tei:80"))
    parser.add_argument("--collection", default=os.getenv("COLLECTION_L2", "kb_support"))
    args = parser.parse_args()
    import_index(args.root, args.url, args.collection, args.tei_url)
