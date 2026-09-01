"""Configurações da aplicação, carregadas a partir de variáveis de ambiente."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ControleVirtual API"
    app_env: str = "development"
    # Padrão local: SQLite (arquivo, sem servidor). Em produção, defina
    # DATABASE_URL para o PostgreSQL, ex.:
    # postgresql://postgres:postgres@localhost:5432/controle_virtual
    database_url: str = "sqlite:///./controle_virtual.db"
    frontend_origin: str = "http://localhost:5173"


settings = Settings()
