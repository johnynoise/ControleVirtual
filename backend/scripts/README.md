# Scripts do serviço (Windows)

Transformam o backend do ControleVirtual num serviço do Windows, que inicia
sozinho ao ligar a máquina e reinicia automaticamente se cair. Usa o
[NSSM](https://nssm.cc/) por baixo dos panos.

Todos os scripts são portáveis: descobrem sozinhos o caminho do projeto e do
NSSM, então funcionam em qualquer computador, desde que os pré-requisitos
abaixo estejam prontos.

## Pré-requisitos (uma vez, em cada computador-servidor)

1. **Python 3 instalado** e o venv do backend criado com as dependências:
   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\pip install -r requirements.txt
   ```
2. **NSSM instalado**: `winget install NSSM.NSSM`
3. **Build do frontend gerado** (o backend serve esses arquivos):
   ```powershell
   cd frontend
   npm install
   npm run build
   ```
4. **Arquivo `backend\.env` configurado** (copie de `.env.example` se ainda
   não existir, e ajuste `FRONTEND_ORIGIN` com o IP da máquina na rede).

## Uso

Abra o PowerShell **como Administrador** na pasta `backend\scripts` e rode,
na ordem:

```powershell
.\instalar-servico.ps1   # cria o serviço (uma vez só)
.\iniciar-servico.ps1    # inicia agora
```

A partir daí, o serviço sobe sozinho a cada boot da máquina — não precisa
rodar `iniciar-servico.ps1` de novo depois de reiniciar o computador.

Outros comandos disponíveis:

```powershell
.\status-servico.ps1     # mostra status e testa a API (não precisa admin)
.\parar-servico.ps1      # para o serviço
.\remover-servico.ps1    # desinstala o serviço (não apaga dados nem o projeto)
```

## Atualizando para a versão mais recente

Depois que o repositório mudar (push feito a partir de outro computador),
rode neste computador, na pasta `backend\scripts`:

```powershell
.\atualizar-servico.ps1
```

Esse script faz `git pull`, reinstala dependências do backend e do frontend
(só reinstala de fato o que mudou — `pip install` e `npm install` não repetem
trabalho desnecessário), gera o build novo do frontend e reinicia o serviço.
Precisa já ter o serviço instalado nesta pasta (se não tiver, ou se você
trocou de pasta/repositório, use `renovar-servico.ps1` abaixo).

## Trocando de pasta/repositório no mesmo computador

Se este computador já teve o serviço instalado apontando para outra cópia do
repositório (ex: pasta antiga, desatualizada) e agora você quer que ele passe
a servir esta pasta aqui, rode:

```powershell
.\renovar-servico.ps1
```

Esse script para e remove o serviço antigo, encerra qualquer processo Python
que tenha sobrado escutando na porta 8000 (comum quando o serviço antigo não
foi removido corretamente ou havia uma execução manual esquecida), e então
reinstala e inicia o serviço já apontando para esta pasta. Equivale a rodar
`remover-servico.ps1` + limpeza manual de processos + `instalar-servico.ps1` +
`iniciar-servico.ps1`, só que automatizado.

## Logs

Ficam em `backend\logs\stdout.log` e `backend\logs\stderr.log` (rotacionam
automaticamente ao atingir ~1 MB).

## Firewall

Para acessar de outros dispositivos na rede (celular, outro PC), é preciso
liberar a porta 8000 (TCP) no firewall do Windows. Esse passo não está nestes
scripts porque envolve uma decisão de segurança (rede pública x privada) —
peça para o Kiro configurar isso separadamente, ou rode como Administrador:

```powershell
New-NetFirewallRule -DisplayName "ControleVirtual" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Any
```
