"""Validação de atributos JSONB de um produto contra o esquema da categoria.

É aqui que a flexibilidade do JSONB ganha segurança: garantimos que o produto
só tenha os atributos definidos pela categoria, que os obrigatórios estejam
presentes e que valores de listas respeitem as opções permitidas.
"""
from datetime import date
from typing import Any

from app.models.categoria import Categoria


class ErroValidacaoAtributos(ValueError):
    """Erro de validação dos atributos de um produto."""


def validar_atributos(atributos: dict[str, Any], categoria: Categoria) -> dict[str, Any]:
    """Valida e normaliza ``atributos`` conforme ``categoria.campos_schema``.

    Retorna o dicionário validado (apenas com as chaves conhecidas do esquema).
    Levanta ``ErroValidacaoAtributos`` em caso de problema.
    """
    esquema: list[dict[str, Any]] = categoria.campos_schema or []
    definicoes = {campo["chave"]: campo for campo in esquema}

    # Rejeita atributos que não pertencem ao esquema da categoria.
    desconhecidos = set(atributos) - set(definicoes)
    if desconhecidos:
        raise ErroValidacaoAtributos(
            "Atributos não previstos para esta categoria: "
            + ", ".join(sorted(desconhecidos))
        )

    validados: dict[str, Any] = {}
    for chave, campo in definicoes.items():
        presente = chave in atributos and atributos[chave] not in (None, "")

        if not presente:
            if campo.get("obrigatorio"):
                raise ErroValidacaoAtributos(f"O atributo '{chave}' é obrigatório.")
            continue

        valor = atributos[chave]
        tipo = campo.get("tipo", "texto")
        validados[chave] = _validar_valor(chave, valor, tipo, campo)

    return validados


def _validar_valor(chave: str, valor: Any, tipo: str, campo: dict[str, Any]) -> Any:
    if tipo == "texto":
        return str(valor)

    if tipo == "numero":
        if isinstance(valor, bool) or not isinstance(valor, (int, float)):
            raise ErroValidacaoAtributos(f"O atributo '{chave}' deve ser um número.")
        return valor

    if tipo == "booleano":
        if not isinstance(valor, bool):
            raise ErroValidacaoAtributos(f"O atributo '{chave}' deve ser verdadeiro/falso.")
        return valor

    if tipo == "lista":
        opcoes = campo.get("opcoes") or []
        if valor not in opcoes:
            raise ErroValidacaoAtributos(
                f"O atributo '{chave}' deve ser um de: {', '.join(map(str, opcoes))}."
            )
        return valor

    if tipo == "data":
        try:
            date.fromisoformat(str(valor))
        except ValueError as exc:
            raise ErroValidacaoAtributos(
                f"O atributo '{chave}' deve ser uma data no formato AAAA-MM-DD."
            ) from exc
        return str(valor)

    # Tipo desconhecido no esquema: guarda como texto por segurança.
    return str(valor)
