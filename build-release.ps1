# build-release.ps1 — HACCPrint signed release builder
#
# Compila un bundle firmato per l'auto-updater Tauri.
# - Chiede la password della private key in modo sicuro.
# - Setta le env var per la durata del build, le pulisce in uscita.
# - Mostra il path dei bundle .msi / .exe generati al termine.
#
# Uso:
#   .\build-release.ps1
#   .\build-release.ps1 -KeyPath "D:\backup\altra-chiave.key"

param(
    [string]$KeyPath = "$HOME\.tauri\haccprint.key"
)

$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot

try {
    # 1. Verifica che la private key esista
    if (-not (Test-Path $KeyPath)) {
        Write-Host "Private key non trovata: $KeyPath" -ForegroundColor Red
        Write-Host ""
        Write-Host "Genera la keypair con:" -ForegroundColor Yellow
        Write-Host "  npm run tauri signer generate -- --write-keys `"$KeyPath`"" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Private key: $KeyPath" -ForegroundColor Green

    # 2. Password (SecureString → plain solo nel processo corrente)
    $securePass = Read-Host "Password della private key" -AsSecureString
    $plainPass  = [System.Net.NetworkCredential]::new("", $securePass).Password
    if ([string]::IsNullOrEmpty($plainPass)) {
        Write-Host "Password vuota — annullato." -ForegroundColor Red
        exit 1
    }

    # 3. Env var: process-scope (sparisce a fine script + cleanup nel finally)
    $env:TAURI_SIGNING_PRIVATE_KEY          = $KeyPath
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $plainPass

    # 4. Build
    Write-Host ""
    Write-Host "Lancio: npm run tauri build" -ForegroundColor Cyan
    Write-Host ""
    npm run tauri build
    if ($LASTEXITCODE -ne 0) {
        throw "tauri build fallito (exit code $LASTEXITCODE)"
    }

    # 5. Mostra gli output
    $bundleDir = Join-Path $PSScriptRoot "src-tauri\target\release\bundle"
    Write-Host ""
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host "Build OK. Bundle generati in:" -ForegroundColor Green
    Write-Host "  $bundleDir" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host ""

    foreach ($sub in @("msi", "nsis")) {
        $d = Join-Path $bundleDir $sub
        if (Test-Path $d) {
            Write-Host "[$sub]" -ForegroundColor Cyan
            Get-ChildItem $d -File | Sort-Object Name | ForEach-Object {
                $sizeKB = "{0:N0}" -f ($_.Length / 1KB)
                $marker = if ($_.Extension -eq ".sig") { "  (firma updater)" } else { "" }
                Write-Host ("  {0,10} KB  {1}{2}" -f $sizeKB, $_.Name, $marker)
            }
            Write-Host ""
        }
    }

    Write-Host "Per il rilascio: carica installer + .sig sulla GitHub Release," -ForegroundColor Yellow
    Write-Host "poi aggiorna latest.json con la firma del .sig corrispondente." -ForegroundColor Yellow
}
finally {
    # Cleanup: rimuovi env var con la password e ripristina cwd
    Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY          -ErrorAction SilentlyContinue
    Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
    Pop-Location
}
