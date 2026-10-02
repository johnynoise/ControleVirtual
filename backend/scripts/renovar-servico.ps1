# Faz a transição completa de uma instalação antiga do backend (serviço
# antigo e/ou processos soltos de um repositório desatualizado) para o
# serviço rodando a partir desta pasta do repositório.
#
# Use este script quando você já tinha o ControleVirtual instalado neste
# computador (apontando para outra cópia do repositório) e agora quer que
# o serviço passe a servir esta pasta aqui.
#
# O que ele faz, em ordem:
#   1. Para e remove o serviço NSSM "ControleVirtualBackend", se existir
#      (não importa de qual pasta ele estava servindo antes).
#   2. Mata qualquer processo python.exe que ainda esteja escutando na
#      porta 8000 (sobra comum de execuções manuais ou serviço antigo).
#   3. Confirma que a porta 8000 ficou livre.
#   4. Reinstala o serviço (instalar-servico.ps1) e inicia (iniciar-servico.ps1)
#      já apontando para o Python e o projeto desta pasta.
#
# PRÉ-REQUISITOS: os mesmos do instalar-servico.ps1 (venv criado, NSSM
# instalado, build do frontend gerado, backend\.env configurado).
#
# USO (PowerShell como Administrador):
#   .\renovar-servico.ps1

. "$PSScriptRoot\_comum.ps1"

Exigir-Administrador
$nssm = Obter-CaminhoNssmOuSair

Write-Host "=== 1. Parando e removendo serviço antigo (se existir) ===" -ForegroundColor Cyan
$servicoAntigo = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($servicoAntigo) {
    & $nssm stop $ServiceName 2>$null | Out-Null
    & $nssm remove $ServiceName confirm 2>$null | Out-Null
    Write-Host "Serviço antigo removido." -ForegroundColor Green
} else {
    Write-Host "Nenhum serviço '$ServiceName' encontrado. Pulando." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 2. Encerrando processos python.exe que ocupam a porta 8000 ===" -ForegroundColor Cyan
$conexoes = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($conexoes) {
    $pidsEncontrados = $conexoes | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pidAtual in $pidsEncontrados) {
        $proc = Get-Process -Id $pidAtual -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Encerrando PID $pidAtual ($($proc.ProcessName)) - $($proc.Path)" -ForegroundColor Yellow
            Stop-Process -Id $pidAtual -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1
} else {
    Write-Host "Nenhum processo escutando na porta 8000." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 3. Confirmando que a porta 8000 está livre ===" -ForegroundColor Cyan
Start-Sleep -Seconds 1
$conferencia = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($conferencia) {
    Write-Host "A porta 8000 ainda está ocupada pelos PIDs:" -ForegroundColor Red
    $conferencia | Select-Object -ExpandProperty OwningProcess -Unique
    Write-Host "Encerre esses processos manualmente (Stop-Process -Id <PID> -Force) e rode este script de novo." -ForegroundColor Yellow
    exit 1
}
Write-Host "Porta 8000 livre." -ForegroundColor Green

Write-Host ""
Write-Host "=== 4. Reinstalando o serviço a partir desta pasta ===" -ForegroundColor Cyan
Write-Host "Pasta do backend: $BackendDir" -ForegroundColor Cyan
& "$PSScriptRoot\instalar-servico.ps1"

Write-Host ""
Write-Host "=== 5. Iniciando o serviço ===" -ForegroundColor Cyan
& "$PSScriptRoot\iniciar-servico.ps1"

Write-Host ""
Write-Host "Pronto. O serviço agora serve o projeto desta pasta: $BackendDir" -ForegroundColor Green
