# ControleVirtual

Sistema de controle de vendas para loja virtual, feito para rodar localmente.

**Stack:** FastAPI (backend) + React/Vite/TypeScript (frontend) + PostgreSQL (banco).

> Nota: esta é a estrutura base do projeto. As funcionalidades de negócio (produtos, vendas, estoque, clientes, relatórios) ainda não foram implementadas.

## Estrutura do projeto

```
ControleVirtual/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── models/       # tabelas (SQLAlchemy) — vazio por enquanto
│   │   ├── schemas/      # validação (Pydantic) — vazio por enquanto
│   │   ├── routers/      # endpoints — vazio por enquanto
│   │   ├── crud/         # operações no banco — vazio por enquanto
│   │   ├── config.py     # configurações via variáveis de ambiente
│   │   ├── database.py   # conexão com o PostgreSQL
│   │   └── main.py       # ponto de entrada da API
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/             # React + Vite + TypeScript
    ├── src/
    │   ├── components/   # componentes reutilizáveis
    │   ├── pages/        # telas
    │   ├── services/     # api.ts (cliente axios)
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── .env.example
```

## Pré-requisitos

- Python 3.11+ (testado com 3.13)
- Node.js 18+ (testado com 24)
- PostgreSQL (opcional por enquanto — a API sobe sem banco enquanto não há rotas que o utilizem)

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

O frontend fica disponível em `http://localhost:5173` e já consulta a rota `/health` da API para exibir o status da conexão.

### Build de produção

```powershell
npm.cmd run build
```

Os arquivos finais são gerados na pasta `frontend/dist/`.

## Banco de dados (PostgreSQL)

A conexão é configurada pela variável `DATABASE_URL` no arquivo `backend/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/controle_virtual
```

Você pode rodar o PostgreSQL instalado direto na máquina ou via Docker. A configuração do banco e das migrations (Alembic) será feita quando as primeiras tabelas forem criadas.
