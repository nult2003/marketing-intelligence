from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Marketing Intelligent API"
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str = "nult-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    NEWS_API_KEY: Optional[str] = None
    SERPER_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    ALPHAVANTAGE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"
    
    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return self.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
