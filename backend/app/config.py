from pathlib import Path

from pydantic_settings import BaseSettings


def _read_secret(name: str) -> str | None:
    """Read a Docker secret from /run/secrets/<name> if it exists."""
    path = Path(f"/run/secrets/{name}")
    if path.is_file():
        return path.read_text().strip()
    return None


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/climatedb"
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FIRST_SUPERADMIN_EMAIL: str = "admin@example.com"
    FIRST_SUPERADMIN_PASSWORD: str = "admin123456"
    SHAPEFILE_DIR: str = "./data/shapefiles"
    CORS_ORIGINS: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"

    model_config = {"env_file": ".env", "extra": "ignore"}

    def model_post_init(self, __context) -> None:
        # Docker secrets override env vars when available
        secret_jwt = _read_secret("jwt_secret")
        if secret_jwt:
            self.JWT_SECRET_KEY = secret_jwt

        secret_superadmin = _read_secret("superadmin_password")
        if secret_superadmin:
            self.FIRST_SUPERADMIN_PASSWORD = secret_superadmin

        secret_db = _read_secret("db_password")
        if secret_db:
            # Replace password in DATABASE_URL
            self.DATABASE_URL = self.DATABASE_URL.replace(
                "postgres:postgres@", f"postgres:{secret_db}@"
            )


settings = Settings()
