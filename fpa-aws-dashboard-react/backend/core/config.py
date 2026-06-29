import os


class Settings:
    AZURE_OPENAI_API_KEY: str = os.environ.get("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_ENDPOINT: str = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_DEPLOYMENT: str = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "")
    AZURE_OPENAI_API_VERSION: str = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21")
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite:///./data/scenarios.db")


settings = Settings()
