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
