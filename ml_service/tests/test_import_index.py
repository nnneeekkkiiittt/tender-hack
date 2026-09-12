import hashlib
import json
from types import SimpleNamespace
from unittest.mock import Mock

import numpy as np
import pytest

from import_index import import_index


def fixture_index(root):
    index = root / "dense_kb_v1"
    index.mkdir()
    (root / "manual.pdf").write_bytes(b"test manual fixture")
    digest = hashlib.sha256(b"test manual fixture").hexdigest()
    (index / "manifest.json").write_text(
        json.dumps(
            {
                "embedding_dimension": 384,
                "historical_sources_indexed": [],
                "source_sha256": {"manual.pdf": digest},
                "chunk_count": 1,
            }
        )
    )
    (index / "chunks.jsonl").write_text(
        json.dumps(
            {
                "id": "test:1",
                "text": "Manual text",
                "file": "manual.pdf",
                "doc": "test",
                "heading_path": ["Setup"],
                "page_start": 1,
                "page_end": 2,
                "chunk_type": "procedure",
            }
        )
    )
    matrix = np.zeros((1, 384), dtype=np.float32)
    matrix[0, 0] = 1
    np.save(index / "embeddings.npy", matrix)


def test_import_validates_and_preserves_payload_without_deleting(tmp_path, monkeypatch):
    fixture_index(tmp_path)
    client = Mock()
    client.collection_exists.return_value = False
    client.get_collection.return_value = SimpleNamespace(
        points_count=0, config=SimpleNamespace(params=SimpleNamespace(vectors=SimpleNamespace(size=384)))
    )
    client.count.return_value = SimpleNamespace(count=1)
    monkeypatch.setattr("import_index.QdrantClient", Mock(return_value=client))
    import_index(tmp_path, "http://test", "test_collection")
    point = client.upsert.call_args.kwargs["points"][0]
    assert point.payload["page_end"] == 2
    assert point.payload["breadcrumb"] == "Setup"
    assert point.payload["embedding_model"] == "multilingual-e5-small"
    assert len(point.vector) == 384
    client.delete_collection.assert_not_called()
    client.close.assert_called_once()


def test_changed_manual_refuses_import_before_database_access(tmp_path, monkeypatch):
    fixture_index(tmp_path)
    (tmp_path / "manual.pdf").write_bytes(b"changed")
    client = Mock()
    monkeypatch.setattr("import_index.QdrantClient", client)
    with pytest.raises(ValueError, match="Source manual changed"):
        import_index(tmp_path, "http://test", "test_collection")
    client.assert_not_called()
