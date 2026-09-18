# Remove (desinstala) o serviço do backend do ControleVirtual.
# Não apaga o projeto, nem o banco de dados: só remove o registro do serviço
# do Windows (Services). Para reinstalar depois, rode instalar-servico.ps1.
#
# USO (PowerShell como Administrador):
#   .\remover-servico.ps1

. "$PSScriptRoot\_comum.ps1"

Exigir-Administrador
$nssm = Obter-CaminhoNssmOuSair

$servico = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $servico) {
    Write-Host "O serviço '$ServiceName' não está instalado. Nada a fazer." -ForegroundColor Yellow
    exit 0
}

& $nssm stop $ServiceName 2>$null | Out-Null
& $nssm remove $ServiceName confirm

Write-Host "Serviço '$ServiceName' removido." -ForegroundColor Green
