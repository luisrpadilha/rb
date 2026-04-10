$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcDir = Join-Path $scriptDir "..\..\CEP\com.rbmh.commotiondesigner"
$cepRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$destDir = Join-Path $cepRoot "com.rbmh.commotiondesigner"

New-Item -ItemType Directory -Path $cepRoot -Force | Out-Null
Copy-Item -Path (Join-Path $srcDir '*') -Destination $destDir -Recurse -Force

New-Item -Path "HKCU:\Software\Adobe\CSXS.12" -Force | Out-Null
New-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.12" -Name "PlayerDebugMode" -PropertyType String -Value "1" -Force | Out-Null

Write-Host "Installation complete."
Write-Host "Extension path: $destDir"
Write-Host "Registry set: HKCU\Software\Adobe\CSXS.12\PlayerDebugMode=1"
Write-Host "Restart After Effects to reload CEP extensions."
