# Atualiza o ControleVirtual já instalado neste computador: busca as
# alterações mais recentes do git, reinstala dependências do backend,
# gera o build novo do frontend e reinicia o serviço do Windows.
#
# Use este script sempre que o repositório tiver sido atualizado (git push
# de outra máquina) e você quiser que este computador passe a rodar a
# versão nova.
#
# O que ele faz, em ordem:
#   1. git pull (busca e aplica as alterações mais recentes do branch atual)
#   2. Reinstala as dependências do backend (pip install -r requirements.txt)
#   3. Reinstala as dependências do frontend e gera o build (npm install + npm run build)
#   4. Reinicia o serviço NSSM para servir a versão nova
#
# PRÉ-REQUISITOS: o serviço já precisa estar instalado (instalar-servico.ps1
# já executado alguma vez nesta pasta). Se nunca foi instalado, ou se você
# migrou de outra pasta/repositório, use renovar-servico.ps1 em vez deste.
#
# USO (PowerShell como Administrador):
#   .\atualizar-servico.ps1

. "$PSScriptRoot\_comum.ps1"

Exigir-Administrador
$nssm = Obter-CaminhoNssmOuSair

$RepoDir = Split-Path -Parent $BackendDir
$FrontendDir = Join-Path $RepoDir "frontend"

$servico = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $servico) {
    Write-Host "O serviço '$ServiceName' não está instalado nesta pasta." -ForegroundColor Red
    Write-Host "Se você acabou de trocar de repositório/pasta, rode primeiro: .\renovar-servico.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== 1. Buscando atualizações do git ===" -ForegroundColor Cyan
Push-Location $RepoDir
try {
    $statusAntes = git rev-parse HEAD
    git pull
    if ($LASTEXITCODE -ne 0) {
        Write-Host "git pull falhou. Resolva pendências (ex.: alterações locais não commitadas) e rode de novo." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    $statusDepois = git rev-parse HEAD
} finally {
    Pop-Location
}

if ($statusAntes -eq $statusDepois) {
    Write-Host "Já estava atualizado (nenhum commit novo)." -ForegroundColor Yellow
} else {
    Write-Host "Repositório atualizado: $statusAntes -> $statusDepois" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== 2. Atualizando dependências do backend ===" -ForegroundColor Cyan
if (-not (Test-Path $VenvPython)) {
    Write-Host "Não encontrei o Python do venv em: $VenvPython" -ForegroundColor Red
    Write-Host "Crie o venv antes de continuar (veja README.md)." -ForegroundColor Yellow
    exit 1
}
$VenvPip = Join-Path $BackendDir "venv\Scripts\pip.exe"
& $VenvPip install -r (Join-Path $BackendDir "requirements.txt")

Write-Host ""
Write-Host "=== 3. Atualizando e gerando o build do frontend ===" -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install falhou." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm run build falhou." -ForegroundColor Red
        Pop-Location
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== 4. Reiniciando o serviço ===" -ForegroundColor Cyan
Restart-Service -Name $ServiceName
Start-Sleep -Seconds 2
Get-Service -Name $ServiceName | Select-Object Name, Status, StartType

try {
    $resposta = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host ""
    Write-Host "Backend respondendo com a versão atualizada: $($resposta.Content)" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "O serviço reiniciou, mas ainda não respondeu em /health. Confira os logs em:" -ForegroundColor Yellow
    Write-Host "  $LogsDir\stderr.log" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Lembre-se: se este update incluiu uma migração de banco nova ou" -ForegroundColor Cyan
Write-Host "variável nova no .env, confira o CHANGELOG/README do repositório." -ForegroundColor Cyan
