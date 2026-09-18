# Inicia o serviço do backend do ControleVirtual (precisa já ter sido
# instalado com instalar-servico.ps1).
#
# USO (PowerShell como Administrador):
#   .\iniciar-servico.ps1

. "$PSScriptRoot\_comum.ps1"

Exigir-Administrador

$servico = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $servico) {
    Write-Host "O serviço '$ServiceName' ainda não está instalado." -ForegroundColor Red
    Write-Host "Rode primeiro: .\instalar-servico.ps1" -ForegroundColor Yellow
    exit 1
}

Start-Service -Name $ServiceName
Start-Sleep -Seconds 2
Get-Service -Name $ServiceName | Select-Object Name, Status, StartType

try {
    $resposta = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host ""
    Write-Host "Backend respondendo: $($resposta.Content)" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "O serviço iniciou, mas ainda não respondeu em /health. Confira os logs em:" -ForegroundColor Yellow
    Write-Host "  $LogsDir\stderr.log" -ForegroundColor Yellow
}
