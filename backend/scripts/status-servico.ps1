# Mostra o status do serviço do backend do ControleVirtual e testa se a API
# está respondendo. Não precisa ser Administrador para rodar este script.
#
# USO:
#   .\status-servico.ps1

. "$PSScriptRoot\_comum.ps1"

$servico = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $servico) {
    Write-Host "O serviço '$ServiceName' não está instalado." -ForegroundColor Yellow
    exit 0
}

$servico | Select-Object Name, Status, StartType | Format-Table

try {
    $resposta = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "API respondendo em http://localhost:8000 -> $($resposta.Content)" -ForegroundColor Green

    # Mostra os IPs de rede disponíveis, para acessar de outros dispositivos.
    # Se a máquina tiver VPN, Wi-Fi e Ethernet ativos ao mesmo tempo, pode
    # aparecer mais de um IP: use o da rede local (normalmente 192.168.x.x).
    $ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown"
    } | Select-Object -ExpandProperty IPAddress
    if ($ips) {
        Write-Host "Acesso pela rede local (escolha o IP correto da sua rede):" -ForegroundColor Cyan
        $ips | ForEach-Object { Write-Host "  http://$_`:8000" -ForegroundColor Cyan }
    }
} catch {
    Write-Host "A API não respondeu em http://localhost:8000/health" -ForegroundColor Red
    Write-Host "Veja os logs em: $LogsDir\stderr.log" -ForegroundColor Yellow
}
