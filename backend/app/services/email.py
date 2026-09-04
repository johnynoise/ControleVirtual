"""Envio de emails via SMTP.

Usa apenas a biblioteca padrão (smtplib + email). O SMTP é configurado por
variáveis de ambiente (ver ``app/config.py`` e ``.env.example``). Quando o SMTP
não está configurado, ``enviar_email`` levanta ``ErroEmail`` para que o router
retorne um erro claro ao frontend.
"""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.config import settings


class ErroEmail(Exception):
    """Erro de negócio/configuração ao enviar um email."""


def enviar_email(
    *,
    destinatario: str,
    assunto: str,
    corpo_texto: str,
    anexo_bytes: bytes | None = None,
    anexo_nome: str = "anexo.pdf",
    anexo_mime: tuple[str, str] = ("application", "pdf"),
) -> None:
    """Envia um email (opcionalmente com um anexo) via SMTP.

    Levanta ``ErroEmail`` quando o SMTP não está configurado ou o envio falha.
    """
    if not settings.email_habilitado:
        raise ErroEmail(
            "Envio de email não configurado. Defina SMTP_HOST, SMTP_USER e "
            "SMTP_PASSWORD no arquivo .env do backend."
        )

    msg = EmailMessage()
    msg["From"] = formataddr((settings.email_remetente_nome, settings.remetente))
    msg["To"] = destinatario
    msg["Subject"] = assunto
    msg.set_content(corpo_texto)

    if anexo_bytes is not None:
        maintype, subtype = anexo_mime
        msg.add_attachment(
            anexo_bytes, maintype=maintype, subtype=subtype, filename=anexo_nome
        )

    try:
        if settings.smtp_ssl:
            contexto = ssl.create_default_context()
            with smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, context=contexto, timeout=30
            ) as smtp:
                smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
                smtp.ehlo()
                if settings.smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(msg)
    except smtplib.SMTPAuthenticationError as exc:
        raise ErroEmail(
            "Falha de autenticação no servidor SMTP. Verifique usuário e senha "
            "(no Gmail, use uma senha de app)."
        ) from exc
    except (smtplib.SMTPException, OSError) as exc:
        raise ErroEmail(f"Não foi possível enviar o email: {exc}") from exc
