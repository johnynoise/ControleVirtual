# Para o serviço do backend do ControleVirtual.
#
# USO (PowerShell como Administrador):
#   .\parar-servico.ps1

. "$PSScriptRoot\_comum.ps1"

Exigir-Administrador

$servico = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $servico) {
    Write-Host "O serviço '$ServiceName' não está instalado." -ForegroundColor Yellow
    exit 0
}

Stop-Service -Name $ServiceName
Get-Service -Name $ServiceName | Select-Object Name, Status, StartType
