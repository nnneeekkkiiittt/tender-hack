"""Transport adapter for ml-core. Never writes claims or assignments."""

import logging
import os
from hmac import compare_digest
from typing import Annotated

import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from .ml.config import settings
from .ml.pipeline import SupportMLPipeline
from .ml.schemas import RAGResult


class AskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10000)]


class AskResponse(RAGResult):
    answer: str = Field(min_length=1, max_length=20000)
    sources: list[str] = Field(default_factory=list, max_length=30)


def create_app(pipeline_factory=SupportMLPipeline, api_key=None):
    app = FastAPI(title="Tender ML", version="1.0.0")
    token = os.getenv("ML_API_KEY", "") if api_key is None else api_key

    @app.get("/health/live")
    def live():
        return {"status": "ok"}

    @app.get("/health/ready")
    def ready():
        # Liveness is separate: a running wrapper is not proof of a usable knowledge base.
        qheaders = {"api-key": settings.QDRANT_API_KEY} if settings.QDRANT_API_KEY else {}
        vheaders = {"Authorization": f"Bearer {settings.VLLM_API_KEY}"}
        try:
            for url, headers in (
                (settings.TEI_BASE_URL.rstrip("/") + "/health", {}),
                (settings.VLLM_BASE_URL.rstrip("/") + "/models", vheaders),
            ):
                response = requests.get(url, headers=headers, timeout=3)
                response.raise_for_status()
                if url.endswith("/models") and settings.MODEL_NAME not in {
                    model["id"] for model in response.json()["data"]
                }:
                    raise ValueError("Configured model is not served")
            response = requests.get(
                settings.QDRANT_URL.rstrip("/") + f"/collections/{settings.COLLECTION_L2}",
                headers=qheaders,
                timeout=3,
            )
            response.raise_for_status()
            if response.json()["result"].get("points_count", 0) < 1:
                raise ValueError("Knowledge collection is empty")
        except Exception:
            raise HTTPException(503, "ML dependencies or indexed knowledge are not ready") from None
        return {"status": "ready"}

    @app.post("/ask", response_model=AskResponse)
    def ask(body: AskRequest, authorization: str = Header("")):
        if token and not compare_digest(authorization, f"Bearer {token}"):
            raise HTTPException(401, "Invalid ML credentials")
        pipeline = None
        try:
            # Requests sessions are private to this request, not shared across worker threads.
            pipeline = pipeline_factory()
            result = pipeline.process(body.question)
            # Preserve one-to-one numbering with fragments, even on the same source page.
            sources = list(
                " > ".join(filter(None, [c.doc_name, c.breadcrumb]))
                + (
                    f" (стр. {c.page}"
                    + (f"–{c.page_end}" if c.page_end and c.page_end != c.page else "")
                    + ")"
                    if c.page is not None
                    else ""
                )
                + (f" · ред. {c.edition}" if c.edition else "")
                for c in result.citations
            )
            return AskResponse(**result.model_dump(), sources=sources)
        except Exception:
            logging.getLogger(__name__).exception("ML request failed")
            raise HTTPException(503, "ML service unavailable") from None
        finally:
            if pipeline is not None:
                for component in (pipeline.router, pipeline.retriever, pipeline.generator):
                    for attr in ("session", "client"):
                        resource = getattr(component, attr, None)
                        if resource is not None:
                            resource.close()

    return app


app = create_app()
