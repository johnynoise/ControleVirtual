"""Model da configuração da loja (personalização e cadastro do negócio).

Tabela de linha única (id fixo = 1) com os dados que o lojista pode
personalizar: nome, logo, cor de destaque, dados para o recibo e o cadastro
fiscal usado no cabeçalho do relatório fiscal.

Todo o bloco fiscal é opcional, de propósito: quem vende como pessoa física não
tem razão social, CNPJ nem inscrição estadual, e o sistema precisa funcionar
igual nos dois casos. Nada aqui bloqueia o uso do sistema.
"""
from sqlalchemy import Column, Date, DateTime, Integer, String, Text, func

from app.database import Base


class Configuracao(Base):
    __tablename__ = "configuracao"

    id = Column(Integer, primary_key=True, index=True)

    # Identidade (Fase 1)
    nome_loja = Column(String(120), nullable=False, default="ControleVirtual")
    cor = Column(String(20), nullable=False, default="#2f6bff")
    # Logo em data URL base64 (ex.: "data:image/png;base64,....").
    logo = Column(Text, nullable=True)

    # Dados do negócio para o recibo (Fase 2 — já disponíveis no schema)
    documento = Column(String(30), nullable=True)
    telefone = Column(String(30), nullable=True)
    endereco = Column(String(200), nullable=True)
    email = Column(String(120), nullable=True)
    recibo_rodape = Column(String(200), nullable=True)

    # ------------------------------------------------------------------ #
    # Cadastro fiscal (todos opcionais)
    # ------------------------------------------------------------------ #

    # "fisica" ou "juridica". Serve para a tela mostrar CPF ou CNPJ no rótulo
    # do campo ``documento``; quando nulo, o rótulo fica genérico.
    tipo_pessoa = Column(String(20), nullable=True)
    # Razão social (pessoa jurídica). O ``nome_loja`` continua sendo o nome de
    # fantasia, que é o que aparece no menu e no recibo.
    razao_social = Column(String(200), nullable=True)

    inscricao_estadual = Column(String(30), nullable=True)
    inscricao_municipal = Column(String(30), nullable=True)
    # Código da atividade econômica principal.
    cnae = Column(String(20), nullable=True)
    data_abertura = Column(Date, nullable=True)

    # Regime tributário (mei, simples_nacional, lucro_presumido, lucro_real,
    # pessoa_fisica). Guardado como texto e validado pelo enum na camada de
    # schema, igual às outras listas do sistema.
    regime_tributario = Column(String(30), nullable=True)

    # Complemento do endereço fiscal (``endereco`` guarda a rua e o número).
    cep = Column(String(12), nullable=True)
    cidade = Column(String(120), nullable=True)
    estado = Column(String(2), nullable=True)

    # Contador responsável, para o relatório fiscal saber a quem se destina.
    contador_nome = Column(String(200), nullable=True)
    contador_contato = Column(String(200), nullable=True)

    atualizado_em = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
