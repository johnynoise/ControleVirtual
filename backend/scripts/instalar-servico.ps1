# Instala o backend do ControleVirtual como serviço do Windows (via NSSM).
#
# O serviço inicia sozinho no boot da máquina (sem precisar de login) e
# reinicia automaticamente se o processo cair.
#
# PRÉ-REQUISITOS (antes de rodar este script):
#   1. Python + venv criado em backend\venv com as dependências instaladas
#      (python -m venv venv; .\venv\Scripts\pip install -r requirements.txt)
#   2. NSSM instalado (winget install NSSM.NSSM)
#   3. Build do frontend gerado (dentro de frontend\: npm run build)
#   4. Arquivo backend\.env configurado (copie de .env.example se não existir)
#
# USO (PowerShell como Administrador):
#   .\instalar-servico.ps1

. "$PSScriptRoot\_comum.ps1"

Exigir-Administrador
$nssm = Obter-CaminhoNssmOuSair

if (-not (Test-Path $VenvPython)) {
    Write-Host "Não encontrei o Python do venv em: $VenvPython" -ForegroundColor Red
    Write-Host "Crie o venv e instale as dependências antes de instalar o serviço:" -ForegroundColor Yellow
    Write-Host "  cd `"$BackendDir`"" -ForegroundColor Yellow
    Write-Host "  python -m venv venv" -ForegroundColor Yellow
    Write-Host "  .\venv\Scripts\pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null

$uvicornArgs = "-m uvicorn app.main:app " + "--host" + " 0.0.0.0 " + "--port" + " 8000"

# Remove um serviço antigo com o mesmo nome, se existir, para reinstalar limpo.
& $nssm stop $ServiceName 2>$null | Out-Null
& $nssm remove $ServiceName confirm 2>$null | Out-Null

& $nssm install $ServiceName $VenvPython
& $nssm set $ServiceName AppParameters $uvicornArgs
& $nssm set $ServiceName AppDirectory $BackendDir
& $nssm set $ServiceName DisplayName "ControleVirtual - Backend"
& $nssm set $ServiceName Description "API e frontend do ControleVirtual (FastAPI/Uvicorn), servidor local na rede."
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppStdout (Join-Path $LogsDir "stdout.log")
& $nssm set $ServiceName AppStderr (Join-Path $LogsDir "stderr.log")
& $nssm set $ServiceName AppRotateFiles 1
& $nssm set $ServiceName AppRotateBytes 1048576
& $nssm set $ServiceName AppExit Default Restart
& $nssm set $ServiceName AppRestartDelay 3000

Write-Host ""
Write-Host "Serviço '$ServiceName' instalado e configurado para iniciar com o Windows." -ForegroundColor Green
Write-Host "Para iniciar agora, rode: .\iniciar-servico.ps1" -ForegroundColor Cyan
