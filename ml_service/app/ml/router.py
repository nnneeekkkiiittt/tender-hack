"""
Модуль классификации интентов и маршрутизации обращений (Router).
Определяет целевую линию поддержки (L1, L2, L3, OUT_OF_SCOPE) через LLM.
"""

import json
import logging
import re
from difflib import SequenceMatcher
from typing import Optional, List, Dict, Tuple
import requests

from .config import settings
from .schemas import SupportLine, RouteDecision

logger = logging.getLogger(__name__)

PORTAL_TAXONOMY: Dict[str, List[str]] = {
    "Личный кабинет пользователя": [
        "Регистрация",
        "Полномочия",
        "Авторизация",
        "Восстановление доступа",
        "Сертификат ЭП",
        "Изменение ЭП",
        "Изменение электронной почты",
        "Настройка уведомлений",
        "Получение уведомлений",
        "Изменение данных пользователя",
        "Сквозная авторизация",
        "Архивация ЛК (ликвидация и иные причины)",
        "Изменение типа компании",
    ],
    "Закупочные процедуры": [
        "Создание Котировочной сессии",
        "Отображение Котировочной сессии",
        "Участие в Котировочной сессии",
        "Создание оферты по Котировочной сессии",
        "Отображение Потребности",
        "Обмен закупками с Региональными информационными системами (РИС)",
        "Создание Потребности",
        "Участие в Потребности",
        "Поиск Закупок",
        "Отображение Закупок",
        "Снятие КС",
        "Снятие блокировки с поставщика",
        "Прямая закупка",
        "Статус закупки",
        "Участие в Котировочной сессии по 46-ФЗ",
    ],
    "Карточка поставщика": [
        "Заполнение заявки",
        "Объединение профилей",
        "Отправка заявка на изменение данных компании",
        "Отображение данных",
        "Статус заявки",
        "Консультация",
    ],
    "Работа с контрактами": [
        "Создание контракта",
        "Дата заключения",
        "Документ контракта",
        "Отображение контрактов",
        "Отправка контракта",
        "Подписание контракта",
        "Протокол разногласий",
        "Обмен контрактами с Региональными информационными системами (РИС)",
        "Расторжение контракта",
        "Статус контракта",
        "Исполнение контракта (неэлектронное исполнение)",
        "Контракты по 46-ФЗ",
        "Консультация",
    ],
    "Работа с СТЕ": [
        "Добавление категории СТЕ",
        "Изменение справочника СТЕ",
        "Массовая загрузка YML",
        "Ошибка заполнения заявки",
        "Ошибка отображения СТЕ",
        "Массовое подписание оферт",
        "Подписание оферты",
        "Отображение оферт в личном кабинете",
        "Заполнение оферты",
        "Создание заявки СТЕ",
        "Статус СТЕ",
        "Необходимы комментарии модератора",
        "Формирование СТЕ для электронного исполнения",
        "Консультация",
    ],
    "Уполномоченный орган (Региональный заказчик)": [
        "Создание профиля компании (УО)",
        "Утверждение заявки (УО)",
        "Статистика региона",
        "Полномочия УО",
        "Консультация",
    ],
    "Электронное исполнение (малый объем)": [
        "Заполнение спецификации исполнения",
        "Установка связи с заказчиком",
        "Подписание и отправка УПД",
        "Статус исполнения",
        "Регистрация в ЭДО",
        "Создание исполнения (заполнение основных полей)",
    ],
    "Электронное исполнение (ЕИС)": [
        "Создание исполнения",
        "Заполнение данных",
        "Формирование УПД (вопросы по ошибкам РДИК)",
        "Отправка УПД и статус исполнения (ошибки интеграции)",
        "Установка связи с ЭДО ЕИС",
        "Формирование УПД (46-ФЗ)",
        "Исполнение по 46- ФЗ",
        "Консультация",
    ],
    "Блокировка личного кабинета": [
        "Причины блокировки",
        "Снятие блокировки",
        "Компания включена в РНП",
        "Компания исключена из РНП",
        "Разблокировка пользователя",
        "Срок блокировки",
    ],
}


def match_canonical(raw_topic: Optional[str], raw_subtopic: Optional[str]) -> Tuple[str, Optional[str]]:
    """
    Семантическое сопоставление ответа LLM со справочником Портала поставщиков.
    Находит наиболее релевантную тему и подтему без ручных регулярок.
    """
    if not raw_topic:
        return "Личный кабинет пользователя", "Регистрация"

    # 1. Поиск наиболее близкой темы
    if raw_topic in PORTAL_TAXONOMY:
        matched_topic = raw_topic
    else:
        best_topic, best_score = "Личный кабинет пользователя", -1.0
        raw_t_lower = raw_topic.lower()
        for t in PORTAL_TAXONOMY:
            score = SequenceMatcher(None, raw_t_lower, t.lower()).ratio()
            if raw_t_lower in t.lower() or t.lower() in raw_t_lower:
                score += 0.5
            if score > best_score:
                best_score = score
                best_topic = t
        matched_topic = best_topic

    available_subtopics = PORTAL_TAXONOMY[matched_topic]
    if not raw_subtopic:
        return matched_topic, available_subtopics[0]

    # 2. Поиск наиболее близкой подтемы внутри темы
    raw_s_lower = raw_subtopic.lower()
    best_sub, best_sub_score = available_subtopics[0], -1.0
    for s in available_subtopics:
        score = SequenceMatcher(None, raw_s_lower, s.lower()).ratio()
        if raw_s_lower in s.lower() or s.lower() in raw_s_lower:
            score += 0.5
        if score > best_sub_score:
            best_sub_score = score
            best_sub = s

    return matched_topic, best_sub


def semantic_taxonomy_search(query: str) -> Tuple[str, str]:
    """
    Семантический поиск наиболее релевантной пары (тема, подтема) по смысловым токенам запроса.
    Ранжирует таксономию при отсутствии ответа LLM без хардкодных правил.
    """
    q_words = set(re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]{3,}", query.lower()))
    if not q_words:
        return "Личный кабинет пользователя", "Регистрация"

    best_pair = ("Личный кабинет пользователя", "Регистрация")
    best_score = -1.0

    for topic, subtopics in PORTAL_TAXONOMY.items():
        t_words = set(re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]{3,}", topic.lower()))
        for subtopic in subtopics:
            s_words = set(re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]{3,}", subtopic.lower()))
            combined = t_words | s_words
            overlap = sum(
                1 for q in q_words if any(w.startswith(q[:4]) or q.startswith(w[:4]) for w in combined)
            )
            score = overlap / (len(combined) ** 0.5)
            if score > best_score:
                best_score = score
                best_pair = (topic, subtopic)

    return best_pair


def classify_topic_subtopic(
    query: str, raw_topic: Optional[str] = None, raw_subtopic: Optional[str] = None
) -> Tuple[str, Optional[str]]:
    """
    Нормализует тему и подтему из ответа нейросетевого классификатора (LLM)
    по официальному рубрикатору Портала поставщиков.
    """
    if raw_topic:
        if raw_topic not in PORTAL_TAXONOMY and len(raw_topic) < 15 and not any(
            t.lower().startswith(raw_topic.lower()[:3]) for t in PORTAL_TAXONOMY
        ):
            return raw_topic, raw_subtopic
        return match_canonical(raw_topic, raw_subtopic)

    return semantic_taxonomy_search(query)


TAXONOMY_PROMPT = """
ОФИЦИАЛЬНЫЙ РУБРИКАТОР ТЕМ И ПОДТЕМ:
1. Личный кабинет пользователя: Регистрация | Полномочия | Авторизация | Восстановление доступа | Сертификат ЭП | Изменение ЭП | Изменение электронной почты | Настройка уведомлений | Получение уведомлений | Изменение данных пользователя | Сквозная авторизация | Архивация ЛК (ликвидация и иные причины) | Изменение типа компании
2. Закупочные процедуры: Создание Котировочной сессии | Отображение Котировочной сессии | Участие в Котировочной сессии | Создание оферты по Котировочной сессии | Отображение Потребности | Обмен закупками с Региональными информационными системами (РИС) | Создание Потребности | Участие в Потребности | Поиск Закупок | Отображение Закупок | Снятие КС | Снятие блокировки с поставщика | Прямая закупка | Статус закупки | Участие в Котировочной сессии по 46-ФЗ
3. Карточка поставщика: Заполнение заявки | Объединение профилей | Отправка заявка на изменение данных компании | Отображение данных | Статус заявки | Консультация
4. Работа с контрактами: Создание контракта | Дата заключения | Документ контракта | Отображение контрактов | Отправка контракта | Подписание контракта | Протокол разногласий | Обмен контрактами с Региональными информационными системами (РИС) | Расторжение контракта | Статус контракта | Исполнение контракта (неэлектронное исполнение) | Контракты по 46-ФЗ | Консультация
5. Работа с СТЕ: Добавление категории СТЕ | Изменение справочника СТЕ | Массовая загрузка YML | Ошибка заполнения заявки | Ошибка отображения СТЕ | Массовое подписание оферт | Подписание оферты | Отображение оферт в личном кабинете | Заполнение оферты | Создание заявки СТЕ | Статус СТЕ | Необходимы комментарии модератора | Формирование СТЕ для электронного исполнения | Консультация
6. Уполномоченный орган (Региональный заказчик): Создание профиля компании (УО) | Утверждение заявки (УО) | Статистика региона | Полномочия УО | Консультация
7. Электронное исполнение (малый объем): Заполнение спецификации исполнения | Установка связи с заказчиком | Подписание и отправка УПД | Статус исполнения | Регистрация в ЭДО | Создание исполнения (заполнение основных полей)
8. Электронное исполнение (ЕИС): Создание исполнения | Заполнение данных | Формирование УПД (вопросы по ошибкам РДИК) | Отправка УПД и статус исполнения (ошибки интеграции) | Установка связи с ЭДО ЕИС | Формирование УПД (46-ФЗ) | Исполнение по 46- ФЗ | Консультация
9. Блокировка личного кабинета: Причины блокировки | Снятие блокировки | Компания включена в РНП | Компания исключена из РНП | Разблокировка пользователя | Срок блокировки
"""

ROUTER_SYSTEM_PROMPT = f"""Ты — интеллектуальный классификатор службы поддержки Портала поставщиков Москвы.

Твоя задача — проанализировать вопрос пользователя и классифицировать его по 3 параметрам:

1. Линия поддержки (line):
- "L1": Базовые типовые вопросы (вход, регистрация, личный кабинет, навигация).
- "L2": Предметные вопросы по закупкам, контрактам, СТЕ, УПД, регламентам, ЭЦП и ошибкам интерфейса (РДИК).
- "L3": ИСКЛЮЧИТЕЛЬНО падение всей серверной инфраструктуры (код 500, упал сервер или база данных).
- "OUT_OF_SCOPE": Не относится к порталу и закупкам (быт, погода, спам).

2. Тема (topic) и подтема (subtopic) СТРОГО из официального рубрикатора:
{TAXONOMY_PROMPT}

Ответь СТРОГО валидным JSON без markdown:
{{"line": "L1" | "L2" | "L3" | "OUT_OF_SCOPE", "topic": "Название темы из рубрикатора", "subtopic": "Название подтемы из рубрикатора"}}"""


class IntentRouter:
    """Классификатор обращений на базе LLM с минимальным latency и защитой."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.base_url = (base_url or settings.VLLM_BASE_URL).rstrip("/")
        self.model_name = model_name or settings.MODEL_NAME
        self.timeout = timeout
        self.session = requests.Session()

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.VLLM_API_KEY and settings.VLLM_API_KEY != "EMPTY":
            headers["Authorization"] = f"Bearer {settings.VLLM_API_KEY}"
        return headers

    def route(self, query: str, history: Optional[List[Dict[str, str]]] = None) -> RouteDecision:
        """
        Классифицирует вопрос пользователя.
        В случае сбоя инференса или некорректного ответа возвращает надежный fallback.
        """
        messages = [{"role": "system", "content": ROUTER_SYSTEM_PROMPT}]

        if history:
            for msg in history[-3:]:
                role = "assistant" if msg.get("role") in ("assistant", "bot") else "user"
                content = msg.get("content", "").strip()
                if content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": query})

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": settings.ROUTER_TEMPERATURE,
            "max_tokens": 150,
            "response_format": {"type": "json_object"},
        }

        try:
            url = f"{self.base_url}/chat/completions"
            response = self.session.post(url, json=payload, headers=self._get_headers(), timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Очистка markdown fences, если модель вернула код-блок
            if content.startswith("```"):
                content = re.sub(r"^```(?:json)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)

            parsed = json.loads(content)

            # Валидация линии через enum
            raw_line = str(parsed.get("line", "L1")).upper().strip()
            try:
                line_enum = SupportLine(raw_line)
            except ValueError:
                logger.warning(f"Неизвестная линия поддержки '{raw_line}', fallback на L1")
                line_enum = SupportLine.L1

            # Защита от ложной классификации: ошибки РДИК, оферт, ЭЦП, валидации — всегда L2
            q_lower = query.lower()
            if (
                "рдик" in q_lower
                or ("ошибк" in q_lower and any(c.isdigit() for c in q_lower))
                or (line_enum == SupportLine.L3 and (
                    "оферт" in q_lower
                    or "сте" in q_lower
                    or "эцп" in q_lower
                    or "подпис" in q_lower
                    or "документ" in q_lower
                ))
            ):
                logger.info(f"Запрос '{query}' перенаправлен на L2 (ошибка бизнес-логики/портала)")
                line_enum = SupportLine.L2

            needs_rag = line_enum in (SupportLine.L1, SupportLine.L2)
            topic, subtopic = classify_topic_subtopic(query, parsed.get("topic"), parsed.get("subtopic"))

            return RouteDecision(
                line=line_enum,
                confidence=max(0.0, min(1.0, float(parsed.get("confidence", 1.0)))),
                topic=topic,
                subtopic=subtopic,
                reasoning=str(parsed.get("reasoning", "")),
                needs_rag=needs_rag,
            )

        except Exception as e:
            logger.warning(f"Ошибка вызова LLM роутера ({e}). Сработал эвристический классификатор.")
            return self._heuristic_fallback(query)

    def _heuristic_fallback(self, query: str) -> RouteDecision:
        """Резервный эвристический классификатор."""
        q_lower = query.lower()

        # L3: Только критические сбои инфраструктуры (500, crash, упал сервер)
        l3_keywords = [
            "500",
            "internal server error",
            "упал сервер",
            "упала база",
            "сервер упал",
            "база упала",
            "traceback",
        ]
        if any(k in q_lower for k in l3_keywords) and "рдик" not in q_lower:
            return RouteDecision(
                line=SupportLine.L3,
                confidence=0.75,
                topic="Технический инцидент",
                reasoning="Сработал эвристический детектор технических сбоев",
                needs_rag=False,
            )

        # OUT_OF_SCOPE: Непрофильные темы
        out_keywords = [
            "рецепт",
            "погода",
            "анекдот",
            "стих",
            "фильм",
            "пирог",
            "шарлотк",
            "гороскоп",
            "песня",
            "привет как дела",
        ]
        if any(k in q_lower for k in out_keywords):
            return RouteDecision(
                line=SupportLine.OUT_OF_SCOPE,
                confidence=0.85,
                topic="Вне контекста системы",
                reasoning="Сработал эвристический фильтр непрофильных запросов",
                needs_rag=False,
            )

        # L2: Технические сбои интерфейса, коды ошибок (РДИК), ЭЦП, документы и регламенты
        l2_keywords = [
            "рдик",
            "ошибка",
            "error",
            "код ошибки",
            "exception",
            "crash",
            "завис",
            "не нажимается",
            "не открывается",
            "баг",
            "белый экран",
            # ЭЦП, криптография, документы, регламенты
            "эцп",
            "подпис",
            "сертификат",
            "криптопро",
            "плагин",
            "заполн",
            "оферт",
            "сте",
            "мчд",
            "доверенност",
            "регламент",
            "гост",
            "фз-",
            "закон",
            "скзи",
            "арм",
            "требован",
            "положен",
            "статья",
            "пункт",
            "закупк",
            "акт",
            "контракт",
        ]
        # L2 / L1: Классифицируем по официальному справочнику портала
        topic, subtopic = classify_topic_subtopic(query)
        line = SupportLine.L2 if any(k in q_lower for k in l2_keywords) else SupportLine.L1

        return RouteDecision(
            line=line,
            confidence=0.75,
            topic=topic,
            subtopic=subtopic,
            reasoning="Маршрутизация по справочнику тем и подтем Портала поставщиков",
            needs_rag=True,
        )
