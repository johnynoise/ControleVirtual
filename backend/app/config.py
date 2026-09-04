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

    # Nome da loja exibido no cabeçalho do recibo (PDF e email).
    loja_nome: str = "ControleVirtual"

    # ----------------------------------------------------------------- #
    # Envio de email (recibo de venda em PDF)
    # ----------------------------------------------------------------- #
    # Preencha estas variáveis no .env para habilitar o envio de recibos.
    # Ex. Gmail: smtp.gmail.com / porta 587 / senha de app (não a senha normal).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    # Usa STARTTLS (porta 587). Para SSL direto (porta 465), defina como False
    # e ative smtp_ssl.
    smtp_starttls: bool = True
    smtp_ssl: bool = False
    # Remetente exibido no email. Se vazio, usa smtp_user.
    email_remetente: str = ""
    email_remetente_nome: str = "ControleVirtual"

    @property
    def email_habilitado(self) -> bool:
        """Só permite enviar email quando o SMTP está minimamente configurado."""
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def remetente(self) -> str:
        """Endereço de email do remetente (cai para o usuário SMTP)."""
        return self.email_remetente or self.smtp_user


settings = Settings()
