"""Application settings, loaded from environment variables / .env file.

Why pydantic-settings: gives typed, validated config. If DATABASE_URL is
missing or malformed, the app fails fast at startup instead of crashing
later on the first query.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # postgresql+psycopg = SQLAlchemy dialect + psycopg v3 driver
    database_url: str = "postgresql+psycopg://ats_user:ats_dev_password@localhost:5432/ai_ats"

    jwt_secret: str = "dev-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # If unset, the AI service falls back to a deterministic mock so the
    # app still runs end-to-end without spending API credits.
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    upload_dir: str = "uploads"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
