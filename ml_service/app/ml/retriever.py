"""
Модуль интеллектуального извлечения релевантных чанков (Advanced Multi-Query Retriever).
Включает:
1. Query Expansion / Rewriting (перевод разговорных/непонятных вопросов в термины ГОСТов и регламентов)
2. Multi-Query Retrieval (параллельный поиск по исходному и каноничным запросам)
3. Reciprocal Rank Fusion (RRF) для взвешенного слияния и ранжирования
4. Дедупликацию и сборку связного контекста для LLM
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import requests

from .config import settings
from .schemas import SupportLine, RetrievedChunk
from .reranker import CrossEncoderReranker

logger = logging.getLogger(__name__)


def heading_match(query: str, breadcrumb: str) -> float:
    """Favor the explicitly requested UI section, not a matching ancestor heading."""
    words = re.findall(r"[a-zа-яё0-9]+", query.lower())
    leaf = " ".join(re.findall(r"[a-zа-яё0-9]+", breadcrumb.split(">")[-1].lower()))
    return (
        0.04
        if any(len(a) > 3 and len(b) > 3 and f"{a} {b}" in leaf for a, b in zip(words, words[1:]))
        else 0.0
    )


try:
    from qdrant_client import QdrantClient
except ImportError:
    QdrantClient = None



CANONICAL_SUGGESTION_EXPANSIONS: Dict[str, List[str]] = {
    "какие документы": [
        "перечень документов и требования для регистрации поставщика на портале",
        "документы для участия в котировочной сессии и подачи ценового предложения",
    ],
    "как принять участие": [
        "порядок участия в котировочной сессии и закупке по потребности",
        "подача ценового предложения оферты поставщиком",
    ],
    "как работает электронная подпись": [
        "настройка квалифицированной электронной цифровой подписи ЭЦП КриптоПро CSP",
        "подписание оферты и контракта электронной подписью",
    ],
    "где посмотреть результаты": [
        "просмотр итогов котировочной сессии протокол подведения итогов",
        "статус закупки и реестр заключенных контрактов",
    ],
}


class KBRetriever:
    """Интеллектуальный ретривер с Query Expansion и RRF-ранжированием."""

    def __init__(
        self,
        qdrant_url: Optional[str] = None,
        tei_url: Optional[str] = None,
        vllm_base_url: Optional[str] = None,
        top_k: Optional[int] = None,
        score_threshold: Optional[float] = None,
    ):
        self.qdrant_url = (qdrant_url or settings.QDRANT_URL).rstrip("/")
        self.tei_url = (tei_url or settings.TEI_BASE_URL).rstrip("/")
        self.vllm_base_url = (vllm_base_url or settings.VLLM_BASE_URL).rstrip("/")
        self.top_k = top_k or settings.TOP_K
        self.score_threshold = score_threshold or settings.SCORE_THRESHOLD

        self.session = requests.Session()
        self.client = None
        if QdrantClient is not None:
            try:
                self.client = QdrantClient(
                    url=self.qdrant_url,
                    api_key=settings.QDRANT_API_KEY or None,
                    timeout=30,
                    prefer_grpc=False,
                    check_compatibility=False,
                )
            except Exception as e:
                logger.warning(f"Ошибка подключения к Qdrant ({self.qdrant_url}): {e}")

        self.reranker = CrossEncoderReranker()

    def expand_query(self, user_query: str) -> List[str]:
        """
        Формирует поисковые запросы на основе кодов ошибок и канонических правил.
        Работает детерминированно и мгновенно (0ms), не нагружая малую LLM модельку.
        """
        queries = [user_query]
        q_norm = user_query.lower().strip("?!., \t")

        # Если в запросе указан конкретный код ошибки (РДИК_..., DIT_... и т.д.), не размываем его
        code_candidates = re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]+_\d+", user_query)
        if code_candidates or "рдик" in q_norm:
            for c in code_candidates:
                if c not in queries:
                    queries.append(c)
                digits = re.findall(r"\d+", c)
                if digits and digits[0] not in queries:
                    queries.append(digits[0])
            return queries

        # Проверяем канонические расширения по ключевым фразам
        for trigger, expansions in CANONICAL_SUGGESTION_EXPANSIONS.items():
            if trigger in q_norm:
                for exp in expansions:
                    if exp not in queries:
                        queries.append(exp)
                break

        return queries

    def embed_queries_batch(self, queries: List[str]) -> List[List[float]]:
        """Пакетное получение эмбеддингов для списка поисковых запросов через TEI."""
        embed_url = self.tei_url if self.tei_url.endswith("/embed") else f"{self.tei_url}/embed"
        try:
            response = self.session.post(
                embed_url, json={"inputs": [settings.EMBEDDING_PREFIX + q for q in queries]}, timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Ошибка получения эмбеддингов через TEI ({embed_url}): {e}")
            raise RuntimeError("Embedding service unavailable") from e

    def _load_cache_if_needed(self, collection_name: str) -> None:
        """Предзагружает текстовые пейлоады коллекции в память для мгновенного точного поиска."""
        if hasattr(self, "_cached_collection") and self._cached_collection == collection_name and getattr(self, "_cached_chunks", None):
            return

        # 1. Сначала пробуем загрузить напрямую из локального файла индекса (без сети и таймаутов)
        kb_candidates = [
            os.getenv("KB_PATH"),
            "/knowledge/dense_kb_v1",
            "/knowledge",
            "./knowledge/dense_kb_v1",
            "./.demo/knowledge/dense_kb_v1",
        ]
        for kb_dir in kb_candidates:
            if not kb_dir:
                continue
            path = Path(kb_dir)
            target = path / "chunks.jsonl" if (path / "chunks.jsonl").exists() else path / "dense_kb_v1" / "chunks.jsonl"
            if target.exists():
                try:
                    cached = []
                    for line in target.read_text(encoding="utf-8").splitlines():
                        if not line.strip():
                            continue
                        item = json.loads(line)
                        text = item.get("text") or item.get("page_content", "")
                        if not text:
                            continue
                        headings = item.get("heading_path", [])
                        breadcrumb = " > ".join(headings) if isinstance(headings, list) else (item.get("breadcrumb") or "")
                        chunk = RetrievedChunk(
                            text=text,
                            doc_name=item.get("file") or item.get("doc_name", "Регламент"),
                            breadcrumb=breadcrumb,
                            page=item.get("page_start") or item.get("page"),
                            page_end=item.get("page_end"),
                            edition=None,
                            score=1.0,
                            support_line="L2",
                        )
                        cached.append((chunk, text.lower(), breadcrumb.lower()))
                    if cached:
                        self._cached_chunks = cached
                        self._cached_collection = collection_name
                        logger.info(f"Загружено {len(cached)} чанков из локального индекса {target}")
                        return
                except Exception as e:
                    logger.warning(f"Не удалось прочитать {target}: {e}")

        # 2. Фолбэк: scroll через Qdrant Client с достаточным таймаутом
        client = getattr(self, "client", None)
        if client is None or not hasattr(client, "scroll"):
            return
        try:
            points, _ = self.client.scroll(
                collection_name=collection_name,
                limit=3000,
                with_payload=True,
                with_vectors=False,
            )
            cached = []
            for point in points:
                payload = point.payload or {}
                text = payload.get("page_content") or payload.get("text", "")
                if not text:
                    continue
                chunk = RetrievedChunk(
                    text=text,
                    doc_name=payload.get("doc_name", "Регламент"),
                    breadcrumb=payload.get("breadcrumb", ""),
                    page=payload.get("page"),
                    page_end=payload.get("page_end"),
                    edition=payload.get("edition"),
                    score=1.0,
                    support_line=payload.get("support_line", "L2"),
                )
                cached.append((chunk, text.lower(), (payload.get("breadcrumb") or "").lower()))
            if cached:
                self._cached_chunks = cached
                self._cached_collection = collection_name
                logger.info(f"Загружено {len(cached)} чанков в кэш поиска для коллекции '{collection_name}' из Qdrant")
        except Exception as e:
            logger.warning(f"Не удалось предзагрузить чанки коллекции '{collection_name}': {e}")
            if not getattr(self, "_cached_chunks", None):
                self._cached_chunks = []

    def _search_keyword_matches(self, query: str, collection_name: str) -> List[RetrievedChunk]:
        """Быстрый поиск по точным кодам ошибок, номерам статей и ключевым терминам."""
        self._load_cache_if_needed(collection_name)
        if not getattr(self, "_cached_chunks", None):
            return []

        q_lower = query.lower()

        # Ищем только явные коды с цифрами (например, 'рдик_0217', 'рдик 0217', '44-фз', '223-фз')
        # или жестко ограниченный список критических аббревиатур
        technical_terms = {"мчд", "эцп", "кэп", "скзи", "еис", "егрюл", "егрип", "криптопро", "рутокен", "rutoken", "упд"}

        code_candidates = re.findall(
            r"[а-яА-ЯёЁa-zA-Z0-9_-]*(?:[0-9]+[а-яА-ЯёЁa-zA-Z0-9_-]*|_[а-яА-ЯёЁa-zA-Z0-9_-]+)", q_lower
        )
        codes = [c.strip("-_") for c in code_candidates if len(c.strip("-_")) >= 3]

        for term in technical_terms:
            if re.search(rf"\b{re.escape(term)}\b", q_lower):
                codes.append(term)

        digits = re.findall(r"\d{3,4}", q_lower)
        if "рдик" in q_lower and digits:
            for d in digits:
                codes.append(f"рдик_{d}")
                codes.append(d)

        codes = list(dict.fromkeys(codes))
        if not codes:
            return []

        patterns = list(codes)
        matches = []
        for chunk, text_lower, breadcrumb_lower in self._cached_chunks:
            score = 0.0
            for p in patterns:
                if p in text_lower or p in breadcrumb_lower:
                    score += 0.5 if len(p) <= 4 else 1.0

            if len(codes) >= 2 and all(c in text_lower or c in breadcrumb_lower for c in codes):
                score += 0.5

            if score > 0.0:
                matched_chunk = RetrievedChunk(
                    text=chunk.text,
                    doc_name=chunk.doc_name,
                    breadcrumb=chunk.breadcrumb,
                    page=chunk.page,
                    page_end=chunk.page_end,
                    edition=chunk.edition,
                    score=min(1.0, 0.85 + score * 0.1),
                    support_line=chunk.support_line,
                )
                matches.append((score, matched_chunk))

        matches.sort(key=lambda x: x[0], reverse=True)
        return [m[1] for m in matches[:4]]

    def search(
        self, query: str, line: SupportLine = SupportLine.L2, limit: Optional[int] = None
    ) -> List[RetrievedChunk]:
        """
        Многоаспектный гибридный поиск:
        1. Точный поиск по кодам ошибок (РДИК_..., DIT_PP, 44-ФЗ и др.)
        2. Query Expansion и плотный векторный поиск в Qdrant
        3. Reciprocal Rank Fusion (RRF) слияние и адаптивное отсечение
        """
        if self.client is None:
            logger.error("QdrantClient не инициализирован.")
            raise RuntimeError("Qdrant client unavailable")

        k = limit or self.top_k
        collection_name = settings.COLLECTION_L1 if line == SupportLine.L1 else settings.COLLECTION_L2

        try:
            # 1. Проверяем наличие коллекции
            if not self.client.collection_exists(collection_name):
                if (
                    line == SupportLine.L1
                    and collection_name != settings.COLLECTION_L2
                    and self.client.collection_exists(settings.COLLECTION_L2)
                ):
                    collection_name = settings.COLLECTION_L2
                else:
                    logger.warning(f"Коллекция '{collection_name}' отсутствует в Qdrant.")
                    return []

            merged_results: Dict[str, Dict[str, Any]] = {}
            rrf_k = 60

            # 2. Точный поиск по кодам и ключевым словам (Hybrid retrieval)
            kw_chunks = self._search_keyword_matches(query, collection_name)
            for rank, kw_chunk in enumerate(kw_chunks):
                chunk_key = f"{kw_chunk.doc_name}:{kw_chunk.page}:{kw_chunk.text[:100]}"
                merged_results[chunk_key] = {
                    "chunk": kw_chunk,
                    "rrf_score": 1.0 / (rank + 1),
                    "max_score": kw_chunk.score,
                    "is_keyword_match": True,
                }

            # 3. Query Expansion (расширение до 2-3 формулировок)
            search_queries = self.expand_query(query)
            logger.info(f"Поисковые запросы RAG ({len(search_queries)}): {search_queries}")

            # 4. Пакетный эмбеддинг всех запросов
            query_vectors = self.embed_queries_batch(search_queries)

            # 5. Выполняем поиск по каждому вектору в Qdrant
            search_threshold = max(0.35, self.score_threshold - 0.10)
            for q_idx, vector in enumerate(query_vectors):
                if hasattr(self.client, "query_points"):
                    res = self.client.query_points(
                        collection_name=collection_name,
                        query=vector,
                        limit=max(16, k * 3),
                        score_threshold=search_threshold,
                        with_payload=True,
                    )
                    points = res.points
                else:
                    points = self.client.search(
                        collection_name=collection_name,
                        query_vector=vector,
                        limit=max(16, k * 3),
                        score_threshold=search_threshold,
                    )

                for rank, point in enumerate(points):
                    payload = point.payload or {}
                    text = payload.get("page_content") or payload.get("text", "")
                    if not text:
                        continue

                    chunk_key = f"{payload.get('doc_name')}:{payload.get('page')}:{text[:100]}"
                    rrf_contribution = 1.0 / (rrf_k + rank + 1)
                    raw_score = float(point.score)

                    if chunk_key not in merged_results:
                        merged_results[chunk_key] = {
                            "chunk": RetrievedChunk(
                                text=text,
                                doc_name=payload.get("doc_name", "Регламент"),
                                breadcrumb=payload.get("breadcrumb", ""),
                                page=payload.get("page"),
                                page_end=payload.get("page_end"),
                                edition=payload.get("edition"),
                                score=raw_score,
                                support_line=payload.get("support_line", line.value),
                            ),
                            "rrf_score": rrf_contribution,
                            "max_score": raw_score,
                            "is_keyword_match": False,
                        }
                    else:
                        merged_results[chunk_key]["rrf_score"] += rrf_contribution
                        if raw_score > merged_results[chunk_key]["max_score"]:
                            merged_results[chunk_key]["max_score"] = raw_score
                            merged_results[chunk_key]["chunk"].score = raw_score

            if not merged_results:
                return []

            # 6. Сортировка по комбинации RRF скора, косинусной близости и совпадению заголовка
            ranked_items = sorted(
                merged_results.values(),
                key=lambda x: (
                    (1.5 if x.get("is_keyword_match") else 0.0)
                    + (x["rrf_score"] * 0.7)
                    + (x["max_score"] * 0.3)
                    + heading_match(query, x["chunk"].breadcrumb)
                    + (0.006 if x["chunk"].edition else 0)
                ),
                reverse=True,
            )

            # Отбор кандидатов (берем наиболее релевантные по score_threshold)
            candidate_chunks: List[RetrievedChunk] = []
            for item in ranked_items[:max(12, k * 3)]:
                if item.get("is_keyword_match") or item["max_score"] >= self.score_threshold:
                    candidate_chunks.append(item["chunk"])

            if not candidate_chunks:
                candidate_chunks = [item["chunk"] for item in ranked_items[:k] if item["max_score"] >= search_threshold]

            # Этап 2: Cross-Encoder реранкинг для отсечения шума и выбора лучших чанков
            top_k_final = min(k, 3)
            reranker = getattr(self, "reranker", None)
            if reranker is not None and hasattr(reranker, "rerank"):
                final_chunks = reranker.rerank(query, candidate_chunks, top_k=top_k_final)
            else:
                final_chunks = candidate_chunks[:top_k_final]

            return final_chunks

        except Exception as e:
            logger.error(f"Ошибка при поиске в Qdrant ({collection_name}): {e}")
            raise RuntimeError("Knowledge search unavailable") from e
