"""Model de Despesa (saídas de dinheiro que não são compra de mercadoria).

Compra de mercadoria para revenda já é registrada como entrada de estoque em
``MovimentacaoEstoque`` (e entra no CMV). Esta tabela é para o *outro* lado do
resultado: aluguel, energia, embalagem, taxa de maquininha, contador, imposto
pago, pró-labore, retirada do dono e afins.

Duas datas, de propósito:

* ``data_competencia`` — a que mês a despesa se refere (regime de competência).
  A conta de luz de janeiro paga em fevereiro tem competência janeiro.
* ``data_pagamento`` — quando o dinheiro saiu de fato (regime de caixa). Nulo
  significa que a despesa foi lançada mas ainda não foi paga.

Ter as duas permite apurar o resultado pelos dois regimes, do mesmo jeito que
as vendas (data da venda) e os pagamentos de fiado (data do recebimento).
"""
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Despesa(Base):
    __tablename__ = "despesas"

    id = Column(Integer, primary_key=True, index=True)

    descricao = Column(String(200), nullable=False)

    # Categoria da despesa. Guardada como texto (igual a ``forma_pagamento`` da
    # venda) e validada pelo enum ``CategoriaDespesa`` na camada de schema, para
    # que valores novos não exijam migração de banco.
    categoria = Column(String(40), nullable=False, index=True)

    valor = Column(Numeric(12, 2), nullable=False)

    # Mês a que a despesa se refere (competência). É por esta data que os
    # relatórios agrupam por padrão.
    data_competencia = Column(Date, nullable=False, index=True)
    # Quando foi efetivamente paga. Nulo = ainda em aberto.
    data_pagamento = Column(Date, nullable=True, index=True)

    forma_pagamento = Column(String(30), nullable=True)

    # Fornecedor/prestador ligado à despesa (opcional). O nome é guardado como
    # retrato (snapshot) para o histórico sobreviver à remoção do fornecedor.
    fornecedor_id = Column(
        Integer, ForeignKey("fornecedores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fornecedor_nome = Column(String(200), nullable=True)

    # Número da nota, recibo ou boleto — a comprovação do lançamento.
    documento = Column(String(60), nullable=True)

    # Marca se a despesa entra na apuração do resultado do negócio. Retirada do
    # dono e compra de bem (imobilizado), por exemplo, são saídas de dinheiro
    # mas não são despesa operacional do período. Quem decide o enquadramento
    # é o lojista com o contador; aqui é só a marcação.
    operacional = Column(Boolean, nullable=False, default=True, server_default="1")

    # Marca a despesa fixa mensal (aluguel, internet). Ao lançar uma despesa
    # fixa, a API gera um lançamento por mês até o limite escolhido — cada mês
    # é uma linha própria, com a sua competência e o seu pagamento.
    recorrente = Column(Boolean, nullable=False, default=False, server_default="0")

    # Identificador que costura os lançamentos gerados a partir do mesmo cadastro
    # de despesa fixa. É o que permite editar ou remover "esta e as próximas".
    # Nulo nas despesas avulsas.
    grupo_recorrencia = Column(String(36), nullable=True, index=True)

    observacao = Column(Text, nullable=True)

    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    atualizado_em = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    fornecedor = relationship("Fornecedor")
