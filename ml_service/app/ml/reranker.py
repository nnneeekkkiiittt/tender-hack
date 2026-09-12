"""
Модуль Cross-Encoder реранкинга (Reranker) для повышения точности RAG-выдачи.
Использует легковесный ONNX-рантайм (FlashRank) для оценки релевантности пар (запрос, документ)
с автоматическим плавным переходом на лексический/RRF фолбэк при недоступности модели.
"""

import logging
import re
from typing import List, Optional

from .schemas import RetrievedChunk

logger = logging.getLogger(__name__)

try:
    from flashrank import Ranker, RerankRequest
except ImportError:
    Ranker = None
    RerankRequest = None


class CrossEncoderReranker:
    """
    Двухэтапный реранкер на базе Cross-Attention.
    Оценивает кандидатов, отсекает околотематический шум и оставляет 1-2 лучших фрагмента.
    """

    def __init__(self, model_name: str = "ms-marco-MultiBERT-L-12", cache_dir: str = "/tmp/flashrank"):
        self.model_name = model_name
        self.ranker = None
        if Ranker is not None:
            try:
                self.ranker = Ranker(model_name=self.model_name, cache_dir=cache_dir)
                logger.info(f"FlashRank Cross-Encoder успешно инициализирован ({self.model_name})")
            except Exception as e:
                logger.warning(f"Не удалось инициализировать FlashRank: {e}. Будет использован лексический фолбэк.")

    def _lexical_fallback_score(self, query: str, chunk: RetrievedChunk) -> float:
        """Резервный скоринг на основе пересечения лексем, плотности терминов и кодов с фильтрацией стоп-слов."""
        stopwords = {
            "как", "где", "какие", "какая", "какой", "каком", "какую", "нужны", "нужен", "нужна",
            "что", "это", "для", "или", "при", "под", "над", "без", "все", "всё", "если", "почему",
            "можно", "нужно", "делать", "пожалуйста", "подскажите"
        }
        q_words = set(re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]{3,}", query.lower())) - stopwords
        if not q_words:
            return float(chunk.score)

        text_lower = chunk.text.lower()
        matched = sum(1 for w in q_words if w in text_lower)
        coverage = matched / len(q_words)

        # Бонус за точное вхождение всей фразы или кода ошибки
        code_bonus = 0.5 if any(re.search(r"_[0-9]+", w) and w in text_lower for w in q_words) else 0.0
        exact_phrase_bonus = 0.3 if query.lower() in text_lower else 0.0

        return float(chunk.score) * 0.4 + coverage * 0.4 + code_bonus + exact_phrase_bonus

    def rerank(
        self, query: str, chunks: List[RetrievedChunk], top_k: int = 3
    ) -> List[RetrievedChunk]:
        """
        Реранкинг списка кандидатов.
        Возвращает top_k наиболее релевантных чанков.
        """
        if not chunks:
            return []
        if len(chunks) <= top_k:
            return chunks

        # Если в чанках есть точное совпадение по коду ошибки, сохраняем его на 1 месте
        q_codes = set(re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]+_\d+", query.lower()))
        exact_code_chunks = []
        for c in chunks:
            if any(code in c.text.lower() for code in q_codes):
                exact_code_chunks.append(c)

        if exact_code_chunks:
            # Если есть точный фрагмент с кодом ошибки, он гарантированно идет первым
            return exact_code_chunks[:top_k]

        # 1. Попытка реранкинга через нейросетевой Cross-Encoder (FlashRank)
        if self.ranker is not None and RerankRequest is not None:
            try:
                passages = [
                    {"id": idx, "text": f"{c.breadcrumb}\n{c.text}", "meta": c}
                    for idx, c in enumerate(chunks)
                ]
                req = RerankRequest(query=query, passages=passages)
                results = self.ranker.rerank(req)

                reranked_chunks: List[RetrievedChunk] = []
                for res in results[:top_k]:
                    chunk = res["meta"]
                    chunk.score = float(res.get("score", chunk.score))
                    reranked_chunks.append(chunk)

                if reranked_chunks:
                    logger.info(f"Реранкинг выполнен успешно: отобрано {len(reranked_chunks)} лучших чанков")
                    return reranked_chunks
            except Exception as e:
                logger.warning(f"Ошибка Cross-Encoder реранкинга: {e}. Переключаемся на резервный скоринг.")

        # 2. Резервный скоринг (Lexical / Proximity Fallback)
        scored = [(self._lexical_fallback_score(query, c), c) for c in chunks]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:top_k]]
