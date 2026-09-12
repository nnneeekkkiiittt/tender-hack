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
import re
from typing import List, Dict, Any, Optional
import requests

from .config import settings
from .schemas import SupportLine, RetrievedChunk

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


QUERY_EXPANDER_SYSTEM_PROMPT = """Ты — эксперт по информационному поиску в регламентах и нормативных документах системы электронных торгов и госзакупок.

Пользователь задал вопрос в службу поддержки (часто на разговорном, неточном или эмоциональном языке).
Твоя задача — сформулировать 2 точных поисковых запроса в строгих терминах официальных регламентов, ГОСТов, документации АРМ и законов о закупках.

ПРИМЕРЫ:
- Вопрос: "почему не подписывается оферта в браузере?"
  Ответ: ["ошибка подписания оферты электронная цифровая подпись ЭЦП", "требования к плагину КриптоПро ЭЦП Browser plug-in"]
- Вопрос: "какая винда нужна?"
  Ответ: ["системные требования к операционной системе АРМ Windows", "минимальные требования к программному обеспечению"]
- Вопрос: "как отправить ценовое если я из мсп?"
  Ответ: ["порядок подачи ценового предложения участниками МСП", "требования к документам оферты субъектов малого предпринимательства"]

ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В ФОРМАТЕ JSON:
{"queries": ["запрос 1", "запрос 2"]}
Не пиши никаких пояснений, только валидный JSON!"""


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
                    timeout=5,
                    prefer_grpc=False,
                    check_compatibility=False,
                )
            except Exception as e:
                logger.warning(f"Ошибка подключения к Qdrant ({self.qdrant_url}): {e}")

    def _get_vllm_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.VLLM_API_KEY and settings.VLLM_API_KEY != "EMPTY":
            headers["Authorization"] = f"Bearer {settings.VLLM_API_KEY}"
        return headers

    def expand_query(self, user_query: str) -> List[str]:
        """
        Перефразирует и расширяет пользовательский запрос в терминологию регламентов.
        В случае сбоя или оффлайна LLM возвращает исходный запрос.
        """
        queries = [user_query]
        payload = {
            "model": settings.MODEL_NAME,
            "messages": [
                {"role": "system", "content": QUERY_EXPANDER_SYSTEM_PROMPT},
                {"role": "user", "content": f"Вопрос пользователя: {user_query}"},
            ],
            "temperature": 0.0,
            "max_tokens": 150,
            "response_format": {"type": "json_object"},
        }

        try:
            url = f"{self.vllm_base_url}/chat/completions"
            res = self.session.post(url, json=payload, headers=self._get_vllm_headers(), timeout=60)
            if res.status_code == 200:
                content = res.json()["choices"][0]["message"]["content"].strip()
                data = json.loads(content)
                expanded = data.get("queries", [])
                for q in expanded[:2]:
                    clean_q = str(q).strip()
                    if clean_q and clean_q not in queries:
                        queries.append(clean_q)
        except Exception as e:
            logger.debug(f"Query expansion пропущен (работаем по исходному запросу): {e}")

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
        if hasattr(self, "_cached_collection") and self._cached_collection == collection_name and hasattr(self, "_cached_chunks") and self._cached_chunks:
            return
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
            self._cached_chunks = cached
            self._cached_collection = collection_name
            logger.info(f"Загружено {len(cached)} чанков в кэш поиска для коллекции '{collection_name}'")
        except Exception as e:
            logger.warning(f"Не удалось предзагрузить чанки коллекции '{collection_name}': {e}")
            self._cached_chunks = []

    def _search_keyword_matches(self, query: str, collection_name: str) -> List[RetrievedChunk]:
        """Быстрый поиск по точным кодам ошибок, номерам статей и ключевым терминам."""
        self._load_cache_if_needed(collection_name)
        if not getattr(self, "_cached_chunks", None):
            return []

        q_lower = query.lower()
        raw_codes = re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]+", q_lower)
        codes = [c for c in raw_codes if len(c) >= 4 or c in ("мчд", "эцп", "скзи", "аис", "еис")]

        patterns = list(codes)
        digits = re.findall(r"\d{3,4}", q_lower)
        if "рдик" in q_lower and digits:
            for d in digits:
                patterns.append(f"рдик_{d}")
                patterns.append(d)

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
            effective_search_threshold = max(0.35, min(self.score_threshold, 0.70) - 0.1)
            for q_idx, vector in enumerate(query_vectors):
                if hasattr(self.client, "query_points"):
                    res = self.client.query_points(
                        collection_name=collection_name,
                        query=vector,
                        limit=max(16, k * 2),
                        score_threshold=effective_search_threshold,
                        with_payload=True,
                    )
                    points = res.points
                else:
                    points = self.client.search(
                        collection_name=collection_name,
                        query_vector=vector,
                        limit=max(16, k * 2),
                        score_threshold=effective_search_threshold,
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

            # Отсекаем по адаптивному порогу релевантности и лимиту k
            effective_threshold = min(self.score_threshold, 0.70)
            final_chunks: List[RetrievedChunk] = []
            for item in ranked_items[:k]:
                if item.get("is_keyword_match") or item["max_score"] >= effective_threshold:
                    final_chunks.append(item["chunk"])

            return final_chunks

        except Exception as e:
            logger.error(f"Ошибка при поиске в Qdrant ({collection_name}): {e}")
            raise RuntimeError("Knowledge search unavailable") from e
