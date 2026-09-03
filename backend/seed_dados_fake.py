"""Popula o banco do ControleVirtual com dados fake para demonstração.

Gera um cenário realista de uma loja com ~6 meses de operação: categorias,
fornecedores, clientes, produtos (com estoque inicial via movimentações de
compra), vendas distribuídas ao longo do período (com sazonalidade por dia da
semana e leve crescimento mensal), reposições de estoque, além de algumas
devoluções e vendas estornadas.

Toda a lógica de negócio é respeitada (baixa de estoque, custo médio, cálculo
de lucro e histórico de movimentações), e as datas (``criado_em``) são
retroagidas para que os relatórios e o dashboard mostrem histórico real.

Uso (dentro da pasta backend, com o venv ativado):

    python seed_dados_fake.py --reset          # limpa e repopula
    python seed_dados_fake.py --meses 6 --reset # define a janela (padrão 6)

O parâmetro ``--reset`` é obrigatório quando já existem dados no banco, para
evitar apagar informações por engano.
"""
from __future__ import annotations

import argparse
import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import delete

from app.database import Base, SessionLocal, engine
from app.models.categoria import Categoria
from app.models.cliente import Cliente
from app.models.devolucao import Devolucao, ItemDevolucao
from app.models.fornecedor import Fornecedor
from app.models.movimentacao import MovimentacaoEstoque
from app.models.produto import Produto
from app.models.venda import ItemVenda, Venda

CENTAVOS = Decimal("0.01")


def dinheiro(valor) -> Decimal:
    return Decimal(valor).quantize(CENTAVOS, rounding=ROUND_HALF_UP)


# --------------------------------------------------------------------------- #
# Catálogo base (categorias + produtos)
# --------------------------------------------------------------------------- #
CATEGORIAS = [
    {
        "nome": "Camisetas",
        "descricao": "Camisetas e regatas",
        "campos_schema": [
            {"chave": "tamanho", "rotulo": "Tamanho", "tipo": "lista",
             "opcoes": ["P", "M", "G", "GG"], "obrigatorio": True},
            {"chave": "cor", "rotulo": "Cor", "tipo": "texto", "obrigatorio": False},
        ],
    },
    {
        "nome": "Calçados",
        "descricao": "Tênis, sapatos e sandálias",
        "campos_schema": [
            {"chave": "numero", "rotulo": "Numeração", "tipo": "lista",
             "opcoes": ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
             "obrigatorio": True},
            {"chave": "cor", "rotulo": "Cor", "tipo": "texto", "obrigatorio": False},
        ],
    },
    {
        "nome": "Eletrônicos",
        "descricao": "Acessórios eletrônicos e gadgets",
        "campos_schema": [
            {"chave": "marca", "rotulo": "Marca", "tipo": "texto", "obrigatorio": False},
            {"chave": "garantia_meses", "rotulo": "Garantia (meses)", "tipo": "numero",
             "obrigatorio": False},
        ],
    },
    {
        "nome": "Acessórios",
        "descricao": "Bolsas, carteiras e cintos",
        "campos_schema": [
            {"chave": "material", "rotulo": "Material", "tipo": "texto", "obrigatorio": False},
        ],
    },
    {
        "nome": "Bebidas",
        "descricao": "Bebidas e refrigerantes",
        "campos_schema": [
            {"chave": "volume_ml", "rotulo": "Volume (ml)", "tipo": "numero",
             "obrigatorio": False},
        ],
    },
]

# (nome, categoria, atributos, preco_custo, preco_venda, estoque_minimo)
PRODUTOS = [
    # Camisetas
    ("Camiseta Básica Branca", "Camisetas", {"tamanho": "M", "cor": "Branco"}, "18.00", "49.90", 10),
    ("Camiseta Básica Preta", "Camisetas", {"tamanho": "G", "cor": "Preto"}, "18.00", "49.90", 10),
    ("Camiseta Estampada Surf", "Camisetas", {"tamanho": "M", "cor": "Azul"}, "24.00", "69.90", 8),
    ("Regata Fitness", "Camisetas", {"tamanho": "P", "cor": "Cinza"}, "20.00", "54.90", 8),
    ("Camiseta Polo", "Camisetas", {"tamanho": "GG", "cor": "Verde"}, "35.00", "99.90", 6),
    # Calçados
    ("Tênis Runner", "Calçados", {"numero": "40", "cor": "Preto"}, "120.00", "299.90", 5),
    ("Tênis Casual", "Calçados", {"numero": "42", "cor": "Branco"}, "95.00", "229.90", 5),
    ("Chinelo Slide", "Calçados", {"numero": "39", "cor": "Azul"}, "22.00", "59.90", 12),
    ("Sapato Social", "Calçados", {"numero": "41", "cor": "Marrom"}, "140.00", "349.90", 4),
    ("Sandália Feminina", "Calçados", {"numero": "37", "cor": "Nude"}, "45.00", "119.90", 8),
    # Eletrônicos
    ("Fone Bluetooth", "Eletrônicos", {"marca": "SoundGo", "garantia_meses": 12}, "60.00", "149.90", 6),
    ("Carregador Turbo 20W", "Eletrônicos", {"marca": "PowerX", "garantia_meses": 6}, "25.00", "69.90", 15),
    ("Cabo USB-C 2m", "Eletrônicos", {"marca": "PowerX", "garantia_meses": 3}, "8.00", "29.90", 20),
    ("Caixa de Som Portátil", "Eletrônicos", {"marca": "SoundGo", "garantia_meses": 12}, "90.00", "219.90", 5),
    ("Power Bank 10000mAh", "Eletrônicos", {"marca": "PowerX", "garantia_meses": 12}, "70.00", "169.90", 6),
    ("Smartwatch Fit", "Eletrônicos", {"marca": "TechFit", "garantia_meses": 12}, "150.00", "399.90", 4),
    # Acessórios
    ("Carteira de Couro", "Acessórios", {"material": "Couro"}, "30.00", "89.90", 8),
    ("Bolsa Transversal", "Acessórios", {"material": "Sintético"}, "55.00", "149.90", 6),
    ("Cinto Casual", "Acessórios", {"material": "Couro"}, "20.00", "59.90", 10),
    ("Boné Aba Curva", "Acessórios", {"material": "Algodão"}, "18.00", "49.90", 12),
    ("Óculos de Sol", "Acessórios", {"material": "Acetato"}, "35.00", "99.90", 8),
    # Bebidas
    ("Refrigerante Cola 350ml", "Bebidas", {"volume_ml": 350}, "2.50", "6.00", 30),
    ("Água Mineral 500ml", "Bebidas", {"volume_ml": 500}, "1.00", "3.50", 40),
    ("Suco Natural 300ml", "Bebidas", {"volume_ml": 300}, "3.00", "8.00", 25),
    ("Energético 250ml", "Bebidas", {"volume_ml": 250}, "4.50", "11.00", 20),
]

FORNECEDORES = [
    {"nome": "Distribuidora Moda Brasil Ltda", "nome_fantasia": "Moda Brasil",
     "documento": "12.345.678/0001-90", "cidade": "São Paulo", "estado": "SP",
     "telefone": "(11) 3344-5566", "contato": "Ricardo Alves"},
    {"nome": "CalçaFácil Comércio de Calçados", "nome_fantasia": "CalçaFácil",
     "documento": "23.456.789/0001-01", "cidade": "Franca", "estado": "SP",
     "telefone": "(16) 3722-1010", "contato": "Fernanda Souza"},
    {"nome": "TechImport Eletrônicos", "nome_fantasia": "TechImport",
     "documento": "34.567.890/0001-12", "cidade": "Curitiba", "estado": "PR",
     "telefone": "(41) 3555-8080", "contato": "Marcos Lima"},
    {"nome": "Acessórios & Cia", "nome_fantasia": "Acessórios & Cia",
     "documento": "45.678.901/0001-23", "cidade": "Belo Horizonte", "estado": "MG",
     "telefone": "(31) 3222-4040", "contato": "Juliana Prado"},
    {"nome": "Bebidas Sul Distribuição", "nome_fantasia": "Bebidas Sul",
     "documento": "56.789.012/0001-34", "cidade": "Porto Alegre", "estado": "RS",
     "telefone": "(51) 3111-6070", "contato": "André Martins"},
]

# Mapa categoria -> fornecedor principal (para as compras).
FORNECEDOR_POR_CATEGORIA = {
    "Camisetas": 0,
    "Calçados": 1,
    "Eletrônicos": 2,
    "Acessórios": 3,
    "Bebidas": 4,
}

NOMES = [
    "Ana Paula Ribeiro", "Bruno Carvalho", "Carla Menezes", "Diego Fernandes",
    "Eduarda Nogueira", "Felipe Araújo", "Gabriela Santos", "Henrique Moraes",
    "Isabela Costa", "João Pedro Lima", "Karina Duarte", "Lucas Almeida",
    "Mariana Rocha", "Nathan Oliveira", "Patrícia Gomes", "Rafael Barbosa",
    "Sofia Cardoso", "Thiago Nunes", "Vanessa Pires", "William Teixeira",
    "Beatriz Farias", "Caio Monteiro", "Débora Ramos", "Elias Vieira",
    "Fabiana Melo",
]

FORMAS_PAGAMENTO = ["dinheiro", "pix", "cartao_credito", "cartao_debito", "pix", "cartao_credito"]
MOTIVOS_DEVOLUCAO = ["defeito", "nao_gostou", "tamanho_errado", "produto_errado", "arrependimento"]


def _telefone_fake(rnd: random.Random) -> str:
    ddd = rnd.choice([11, 21, 31, 41, 51, 61, 71, 81])
    return f"({ddd}) 9{rnd.randint(1000, 9999)}-{rnd.randint(1000, 9999)}"


def _email_fake(nome: str) -> str:
    base = nome.lower().split()
    return f"{base[0]}.{base[-1]}@email.com"


def limpar_dados(db) -> None:
    """Apaga todos os registros na ordem correta de dependência."""
    for modelo in (ItemDevolucao, Devolucao, ItemVenda, Venda, MovimentacaoEstoque,
                   Produto, Categoria, Cliente, Fornecedor):
        db.execute(delete(modelo))
    db.commit()


def _has_dados(db) -> bool:
    return db.query(Venda).first() is not None or db.query(Produto).first() is not None


def seed(meses: int, reset: bool, seed_aleatorio: int = 42) -> None:
    rnd = random.Random(seed_aleatorio)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if _has_dados(db):
            if not reset:
                print(
                    "Já existem dados no banco. Rode novamente com --reset para "
                    "limpar tudo e repopular com dados fake."
                )
                return
            print("Limpando dados existentes...")
            limpar_dados(db)

        hoje = date.today()
        inicio = hoje - timedelta(days=meses * 30)
        inicio_dt = datetime.combine(inicio, time(8, 0))

        # ---------------- Categorias ----------------
        cat_por_nome: dict[str, Categoria] = {}
        for c in CATEGORIAS:
            categoria = Categoria(
                nome=c["nome"],
                descricao=c["descricao"],
                campos_schema=c["campos_schema"],
                criado_em=inicio_dt,
                atualizado_em=inicio_dt,
            )
            db.add(categoria)
            cat_por_nome[c["nome"]] = categoria
        db.flush()

        # ---------------- Fornecedores ----------------
        fornecedores: list[Fornecedor] = []
        for f in FORNECEDORES:
            fornecedor = Fornecedor(
                nome=f["nome"],
                nome_fantasia=f["nome_fantasia"],
                documento=f["documento"],
                cidade=f["cidade"],
                estado=f["estado"],
                telefone=f["telefone"],
                contato=f["contato"],
                email=f"contato@{f['nome_fantasia'].lower().replace(' ', '').replace('&', 'e')}.com.br",
                ativo=True,
                criado_em=inicio_dt,
                atualizado_em=inicio_dt,
            )
            db.add(fornecedor)
            fornecedores.append(fornecedor)
        db.flush()

        # ---------------- Clientes ----------------
        clientes: list[Cliente] = []
        for i, nome in enumerate(NOMES):
            # Clientes cadastrados espalhados ao longo do período.
            dias_offset = rnd.randint(0, max(1, (hoje - inicio).days - 10))
            criado = datetime.combine(inicio + timedelta(days=dias_offset), time(10, 0))
            cliente = Cliente(
                nome=nome,
                telefone=_telefone_fake(rnd),
                email=_email_fake(nome),
                ativo=rnd.random() > 0.05,  # ~5% inativos
                criado_em=criado,
                atualizado_em=criado,
            )
            db.add(cliente)
            clientes.append(cliente)
        db.flush()

        # ---------------- Produtos + estoque inicial ----------------
        produtos: list[Produto] = []
        # estado[produto.id] = {"estoque": int, "custo": Decimal, "min": int}
        estado: dict[int, dict] = {}
        sku_seq = 1000
        for nome, cat_nome, atributos, custo, venda_preco, est_min in PRODUTOS:
            sku_seq += 1
            custo_dec = dinheiro(custo)
            produto = Produto(
                nome=nome,
                sku=f"SKU{sku_seq}",
                descricao=None,
                categoria_id=cat_por_nome[cat_nome].id,
                preco_custo=custo_dec,
                preco_venda=dinheiro(venda_preco),
                estoque=0,
                estoque_minimo=est_min,
                atributos=atributos,
                ativo=True,
                criado_em=inicio_dt,
                atualizado_em=inicio_dt,
            )
            db.add(produto)
            db.flush()
            produtos.append(produto)

            # Estoque inicial via movimentação de compra (entrada).
            qtd_inicial = est_min * rnd.randint(4, 8)
            forn = fornecedores[FORNECEDOR_POR_CATEGORIA[cat_nome]]
            produto.estoque = qtd_inicial
            db.add(MovimentacaoEstoque(
                produto_id=produto.id,
                fornecedor_id=forn.id,
                produto_nome=produto.nome,
                fornecedor_nome=forn.nome,
                tipo="entrada",
                quantidade=qtd_inicial,
                estoque_resultante=qtd_inicial,
                motivo="compra",
                custo_unitario=custo_dec,
                observacao="Estoque inicial",
                criado_em=inicio_dt,
            ))
            estado[produto.id] = {"estoque": qtd_inicial, "custo": custo_dec, "min": est_min}
        db.flush()

        # ---------------- Vendas ao longo do período ----------------
        num_vendas = 0
        num_itens = 0
        num_reposicoes = 0
        vendas_criadas: list[Venda] = []

        dia = inicio
        total_dias = (hoje - inicio).days
        while dia <= hoje:
            dia_idx = (dia - inicio).days
            mes_idx = dia_idx / 30.0
            # Sazonalidade: mais movimento no fim de semana.
            peso_semana = {0: 0.9, 1: 0.9, 2: 1.0, 3: 1.0, 4: 1.3, 5: 1.6, 6: 0.7}
            base = 4 * peso_semana[dia.weekday()]
            # Leve crescimento ao longo dos meses (loja amadurecendo).
            base *= 1 + 0.06 * mes_idx
            qtd_vendas_dia = max(0, int(rnd.gauss(base, 1.8)))

            for _ in range(qtd_vendas_dia):
                # Horário comercial, com pico à tarde.
                hora = rnd.choices(
                    population=list(range(9, 20)),
                    weights=[3, 4, 5, 4, 3, 5, 6, 7, 6, 4, 2],
                )[0]
                minuto = rnd.randint(0, 59)
                momento = datetime.combine(dia, time(hora, minuto))

                # Itens da venda: 1 a 4 produtos distintos.
                qtd_produtos = rnd.choices([1, 2, 3, 4], weights=[45, 30, 18, 7])[0]
                escolhidos = rnd.sample(produtos, k=min(qtd_produtos, len(produtos)))

                venda = Venda(
                    forma_pagamento=rnd.choice(FORMAS_PAGAMENTO),
                    criado_em=momento,
                )
                # ~70% das vendas têm cliente identificado.
                if rnd.random() < 0.70:
                    cliente = rnd.choice(clientes)
                    venda.cliente_id = cliente.id
                    venda.cliente_nome = cliente.nome

                total_bruto = Decimal("0")
                custo_total = Decimal("0")
                itens_venda = []

                for produto in escolhidos:
                    st = estado[produto.id]
                    qtd = rnd.choices([1, 2, 3, 5], weights=[55, 25, 15, 5])[0]

                    # Repõe estoque se necessário (entrada de compra no mesmo dia).
                    if st["estoque"] < qtd:
                        reposicao = st["min"] * rnd.randint(4, 8) + qtd
                        st["estoque"] += reposicao
                        forn = fornecedores[_forn_idx(produto, cat_por_nome)]
                        db.add(MovimentacaoEstoque(
                            produto_id=produto.id,
                            fornecedor_id=forn.id,
                            produto_nome=produto.nome,
                            fornecedor_nome=forn.nome,
                            tipo="entrada",
                            quantidade=reposicao,
                            estoque_resultante=st["estoque"],
                            motivo="compra",
                            custo_unitario=st["custo"],
                            observacao="Reposição de estoque",
                            criado_em=datetime.combine(dia, time(8, 30)),
                        ))
                        num_reposicoes += 1

                    preco = Decimal(produto.preco_venda)
                    custo = st["custo"]
                    subtotal = dinheiro(preco * qtd)
                    total_bruto += subtotal
                    custo_total += dinheiro(custo * qtd)

                    st["estoque"] -= qtd
                    itens_venda.append(ItemVenda(
                        produto_id=produto.id,
                        produto_nome=produto.nome,
                        quantidade=qtd,
                        preco_unitario=preco,
                        custo_unitario=custo,
                        subtotal=subtotal,
                    ))
                    num_itens += 1

                    # Movimentação de saída (venda).
                    db.add(MovimentacaoEstoque(
                        produto_id=produto.id,
                        produto_nome=produto.nome,
                        tipo="saida",
                        quantidade=qtd,
                        estoque_resultante=st["estoque"],
                        motivo="venda",
                        criado_em=momento,
                    ))

                # Desconto ocasional (~18% das vendas).
                desconto = Decimal("0")
                if rnd.random() < 0.18:
                    pct = rnd.choice([Decimal("0.05"), Decimal("0.10"), Decimal("0.15")])
                    desconto = dinheiro(total_bruto * pct)
                    if desconto > total_bruto:
                        desconto = Decimal("0")

                total_liquido = dinheiro(total_bruto - desconto)
                lucro = dinheiro(total_liquido - custo_total)

                venda.itens = itens_venda
                venda.total_bruto = dinheiro(total_bruto)
                venda.custo_total = dinheiro(custo_total)
                venda.desconto = desconto
                venda.total_liquido = total_liquido
                venda.lucro = lucro

                db.add(venda)
                vendas_criadas.append(venda)
                num_vendas += 1

            dia += timedelta(days=1)

        # Atualiza o estoque final dos produtos no banco.
        for produto in produtos:
            produto.estoque = estado[produto.id]["estoque"]

        db.flush()

        # ---------------- Devoluções e estornos ----------------
        num_devolucoes = 0
        num_estornos = 0
        # Considera apenas vendas com mais de 7 dias (tempo para devolver).
        elegiveis = [v for v in vendas_criadas
                     if (hoje - v.criado_em.date()).days > 2 and v.itens]

        for venda in elegiveis:
            r = rnd.random()
            # ~4% devolução parcial, ~2% estorno total.
            if r < 0.04:
                item = rnd.choice(venda.itens)
                if item.quantidade <= 0:
                    continue
                qtd_dev = 1 if item.quantidade == 1 else rnd.randint(1, item.quantidade)
                data_dev = venda.criado_em + timedelta(days=rnd.randint(1, 15),
                                                        hours=rnd.randint(0, 8))
                if data_dev.date() > hoje:
                    data_dev = datetime.combine(hoje, time(15, 0))

                motivo = rnd.choice(MOTIVOS_DEVOLUCAO)
                preco = Decimal(item.preco_unitario)
                custo = Decimal(item.custo_unitario)
                subtotal_dev = dinheiro(preco * qtd_dev)

                devolucao = Devolucao(
                    venda_id=venda.id,
                    motivo=motivo,
                    valor_devolvido=subtotal_dev,
                    criado_em=data_dev,
                )
                devolucao.itens.append(ItemDevolucao(
                    item_venda_id=item.id,
                    produto_id=item.produto_id,
                    produto_nome=item.produto_nome,
                    quantidade=qtd_dev,
                    preco_unitario=preco,
                    custo_unitario=custo,
                    subtotal=subtotal_dev,
                ))
                db.add(devolucao)

                # Devolve estoque + movimentação de entrada.
                if item.produto_id is not None:
                    st = estado[item.produto_id]
                    st["estoque"] += qtd_dev
                    produto = next(p for p in produtos if p.id == item.produto_id)
                    produto.estoque = st["estoque"]
                    db.add(MovimentacaoEstoque(
                        produto_id=item.produto_id,
                        produto_nome=item.produto_nome,
                        tipo="entrada",
                        quantidade=qtd_dev,
                        estoque_resultante=st["estoque"],
                        motivo="devolucao",
                        observacao=f"Devolução da venda #{venda.id} ({motivo})",
                        criado_em=data_dev,
                    ))

                # Reduz o item e recalcula a venda.
                item.quantidade -= qtd_dev
                item.subtotal = dinheiro(preco * item.quantidade)
                _recalcular_venda(venda)
                if all(i.quantidade == 0 for i in venda.itens):
                    venda.cancelada_em = data_dev
                    venda.motivo_cancelamento = f"Devolução total ({motivo})"
                num_devolucoes += 1

            elif r < 0.06:
                data_est = venda.criado_em + timedelta(days=rnd.randint(1, 10),
                                                        hours=rnd.randint(0, 6))
                if data_est.date() > hoje:
                    data_est = datetime.combine(hoje, time(16, 0))
                for item in venda.itens:
                    if item.produto_id is None:
                        continue
                    st = estado[item.produto_id]
                    st["estoque"] += item.quantidade
                    produto = next(p for p in produtos if p.id == item.produto_id)
                    produto.estoque = st["estoque"]
                    db.add(MovimentacaoEstoque(
                        produto_id=item.produto_id,
                        produto_nome=item.produto_nome,
                        tipo="entrada",
                        quantidade=item.quantidade,
                        estoque_resultante=st["estoque"],
                        motivo="estorno",
                        observacao=f"Estorno da venda #{venda.id}",
                        criado_em=data_est,
                    ))
                venda.cancelada_em = data_est
                venda.motivo_cancelamento = rnd.choice(
                    ["Cliente desistiu", "Cobrança duplicada", "Erro no pedido"]
                )
                num_estornos += 1

        # ---------------- Perdas/ajustes esporádicos ----------------
        num_perdas = 0
        for _ in range(rnd.randint(6, 12)):
            produto = rnd.choice(produtos)
            st = estado[produto.id]
            if st["estoque"] < 2:
                continue
            qtd_perda = rnd.randint(1, min(3, st["estoque"]))
            st["estoque"] -= qtd_perda
            produto.estoque = st["estoque"]
            dias_offset = rnd.randint(0, max(1, total_dias))
            data_perda = datetime.combine(inicio + timedelta(days=dias_offset), time(11, 0))
            db.add(MovimentacaoEstoque(
                produto_id=produto.id,
                produto_nome=produto.nome,
                tipo="saida",
                quantidade=qtd_perda,
                estoque_resultante=st["estoque"],
                motivo=rnd.choice(["perda", "quebra", "avaria"]),
                custo_unitario=st["custo"],
                observacao="Ajuste de inventário",
                criado_em=data_perda,
            ))
            num_perdas += 1

        db.commit()

        print("\n=== Dados fake gerados com sucesso ===")
        print(f"Período:        {inicio.isoformat()} a {hoje.isoformat()} (~{meses} meses)")
        print(f"Categorias:     {len(CATEGORIAS)}")
        print(f"Fornecedores:   {len(FORNECEDORES)}")
        print(f"Clientes:       {len(NOMES)}")
        print(f"Produtos:       {len(PRODUTOS)}")
        print(f"Vendas:         {num_vendas} ({num_itens} itens)")
        print(f"Reposições:     {num_reposicoes}")
        print(f"Devoluções:     {num_devolucoes}")
        print(f"Estornos:       {num_estornos}")
        print(f"Perdas/ajustes: {num_perdas}")
    finally:
        db.close()


def _forn_idx(produto, cat_por_nome) -> int:
    """Descobre o índice do fornecedor a partir da categoria do produto."""
    for nome, cat in cat_por_nome.items():
        if cat.id == produto.categoria_id:
            return FORNECEDOR_POR_CATEGORIA[nome]
    return 0


def _recalcular_venda(venda: Venda) -> None:
    total_bruto = sum((Decimal(i.subtotal) for i in venda.itens), Decimal("0"))
    custo_total = sum((Decimal(i.custo_unitario) * i.quantidade for i in venda.itens),
                      Decimal("0"))
    desconto = min(Decimal(venda.desconto or 0), total_bruto)
    total_liquido = dinheiro(total_bruto - desconto)
    venda.total_bruto = dinheiro(total_bruto)
    venda.custo_total = dinheiro(custo_total)
    venda.desconto = dinheiro(desconto)
    venda.total_liquido = total_liquido
    venda.lucro = dinheiro(total_liquido - custo_total)


def main() -> None:
    parser = argparse.ArgumentParser(description="Popula o banco com dados fake de demonstração.")
    parser.add_argument("--meses", type=int, default=6, help="Meses de histórico (padrão: 6).")
    parser.add_argument("--reset", action="store_true",
                        help="Limpa os dados existentes antes de popular.")
    parser.add_argument("--seed", type=int, default=42,
                        help="Semente do gerador aleatório (padrão: 42).")
    args = parser.parse_args()
    seed(meses=args.meses, reset=args.reset, seed_aleatorio=args.seed)


if __name__ == "__main__":
    main()
