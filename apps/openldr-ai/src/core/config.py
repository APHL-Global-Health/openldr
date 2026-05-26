from pydantic import field_validator
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Service
    AI_APP_NAME: str = "openldr-ai"
    AI_APP_VERSION: str = "0.1.0"
    AI_DEBUG: bool = False

    # Models storage - maps to the Docker volume mount
    AI_MODELS_DIR: str = "../ai"

    # HuggingFace cache dir
    AI_HF_HOME: str = "../ai"

    # CORS - accepts comma-separated: "http://localhost,http://localhost:3000"
    # or JSON array: '["http://localhost","http://localhost:3000"]'
    AI_CORS_ORIGINS: str = "http://localhost,http://localhost:3000"

    # Default model to load on startup (optional - leave empty to skip)
    AI_DEFAULT_MODEL: str = ""

    # Max tokens for generation
    AI_MAX_NEW_TOKENS: int = 512

    # MCP server URL (internal Docker network URL)
    AI_MCP_URL: str = "http://127.0.0.1:6060"

    # Max tool calls per agentic turn (prevents infinite loops)
    AI_MAX_TOOL_CALLS: int = 3

    # Prompt budgeting / small-model safety
    AI_MAX_INPUT_TOKENS: int = 4096
    AI_RESERVED_OUTPUT_TOKENS: int = 768
    AI_CONTEXT_SAFETY_MARGIN_TOKENS: int = 256
    AI_MAX_HISTORY_MESSAGES: int = 6
    AI_TOOL_RESULT_CHAR_LIMIT: int = 3500

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.AI_CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure models dir exists at import time
Path(settings.AI_MODELS_DIR).mkdir(parents=True, exist_ok=True)
