"""
Модуль расширенной предварительной обработки документов и индексации в Qdrant (Advanced RAG Ingestion).
Включает глубокую нормализацию, лечение омоглифов, иерархический чанкинг со скользящим перекрытием (Overlap),
линеаризацию сложных таблиц и инъекцию контекстных метаданных (Contextual Prefixing).
"""

import os
import re
import sys
import uuid
import argparse
import unicodedata
from pathlib import Path
from typing import List, Dict, Any, Optional

import time
import requests
import pymupdf4llm
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance

# Гарантируем, что локальные сервисы Docker (Qdrant, TEI) не заворачиваются в системный прокси
_curr_no_proxy = os.environ.get("NO_PROXY", "")
os.environ["NO_PROXY"] = f"{_curr_no_proxy},localhost,127.0.0.1,0.0.0.0".strip(",")
os.environ["no_proxy"] = os.environ["NO_PROXY"]


# Карта соответствий визуально идентичных букв: Latin -> Cyrillic
HOMOGLYPH_MAP = {
    'a': 'а', 'c': 'с', 'e': 'е', 'o': 'о', 'p': 'р', 'x': 'х', 'y': 'у',
    'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'H': 'Н', 'K': 'К', 'M': 'М',
    'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х'
}


def heal_homoglyphs(text: str) -> str:
    """
    Устраняет омоглифы: случайные латинские буквы внутри преимущественно русских слов.
    Чисто англоязычные термины (Windows, CPU, Chrome, XML, ID, RAM) не изменяются.
    """
    def fix_word(match):
        word = match.group(0)
        cyr_count = sum(1 for ch in word if 'а' <= ch <= 'я' or 'А' <= ch <= 'Я' or ch in 'ёЁ')
        lat_count = sum(1 for ch in word if 'a' <= ch <= 'z' or 'A' <= ch <= 'Z')

        # Если в слове есть кириллица и её больше либо равно латинице, заменяем латинские омоглифы
        if cyr_count > 0 and cyr_count >= lat_count:
            return "".join(HOMOGLYPH_MAP.get(ch, ch) for ch in word)
        return word

    return re.sub(r'\b[а-яА-ЯёЁa-zA-Z]+\b', fix_word, text)


def clean_text(raw_text: str) -> str:
    """
    Глубокая символьная и типографическая нормализация текста:
    1. Unicode NFKC (лигатуры, спец-символы, экзотические пробелы)
    2. Удаление мягких переносов и невидимых символов (\u00ad, \u200b-\u200f)
    3. Дегифенация (склейка переносов слов на концах строк: "докумен-\nтация" -> "документация")
    4. Исправление омоглифов
    5. Очистка системного мусора Word/PDF (битые ссылки, колонтитулы, номера страниц)
    6. Унификация списков и кавычек
    7. Схлопывание лишних пробелов без поломки абзацев
    """
    if not raw_text:
        return ""

    # 0. Удаление мусора распознавания картинок/скриншотов и комментариев
    text = re.sub(r'<!--\s*Start of picture text\s*-->.*?<!--\s*End of picture text\s*-->', '', raw_text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # 1. Очистка HTML-тегов (<br>, <mark>, <u>, etc.)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<mark[^>]*>(.*?)</mark>', r'\1', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<u[^>]*>(.*?)</u>', r'\1', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)

    # 2. Удаление непечатных символов PUA (\uf000-\uf8ff) и символов замены \ufffd
    text = re.sub(r'[\uf000-\uf8ff\ufffd]', '', text)

    # 3. NFKC нормализация Unicode
    text = unicodedata.normalize("NFKC", text)

    # 4. Невидимые пробелы, мягкие переносы и неразрывные пробелы
    text = re.sub(r'[\u00ad\u200b\u200c\u200d\u200e\u200f]', '', text)
    text = text.replace('\u00a0', ' ')

    # 5. Дегифенация (склейка переносов слов)
    text = re.sub(r'(\b[а-яА-ЯёЁa-zA-Z]+)-\n\s*([а-яА-ЯёЁa-zA-Z]+\b)', r'\1\2', text)

    # 6. Исправление омоглифов
    text = heal_homoglyphs(text)

    # 7. Очистка системного мусора Word/PDF
    text = re.sub(r'\(?Ошибка!\s*Источник ссылки не найден\.?\)?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\(?(?:см\.\s*)?Рисунок\s*\d+\)?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)  # изолированные номера страниц
    text = re.sub(r'^.*?(?:Версия документа|Лист \d+).*?$', '', text, flags=re.MULTILINE | re.IGNORECASE)

    # 8. Нормализация кавычек, спецсимволов Word (квадратики чекбоксов □) и списков
    text = re.sub(r'[«»“”„]', '"', text)
    text = re.sub(r'^[—–•*□■]\s*', '- ', text, flags=re.MULTILINE)
    text = text.replace('□', '- ').replace('■', '- ')

    # 9. Схлопывание множественных пробелов и пустых строк
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def parse_markdown_table_to_kv(table_md: str) -> List[str]:
    """
    Преобразует длинную Markdown-таблицу в список Key-Value строк.
    Каждая строка таблицы превращается в компактное самодостаточное описание с заголовками колонок.
    """
    lines = [l.strip() for l in table_md.strip().split('\n') if l.strip()]
    if len(lines) < 2:
        return [table_md]

    # Извлекаем заголовки колонок
    header_line = lines[0]
    headers = [c.strip() for c in header_line.strip('|').split('|')]

    # Пропускаем строку разделителя (|---|---|)
    start_idx = 1
    if len(lines) > 1 and re.match(r'^[\|\s\-\:]+$', lines[1]):
        start_idx = 2

    kv_chunks = []
    for row_line in lines[start_idx:]:
        cells = [c.strip() for c in row_line.strip('|').split('|')]
        row_parts = []
        for i, val in enumerate(cells):
            if val and i < len(headers) and headers[i]:
                row_parts.append(f"{headers[i]}: {val}")
            elif val:
                row_parts.append(val)
        if row_parts:
            kv_chunks.append(" | ".join(row_parts))

    return kv_chunks


def detect_data_type(text: str, breadcrumb: str) -> str:
    """Определяет семантический тип данных чанка для метаданных."""
    combined = (text + " " + breadcrumb).lower()
    if any(k in combined for k in ["требования к арм", "программное обеспечение", "скзи", "криптопро", "браузер", "ос windows"]):
        return "Системные требования"
    if any(k in combined for k in ["порядок подачи", "подача оферты", "ценовое предложение", "заявка", "аукцион"]):
        return "Порядок проведения процедур"
    if any(k in combined for k in ["срок", "дней", "календарных", "регламентный срок", "рассмотрение"]):
        return "Сроки и регламенты"
    if any(k in combined for k in ["таблица", "параметр", "характеристика"]):
        return "Табличные параметры"
    return "Общий регламент"


def extract_chunks_from_pdf(
    pdf_path: str,
    doc_name: Optional[str] = None,
    support_line: str = "L2",
    target_chunk_chars: int = 1000,
    overlap_chars: int = 200
) -> List[Dict[str, Any]]:
    """
    Структурированный парсинг PDF с гарантированным перекрытием (Chunk Overlap),
    неразрывными списками и контекстными префиксами.
    """
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        raise FileNotFoundError(f"Файл не найден: {pdf_path}")

    actual_doc_name = doc_name or pdf_file.name
    print(f"Парсинг {pdf_file.name} через PyMuPDF4LLM...")

    pages_data = pymupdf4llm.to_markdown(str(pdf_file), page_chunks=True)
    print(f"Извлечено {len(pages_data)} страниц. Нарезка со скользящим перекрытием...")

    chunks: List[Dict[str, Any]] = []
    current_h1 = "Общие положения"
    current_h2 = ""
    current_h3 = ""

    # Буфер строк для сборки чанков с перекрытием
    rolling_lines: List[str] = []
    current_page = 1

    for page_info in pages_data:
        raw_page = page_info.get("metadata", {}).get("page_number")
        if raw_page is None:
            raw_page = (page_info.get("metadata", {}).get("page", 0) or 0) + 1
        current_page = raw_page

        raw_text = clean_text(page_info.get("text", ""))
        if not raw_text.strip():
            continue

        lines = raw_text.split("\n")
        in_table = False
        table_buffer: List[str] = []

        for line in lines:
            stripped = line.strip()

            # Игнорируем строки оглавления / содержания (например: "1.1 Профиль ... 3")
            if re.search(r'\.{4,}\s*\d+', stripped) or stripped.lower().replace('#', '').strip() in ["содержание", "оглавление"]:
                continue

            # Отслеживание иерархии заголовков
            if stripped.startswith("# "):
                current_h1 = re.sub(r'[*#_]', '', stripped.lstrip("# ")).strip()
                current_h2 = ""
                current_h3 = ""
            elif stripped.startswith("## "):
                current_h2 = re.sub(r'[*#_]', '', stripped.lstrip("## ")).strip()
                current_h3 = ""
            elif stripped.startswith("### "):
                current_h3 = re.sub(r'[*#_]', '', stripped.lstrip("### ")).strip()

            # Детекция строк таблиц
            if stripped.startswith("|") and stripped.endswith("|"):
                in_table = True
                table_buffer.append(stripped)
                continue
            else:
                if in_table and table_buffer:
                    if len(table_buffer) > 8:
                        kv_rows = parse_markdown_table_to_kv("\n".join(table_buffer))
                        for kv in kv_rows:
                            rolling_lines.append(f"- {kv}")
                    else:
                        rolling_lines.extend(table_buffer)
                    table_buffer = []
                    in_table = False

            if stripped:
                rolling_lines.append(line)

            # Проверяем, достиг ли буфер желаемого размера чанка
            current_buffer_text = "\n".join(rolling_lines)
            if len(current_buffer_text) >= target_chunk_chars:
                cleaned_body = clean_text(current_buffer_text)
                if len(cleaned_body) >= 80:
                    breadcrumb = " > ".join(filter(None, [current_h1, current_h2, current_h3]))
                    breadcrumb = re.sub(r'[*#_]', '', breadcrumb).strip()
                    data_type = detect_data_type(cleaned_body, breadcrumb)

                    prefixed_chunk = (
                        f"[ДОКУМЕНТ]: {actual_doc_name}\n"
                        f"[ПУТЬ]: {breadcrumb}\n"
                        f"[СТРАНИЦА]: {current_page}\n"
                        f"[ТИП ДАННЫХ]: {data_type}\n\n"
                        f"{cleaned_body}"
                    )

                    chunks.append({
                        "text": prefixed_chunk,
                        "metadata": {
                            "doc_name": actual_doc_name,
                            "breadcrumb": breadcrumb,
                            "page": current_page,
                            "support_line": support_line,
                            "data_type": data_type,
                            "char_length": len(prefixed_chunk)
                        }
                    })

                # Реализация скользящего перекрытия (Overlap):
                # Сохраняем последние N строк (суммарно ~overlap_chars), а не очищаем весь буфер в ноль!
                overlap_buffer = []
                acc_chars = 0
                for prev_line in reversed(rolling_lines):
                    overlap_buffer.insert(0, prev_line)
                    acc_chars += len(prev_line)
                    if acc_chars >= overlap_chars:
                        break
                rolling_lines = overlap_buffer

        # Сброс остатка таблицы при переходе страницы
        if in_table and table_buffer:
            if len(table_buffer) > 8:
                kv_rows = parse_markdown_table_to_kv("\n".join(table_buffer))
                for kv in kv_rows:
                    rolling_lines.append(f"- {kv}")
            else:
                rolling_lines.extend(table_buffer)
            table_buffer = []

    # Завершающий чанк из остатка буфера
    if rolling_lines:
        remaining_text = "\n".join(rolling_lines)
        cleaned_body = clean_text(remaining_text)
        if len(cleaned_body) >= 50:
            breadcrumb = " > ".join(filter(None, [current_h1, current_h2, current_h3]))
            breadcrumb = re.sub(r'[*#_]', '', breadcrumb).strip()
            data_type = detect_data_type(cleaned_body, breadcrumb)
            prefixed_chunk = (
                f"[ДОКУМЕНТ]: {actual_doc_name}\n"
                f"[ПУТЬ]: {breadcrumb}\n"
                f"[СТРАНИЦА]: {current_page}\n"
                f"[ТИП ДАННЫХ]: {data_type}\n\n"
                f"{cleaned_body}"
            )
            chunks.append({
                "text": prefixed_chunk,
                "metadata": {
                    "doc_name": actual_doc_name,
                    "breadcrumb": breadcrumb,
                    "page": current_page,
                    "support_line": support_line,
                    "data_type": data_type,
                    "char_length": len(prefixed_chunk)
                }
            })

    print(f"Сформировано {len(chunks)} непрерывных чанков со скользящим перекрытием.")
    return chunks


class QdrantKBIndexer:
    """
    Клиент для векторной базы данных Qdrant и сервиса эмбеддингов (TEI / bge-m3).
    Использует официальный SDK qdrant-client через REST (prefer_grpc=False).
    """
    def __init__(
        self,
        qdrant_url: str = "http://localhost:6333",
        tei_url: str = "http://localhost:8080/embed",
        vector_size: int = 1024
    ):
        self.qdrant_url = qdrant_url.rstrip("/")
        self.tei_url = tei_url.rstrip("/")
        if not self.tei_url.endswith("/embed"):
            self.tei_url = f"{self.tei_url}/embed"
        self.vector_size = vector_size
        self.session = requests.Session()
        self.client = QdrantClient(url=self.qdrant_url, prefer_grpc=False, check_compatibility=False)

    def ensure_collection(self, collection_name: str):
        """Создает коллекцию с Cosine distance, если она еще не существует."""
        if not self.client.collection_exists(collection_name=collection_name):
            print(f"Создание новой коллекции Qdrant '{collection_name}' (dim={self.vector_size}, distance=COSINE)...")
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE)
            )
            print(f"Коллекция '{collection_name}' успешно создана.")
        else:
            print(f"Коллекция Qdrant '{collection_name}' уже существует.")

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Получает векторные представления через TEI (bge-m3)."""
        try:
            response = self.session.post(self.tei_url, json={"inputs": texts}, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.ConnectionError:
            raise ConnectionError(
                f"Не удалось подключиться к сервису эмбеддингов TEI по адресу '{self.tei_url}'. "
                f"Убедитесь, что запущен docker compose: `docker compose up -d tei`."
            )

    def wait_for_tei(self, timeout_seconds: int = 180):
        """Ожидает полной готовности TEI (когда модель скачается и загрузится в память)."""
        health_url = self.tei_url.replace("/embed", "/health")
        start = time.time()
        while time.time() - start < timeout_seconds:
            try:
                res = self.session.get(health_url, timeout=3)
                if res.status_code == 200:
                    print("Сервис эмбеддингов готов к работе.")
                    return
                elif res.status_code == 503:
                    elapsed = int(time.time() - start)
                    print(f"TEI прогревается (модель загружается в память, {elapsed}с)... Ожидание готовности", end="\r")
            except Exception:
                print("Ожидание запуска контейнера TEI...", end="\r")
            time.sleep(4)
        print("\nПредупреждение: таймаут ожидания TEI, пробуем выполнить запрос напрямую...")

    def upsert_chunks(
        self,
        collection_name: str,
        chunks: List[Dict[str, Any]],
        batch_size: int = 8,
        recreate: bool = False
    ):
        """Пакетное получение эмбеддингов и загрузка PointStruct в Qdrant."""
        if recreate and self.client.collection_exists(collection_name):
            print(f"Пересоздание коллекции '{collection_name}' (очистка старых данных)...")
            self.client.delete_collection(collection_name)
        self.ensure_collection(collection_name)
        self.wait_for_tei()
        total = len(chunks)
        print(f"Загрузка {total} чанков в коллекцию '{collection_name}' батчами по {batch_size}...")

        for i in range(0, total, batch_size):
            batch = chunks[i:i + batch_size]
            texts = [c["text"] for c in batch]

            try:
                embeddings = self.get_embeddings(texts)
            except Exception as e:
                print(f"Ошибка при получении эмбеддингов от TEI ({self.tei_url}): {e}")
                raise

            points = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embeddings[j],
                    payload={
                        "page_content": item["text"],
                        **item["metadata"]
                    }
                )
                for j, item in enumerate(batch)
            ]

            self.client.upsert(collection_name=collection_name, points=points)

            processed = min(i + batch_size, total)
            print(f"Прогресс: загружено {processed}/{total} ({int(processed / total * 100)}%)")

        print("Индексация в Qdrant успешно завершена!")


def main():
    parser = argparse.ArgumentParser(description="Предобработка PDF регламентов и загрузка в Qdrant")
    parser.add_argument("pdf", type=str, nargs="?", default=None, help="Путь к PDF файлу")
    parser.add_argument("--pdf", dest="pdf_flag", type=str, default=None, help="Путь к PDF файлу (через флаг)")
    parser.add_argument("--doc-name", type=str, default=None, help="Отображаемое имя документа")
    parser.add_argument("--collection", type=str, default="kb_support", help="Имя коллекции в Qdrant")
    parser.add_argument("--line", type=str, default="L2", choices=["L1", "L2", "L3"], help="Линия поддержки")
    parser.add_argument("--qdrant-url", type=str, default="http://localhost:6333", help="URL Qdrant")
    parser.add_argument("--tei-url", type=str, default="http://localhost:8080/embed", help="URL TEI bge-m3")
    parser.add_argument("--batch-size", type=int, default=8, help="Размер батча при эмбеддинге")
    parser.add_argument("--recreate", action="store_true", help="Очистить и пересоздать коллекцию перед загрузкой")

    args = parser.parse_args()
    pdf_path = args.pdf or args.pdf_flag
    if not pdf_path:
        parser.error("Укажите путь к PDF файлу: python preprocessing.py <файл.pdf>")

    chunks = extract_chunks_from_pdf(
        pdf_path=pdf_path,
        doc_name=args.doc_name,
        support_line=args.line
    )

    indexer = QdrantKBIndexer(
        qdrant_url=args.qdrant_url,
        tei_url=args.tei_url,
        vector_size=1024
    )
    indexer.upsert_chunks(
        collection_name=args.collection,
        chunks=chunks,
        batch_size=args.batch_size,
        recreate=args.recreate
    )


if __name__ == "__main__":
    main()
