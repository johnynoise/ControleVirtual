"""Models do ControleVirtual.

Importa todos os models aqui para que o metadata do SQLAlchemy os conheça
(necessário para ``Base.metadata.create_all`` e para o Alembic no futuro).
"""
from app.models.categoria import Categoria
from app.models.cliente import Cliente
from app.models.devolucao import Devolucao, ItemDevolucao
from app.models.fornecedor import Fornecedor
from app.models.movimentacao import MovimentacaoEstoque
from app.models.produto import Produto, VariacaoProduto
from app.models.venda import ItemVenda, Venda

__all__ = [
    "Categoria",
    "Produto",
    "VariacaoProduto",
    "MovimentacaoEstoque",
    "Fornecedor",
    "Cliente",
    "Venda",
    "ItemVenda",
    "Devolucao",
    "ItemDevolucao",
]
