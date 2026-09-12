# Demo assets

`manuals-e5-v1.tar.gz` is a deterministic bundle of the six manuals provided with
the project and their existing `dense_kb_v1` index: 830 pages, 1,276 chunks,
384-dimensional multilingual-E5-small passage embeddings. It contains no
historical tickets, operational database, account credentials, or model weights.
It is committed directly (about 49 MB); no Git LFS, release server, or private
download credentials are required to clone and run this demo.

`models.lock.json` pins the bundle SHA256, immutable model revisions, individual
download URLs, sizes and SHA256 values. Downloads are verified before startup.
Qwen3-4B Q4_K_M comes from Qwen/Qwen3-4B-GGUF (Apache-2.0); embeddings come from
intfloat/multilingual-e5-small (MIT). Their upstream model cards and licenses:

- https://huggingface.co/Qwen/Qwen3-4B-GGUF
- https://huggingface.co/intfloat/multilingual-e5-small

The Qwen download is the official pinned quantization, not the workstation's
older GGUF with unverified download provenance. Architecture and model size are
unchanged. The E5 weight checksum matches the existing index's embedding model.

Manual copyright stays with the respective owners. These are project-provided
materials, not newly licensed by this repository; confirm redistribution rights
before publishing a public copy or distributing outside the intended project.
Replacing the knowledge bundle requires updating its checksum and rebuilding the
index with the same embedding model (or using a new collection/model together).

Weights and extracted assets stay in ignored `.demo/`. The original BGE
preprocessor must not write to this E5 collection.
