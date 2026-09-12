import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/tender-hack"
        )
    )
    origins: list[str] = field(
        default_factory=lambda: os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080",
        ).split(",")
    )
    cookie_secure: bool = field(default_factory=lambda: os.getenv("COOKIE_SECURE", "false").lower() == "true")
    ai_url: str = field(default_factory=lambda: os.getenv("AI_URL", ""))
    ai_mode: str = field(default_factory=lambda: os.getenv("AI_MODE", "http"))
    ai_api_key: str = field(default_factory=lambda: os.getenv("AI_API_KEY", ""))
    ai_timeout: float = field(default_factory=lambda: float(os.getenv("AI_TIMEOUT", "420")))
    bootstrap_name: str = field(default_factory=lambda: os.getenv("BOOTSTRAP_ADMIN_USERNAME", ""))
    bootstrap_password: str = field(default_factory=lambda: os.getenv("BOOTSTRAP_ADMIN_PASSWORD", ""))
    demo_accounts: bool = field(default_factory=lambda: os.getenv("DEMO_ACCOUNTS", "false").lower() == "true")
    demo_seed: bool = field(default_factory=lambda: os.getenv("DEMO_SEED", "false").lower() == "true")
    auth_rate_limit: int = 30
    moderation_url: str = field(default_factory=lambda: os.getenv('MODERATION_URL', ''))
    moderation_api_key: str = field(default_factory=lambda: os.getenv('MODERATION_API_KEY', ''))
    moderation_timeout: float = field(default_factory=lambda: float(os.getenv('MODERATION_TIMEOUT', '2')))


COOKIE = "tender_session"
SUPPORT_ROLES = {"supportL1", "supportL2", "supportL3"}
