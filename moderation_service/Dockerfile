FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.7.8 /uv /usr/local/bin/uv
WORKDIR /service
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev && useradd --create-home moderation
COPY app ./app
COPY data ./data
USER moderation
ENV HF_HUB_OFFLINE=1 TOKENIZERS_PARALLELISM=false
CMD [".venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--no-access-log"]
