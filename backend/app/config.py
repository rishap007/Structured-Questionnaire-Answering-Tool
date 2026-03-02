from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Structured Questionnaire Answering Tool"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 120

    database_url: str = "sqlite:///./aluminatech.db"

    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-large"
    openai_temperature: float = 0.2

    chroma_persist_dir: str = "./chroma_data"
    rag_similarity_threshold: float = 0.65

    upload_dir: str = "./uploads"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
