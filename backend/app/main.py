import time
from collections import defaultdict, deque
from contextlib import ExitStack, asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import errors
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout
from pydantic import ValidationError

from . import auth, demo, demo_seed, tickets
from .ai import AiService, HttpAiService, MockAiService
from .config import Settings
from .db import DB
from .limits import RequestLimit
from .models import Credentials
from .moderation import HttpModerationService, ModerationService


def create_app(settings=None, ai_service: AiService | None = None,
               moderation_service: ModerationService | None = None):
    settings = settings or Settings()
    if settings.ai_mode not in {"http", "mock"}:
        raise ValueError("AI_MODE must be 'http' or 'mock'")
    if settings.demo_seed and not settings.demo_accounts:
        raise ValueError("DEMO_SEED requires DEMO_ACCOUNTS=true")

    @asynccontextmanager
    async def lifespan(app):
        with ConnectionPool(
            settings.database_url,
            min_size=1,
            max_size=10,
            timeout=10,
            kwargs={"row_factory": dict_row, "options": "-c timezone=UTC -c statement_timeout=15000"},
        ) as pool:
            pool.wait(timeout=15)
            app.state.pool = pool
            if bool(settings.bootstrap_name) != bool(settings.bootstrap_password):
                raise RuntimeError("Set both BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD")
            if settings.bootstrap_name:
                try:
                    account = Credentials(name=settings.bootstrap_name, password=settings.bootstrap_password)
                except ValidationError:
                    raise RuntimeError(
                        "Invalid bootstrap username or password; password must contain at least 10 characters"
                    ) from None
                with pool.connection() as conn:
                    conn.execute("SELECT pg_advisory_xact_lock(7301951)")
                    if not conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1").fetchone():
                        conn.execute(
                            "INSERT INTO users(name, role, hash) VALUES (%s, 'admin', %s)",
                            (account.name, auth.passwords.hash(account.password)),
                        )
            with pool.connection() as conn:
                if settings.demo_accounts:
                    demo.provision(conn)
                    if settings.demo_seed:
                        demo_seed.seed(conn)
                else:
                    conn.execute(
                        "UPDATE auth_sessions SET revoked_at = clock_timestamp() WHERE revoked_at IS NULL AND user_id IN (SELECT user_id FROM demo_accounts)"
                    )
            with ExitStack() as stack:
                moderation_client = stack.enter_context(httpx.Client(
                    timeout=httpx.Timeout(settings.moderation_timeout, connect=1), follow_redirects=False))
                app.state.moderation_service = moderation_service if moderation_service is not None else (
                    HttpModerationService(moderation_client, settings.moderation_url, settings.moderation_api_key))
                if ai_service is not None:
                    app.state.ai_service = ai_service
                elif settings.ai_mode == "mock":
                    app.state.ai_service = MockAiService()
                else:
                    client = stack.enter_context(
                        httpx.Client(
                            timeout=httpx.Timeout(settings.ai_timeout, connect=5), follow_redirects=False
                        )
                    )
                    app.state.ai_service = HttpAiService(client, settings.ai_url, settings.ai_api_key)
                yield

    app = FastAPI(title="Tender operational API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    attempts = defaultdict(deque)

    @app.middleware("http")
    async def protect_requests(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"} and request.url.path.startswith("/api/"):
            origin = request.headers.get("origin")
            if request.headers.get("x-requested-with") != "tender" or (
                origin and origin not in settings.origins
            ):
                return JSONResponse(
                    {"detail": "Untrusted request origin or missing X-Requested-With: tender"},
                    status_code=403,
                )
            try:
                if int(request.headers.get("content-length", "0")) > 131072:
                    return JSONResponse({"detail": "Request too large"}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "Invalid content length"}, status_code=400)
            if request.url.path in {"/api/auth/login", "/api/auth/register"} or request.url.path.startswith(
                "/api/auth/demo/"
            ):
                now = time.monotonic()
                for key in list(attempts):
                    if not attempts[key] or attempts[key][-1] < now - 60:
                        del attempts[key]
                key = request.client.host if request.client else "unknown"
                bucket = attempts[key]
                while bucket and bucket[0] < now - 60:
                    bucket.popleft()
                if len(bucket) >= settings.auth_rate_limit:
                    return JSONResponse(
                        {"detail": "Too many authentication attempts; try again shortly"},
                        status_code=429,
                        headers={"Retry-After": "60"},
                    )
                bucket.append(now)
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.add_middleware(RequestLimit)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "X-Requested-With"],
    )

    @app.exception_handler(errors.UniqueViolation)
    async def unique_error(request, exc):
        return JSONResponse({"detail": "This username or record already exists"}, status_code=409)

    @app.exception_handler(errors.IntegrityError)
    async def integrity_error(request, exc):
        return JSONResponse(
            {"detail": "The change conflicts with the current data or workflow"}, status_code=409
        )

    @app.exception_handler(errors.TransactionRollback)
    async def concurrency_error(request, exc):
        return JSONResponse({"detail": "A concurrent change occurred; refresh and retry"}, status_code=409)

    @app.exception_handler(PoolTimeout)
    async def pool_error(request, exc):
        return JSONResponse({"detail": "Database busy; retry shortly"}, status_code=503)

    @app.get("/health/live")
    def live():
        return {"status": "ok"}

    @app.get("/health/ready")
    def ready(conn: DB):
        conn.execute("SELECT id FROM auth_sessions LIMIT 0")
        return {"status": "ok"}

    app.include_router(demo.router, prefix="/api", tags=["local demo"])
    app.include_router(auth.router, prefix="/api", tags=["accounts"])
    app.include_router(tickets.router, prefix="/api", tags=["claims"])
    return app


app = create_app()
