"""Routers (endpoints) do ControleVirtual."""
from app.routers import (
    categorias,
    clientes,
    defeitos,
    despesas,
    fiscal,
    fornecedores,
    movimentacoes,
    produtos,
    relatorios,
    vendas,
)

__all__ = [
    "categorias",
    "produtos",
    "movimentacoes",
    "fornecedores",
    "clientes",
    "vendas",
    "defeitos",
    "despesas",
    "relatorios",
    "fiscal",
]
