# Funções e variáveis compartilhadas pelos scripts de serviço do ControleVirtual.
# Não execute este arquivo diretamente: ele é importado (dot-sourced) pelos outros.

$ServiceName = "ControleVirtualBackend"

# Raiz do backend = pasta pai de scripts/ (este arquivo fica em backend/scripts/).
$BackendDir = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"
$LogsDir = Join-Path $BackendDir "logs"

function Test-Administrador {
    $identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identidade)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Exigir-Administrador {
    if (-not (Test-Administrador)) {
        Write-Host "Este script precisa ser executado como Administrador." -ForegroundColor Red
        Write-Host "Abra o PowerShell com 'Executar como administrador' e rode o script novamente." -ForegroundColor Yellow
        exit 1
    }
}

function Localizar-Nssm {
    # 1) Já está no PATH?
    $doPath = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($doPath) { return $doPath.Source }

    # 2) Instalado via winget (caminho padrão de pacotes do usuário atual).
    $pacotesWinget = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path $pacotesWinget) {
        $encontrado = Get-ChildItem -Path $pacotesWinget -Recurse -Filter "nssm.exe" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "win64" } |
            Select-Object -First 1
        if ($encontrado) { return $encontrado.FullName }
    }

    # 3) Locais comuns de instalação manual.
    $candidatos = @(
        "$env:ProgramFiles\nssm\win64\nssm.exe",
        "$env:ProgramFiles\NSSM\win64\nssm.exe",
        "${env:ProgramFiles(x86)}\nssm\win64\nssm.exe",
        "$env:ChocolateyInstall\bin\nssm.exe"
    )
    foreach ($c in $candidatos) {
        if (Test-Path $c) { return $c }
    }

    return $null
}

function Obter-CaminhoNssmOuSair {
    $nssm = Localizar-Nssm
    if (-not $nssm) {
        Write-Host "Não encontrei o nssm.exe nesta máquina." -ForegroundColor Red
        Write-Host "Instale com: winget install NSSM.NSSM" -ForegroundColor Yellow
        exit 1
    }
    return $nssm
}
