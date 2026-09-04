# ControleVirtual

Sistema de controle de vendas e estoque para loja, feito para rodar localmente
de forma simples e direta.

**Stack:** FastAPI (backend) + React/Vite/TypeScript (frontend), com gráficos em
[Recharts](https://recharts.org/). Banco padrão **SQLite** (arquivo, sem
servidor); PostgreSQL é opcional para produção.

## Funcionalidades

- **PDV (vendas):** venda transacional que baixa o estoque, registra a
  movimentação e calcula o lucro numa única operação (com rollback em erro).
  Suporta desconto, vínculo com cliente e várias formas de pagamento (dinheiro,
  pix, cartão de crédito/débito e **fiado**).
- **Estorno e devolução:** cancelamento total ou devolução parcial de itens
  (com motivo), retornando o estoque, recalculando os totais da venda e
  mantendo um histórico para auditoria.
- **Contas a receber (fiado):** vendas a prazo nascem com saldo em aberto; os
  pagamentos parciais ou totais do cliente são registrados e o saldo devedor é
  atualizado automaticamente.
- **Histórico de vendas:** listagem paginada das vendas realizadas, com recibo,
  estorno/devolução e situação de pagamento.
- **Produtos:** cadastro com variações e atributos por categoria, preço de
  custo/venda, estoque e estoque mínimo; margem calculada automaticamente.
- **Estoque:** movimentações (kardex) de entrada, saída e ajuste com motivo.
- **Cadastros:** categorias (com campos dinâmicos por categoria), fornecedores
  e clientes — clientes têm **ficha** com histórico de compras, favoritos e
  atalho de contato.
- **Dashboard:** visão geral do período com indicadores e gráficos (Recharts).
- **Relatórios:** curva ABC, giro e sem giro, ranking de clientes, clientes
  inativos, forma de pagamento, compras por fornecedor, vendas por dia/horário
  e por categoria, descontos e perdas.

## Estrutura do projeto

```
ControleVirtual/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── models/       # tabelas (SQLAlchemy)
│   │   ├── schemas/      # validação (Pydantic)
│   │   ├── routers/      # endpoints
│   │   ├── crud/         # operações no banco e regras de negócio
│   │   ├── config.py     # configurações via variáveis de ambiente
│   │   ├── database.py   # conexão (SQLite/PostgreSQL)
│   │   └── main.py       # ponto de entrada da API
│   ├── seed_dados_fake.py # popula o banco com dados de exemplo
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/             # React + Vite + TypeScript
    ├── src/
    │   ├── components/   # componentes reutilizáveis (layout, gráficos, modais)
    │   ├── pages/        # telas (inclui pages/relatorios/)
    │   ├── services/     # cliente axios e chamadas por recurso
    │   ├── lib/          # helpers de UI compartilhados
    │   ├── App.tsx       # rotas (lazy-loading por página)
    │   └── main.tsx
    ├── package.json
    └── .env.example
```

## Pré-requisitos

- Python 3.11+ (testado com 3.13)
- Node.js 18+ (testado com 24)
- PostgreSQL (opcional — o padrão é SQLite, que não exige servidor)

## Backend (FastAPI)

Todos os comandos abaixo são executados a partir da pasta `backend/`.

1. Criar o ambiente virtual:

   ```powershell
   python -m venv venv
   ```

2. Instalar as dependências (usando o Python da venv diretamente, sem precisar ativar):

   ```powershell
   .\venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

3. Copiar o arquivo de exemplo de variáveis de ambiente e ajustar se necessário:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Rodar o servidor de desenvolvimento:

   ```powershell
   .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```

A API fica disponível em `http://localhost:8000`.

- Rota de saúde: `http://localhost:8000/health`
- Documentação automática (Swagger): `http://localhost:8000/docs`

Na primeira execução, as tabelas são criadas automaticamente no arquivo
`backend/controle_virtual.db`.

### Dados de exemplo (opcional)

Para popular o banco com dados fictícios e testar as telas rapidamente:

```powershell
.\venv\Scripts\python.exe seed_dados_fake.py
```

## Frontend (React + Vite)

Todos os comandos abaixo são executados a partir da pasta `frontend/`.

> No Windows, se o PowerShell bloquear scripts (`npm.ps1 não pode ser carregado`),
> use `npm.cmd` no lugar de `npm`. Exemplo: `npm.cmd install`.

1. Instalar as dependências:

   ```powershell
   npm.cmd install
   ```

2. (Opcional) Copiar o arquivo de variáveis de ambiente:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Rodar o servidor de desenvolvimento:

   ```powershell
   npm.cmd run dev
   ```

O frontend fica disponível em `http://localhost:5173` e já consulta a rota
`/health` da API para exibir o status da conexão na barra lateral.

### Build de produção

```powershell
npm.cmd run build
```

Os arquivos finais são gerados na pasta `frontend/dist/`. As páginas usam
lazy-loading (um chunk por rota), então bibliotecas pesadas como o Recharts só
são baixadas quando a tela que as usa é aberta.

## Principais dependências

- **Backend:** FastAPI, Uvicorn, SQLAlchemy, Pydantic / pydantic-settings.
  (Alembic e psycopg2 já constam para o caminho PostgreSQL — veja abaixo.)
- **Frontend:** React, React Router, Vite, TypeScript, Axios e Recharts.

## Banco de dados

Por padrão o projeto usa **SQLite** (arquivo `backend/controle_virtual.db`),
sem necessidade de instalar nada. Para usar **PostgreSQL**, defina a variável
`DATABASE_URL` no arquivo `backend/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/controle_virtual
```

> Observação: a evolução do schema é feita de forma simples no startup
> (`create_all` + uma mini-migração de colunas em `main.py`). O Alembic ainda
> não é usado; quando o projeto crescer, é o próximo passo natural.
