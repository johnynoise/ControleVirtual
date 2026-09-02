"""Routers (endpoints) do ControleVirtual."""
from app.routers import (
    categorias,
    clientes,
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
    "relatorios",
]
