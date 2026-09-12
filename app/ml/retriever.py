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
from typing import List, Dict, Any, Optional
import requests

from .config import settings
from .schemas import SupportLine, RetrievedChunk

logger = logging.getLogger(__name__)

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
        score_threshold: Optional[float] = None
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
                self.client = QdrantClient(url=self.qdrant_url, prefer_grpc=False, check_compatibility=False)
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
                {"role": "user", "content": f"Вопрос пользователя: {user_query}"}
            ],
            "temperature": 0.0,
            "max_tokens": 150,
            "response_format": {"type": "json_object"}
        }

        try:
            url = f"{self.vllm_base_url}/chat/completions"
            res = self.session.post(url, json=payload, headers=self._get_vllm_headers(), timeout=10)
            if res.status_code == 200:
                content = res.json()["choices"][0]["message"]["content"].strip()
                data = json.loads(content)
                expanded = data.get("queries", [])
                for q in expanded:
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
            response = self.session.post(embed_url, json={"inputs": queries}, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Ошибка получения эмбеддингов через TEI ({embed_url}): {e}")
            return []

    def search(
        self,
        query: str,
        line: SupportLine = SupportLine.L2,
        limit: Optional[int] = None
    ) -> List[RetrievedChunk]:
        """
        Многоаспектный поиск с Query Expansion и Reciprocal Rank Fusion (RRF):
        1. Расширяет запрос до 2-3 каноничных терминологических вариантов
        2. Ищет по каждому вектору в Qdrant
        3. Объединяет результаты через формулу RRF и удаляет дубли
        """
        if self.client is None:
            logger.error("QdrantClient не инициализирован.")
            return []

        k = limit or self.top_k
        collection_name = (
            settings.COLLECTION_L1 if line == SupportLine.L1 else settings.COLLECTION_L2
        )

        try:
            # 1. Проверяем наличие коллекции
            if not self.client.collection_exists(collection_name):
                if line == SupportLine.L1 and collection_name != settings.COLLECTION_L2 and self.client.collection_exists(settings.COLLECTION_L2):
                    collection_name = settings.COLLECTION_L2
                else:
                    logger.warning(f"Коллекция '{collection_name}' отсутствует в Qdrant.")
                    return []

            # 2. Query Expansion (расширение до 2-3 формулировок)
            search_queries = self.expand_query(query)
            logger.info(f"Поисковые запросы RAG ({len(search_queries)}): {search_queries}")

            # 3. Пакетный эмбеддинг всех запросов
            query_vectors = self.embed_queries_batch(search_queries)

            # 4. Выполняем поиск по каждому запросу и собираем ранги
            # doc_id / text_hash -> {chunk, rrf_score, best_raw_score}
            merged_results: Dict[str, Dict[str, Any]] = {}
            rrf_k = 60  # Константа RRF

            for q_idx, vector in enumerate(query_vectors):
                if hasattr(self.client, "query_points"):
                    res = self.client.query_points(
                        collection_name=collection_name,
                        query=vector,
                        limit=k * 2,
                        score_threshold=max(0.35, self.score_threshold - 0.1),
                        with_payload=True
                    )
                    points = res.points
                else:
                    points = self.client.search(
                        collection_name=collection_name,
                        query_vector=vector,
                        limit=k * 2,
                        score_threshold=max(0.35, self.score_threshold - 0.1)
                    )

                for rank, point in enumerate(points):
                    payload = point.payload or {}
                    text = payload.get("page_content") or payload.get("text", "")
                    if not text:
                        continue

                    # Уникальный ключ фрагмента (хэш текста или путь + страница)
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
                                score=raw_score,
                                support_line=payload.get("support_line", line.value)
                            ),
                            "rrf_score": rrf_contribution,
                            "max_score": raw_score
                        }
                    else:
                        merged_results[chunk_key]["rrf_score"] += rrf_contribution
                        if raw_score > merged_results[chunk_key]["max_score"]:
                            merged_results[chunk_key]["max_score"] = raw_score
                            merged_results[chunk_key]["chunk"].score = raw_score

            if not merged_results:
                return []

            # 5. Сортировка по комбинации RRF скора и максимальной косинусной близости
            ranked_items = sorted(
                merged_results.values(),
                key=lambda x: (x["rrf_score"] * 0.7) + (x["max_score"] * 0.3),
                reverse=True
            )

            # Отсекаем по финальному порогу релевантности и лимиту k
            final_chunks: List[RetrievedChunk] = []
            for item in ranked_items[:k]:
                if item["max_score"] >= self.score_threshold:
                    final_chunks.append(item["chunk"])

            return final_chunks

        except Exception as e:
            logger.error(f"Ошибка при поиске в Qdrant ({collection_name}): {e}")
            return []
