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


def import_index(root: Path, url: str, collection: str):
    index = root / "dense_kb_v1"
    manifest = json.loads((index / "manifest.json").read_text())
    if manifest["embedding_dimension"] != 384 or manifest["historical_sources_indexed"]:
        raise ValueError("Expected a manual-only 384-dimensional E5 index")
    for filename, digest in manifest["source_sha256"].items():
        if hashlib.sha256((root / filename).read_bytes()).hexdigest() != digest:
            raise ValueError(f"Source manual changed: {filename}")
    chunks = [json.loads(line) for line in (index / "chunks.jsonl").read_text().splitlines()]
    editions = {}
    for chunk in chunks:
        if chunk["doc"] not in editions:
            match = re.search(r"\d{2}\.\d{2}\.\d{4}v\d+", chunk["text"][:80])
            editions[chunk["doc"]] = match.group() if match else None
    matrix = np.load(index / "embeddings.npy", allow_pickle=False)
    if matrix.shape != (len(chunks), 384) or len(chunks) != manifest["chunk_count"]:
        raise ValueError("Index shape/count mismatch")
    if not np.isfinite(matrix).all() or not np.allclose(np.linalg.norm(matrix, axis=1), 1, atol=0.01):
        raise ValueError("Vectors must be finite normalized embeddings")
    with closing(QdrantClient(url=url, timeout=30, check_compatibility=False)) as client:
        if not client.collection_exists(collection):
            client.create_collection(
                collection, vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE)
            )
        info = client.get_collection(collection)
        if info.config.params.vectors.size != 384:
            raise ValueError("Existing collection uses another embedding model")
        if info.points_count not in (0, len(chunks)):
            raise ValueError("Collection has unexpected data; choose a fresh collection")
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
                            "embedding_model": "multilingual-e5-small",
                            "source_sha256": manifest["source_sha256"][chunk["file"]],
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
                "chunks": count,
                "manuals": len(manifest["source_sha256"]),
                "source_hashes": "verified",
            }
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("/knowledge"))
    parser.add_argument("--url", default="http://qdrant:6333")
    parser.add_argument("--collection", default="manuals_e5_v1")
    args = parser.parse_args()
    import_index(args.root, args.url, args.collection)
