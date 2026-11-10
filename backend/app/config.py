from pathlib import Path
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Resolve backend root directory and .env path
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

# Load backend/.env if present, ensuring environment variables take precedence (override=False)
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE, override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    GNANI_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./vaaniops.db"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    APP_ENV: str = "development"
    GNANI_TIMEOUT_SECONDS: float = 60.0

    # Official Gnani endpoints
    PRISMA_ENDPOINT: str = "https://api.vachana.ai/stt/v3"
    TIMBRE_ENDPOINT: str = "https://api.vachana.ai/api/v1/tts/inference"

    # Gnani Evon v3.3 Intelligence Engine settings (Hosted vLLM GPU Server)
    EVON_BASE_URL: str = "https://api.vachana.ai/v1"
    EVON_API_KEY: str = ""
    EVON_MODEL: str = "model"
    EVON_ENABLED: bool = True
    EVON_TIMEOUT_SECONDS: float = 30.0
    EVON_TEMPERATURE: float = 0.6
    EVON_TOP_P: float = 0.95

    @property
    def effective_evon_api_key(self) -> str:
        return self.EVON_API_KEY.strip() or self.GNANI_API_KEY.strip()


settings = Settings()

