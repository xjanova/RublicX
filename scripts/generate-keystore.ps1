# scripts/generate-keystore.ps1 — one-shot helper for creating the RublicX release keystore
# and uploading the four required secrets to GitHub. Run once.
#
#   .\scripts\generate-keystore.ps1 -Password 'your-strong-password'

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Password,
    [string]$Alias = "rublicx",
    [string]$DName = "CN=RublicX, OU=Mobile, O=xjanova, L=Bangkok, ST=BKK, C=TH",
    [string]$Repo = "xjanova/RublicX",
    [string]$OutFile = "$env:USERPROFILE\rublicx.keystore"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
    throw "keytool not found in PATH. Install JDK (e.g. Temurin 17) and re-run."
}

if (Test-Path $OutFile) {
    Write-Host "Keystore already exists at $OutFile — keeping it. Delete the file manually if you want a fresh one."
} else {
    Write-Host "Generating keystore at $OutFile ..."
    keytool -genkeypair -v `
        -keystore $OutFile `
        -alias $Alias `
        -keyalg RSA -keysize 2048 -validity 10000 `
        -storetype JKS `
        -storepass $Password -keypass $Password `
        -dname $DName
}

Write-Host "Encoding keystore to base64 ..."
$bytes = [System.IO.File]::ReadAllBytes($OutFile)
$b64 = [Convert]::ToBase64String($bytes)

Write-Host "Uploading 4 secrets to $Repo via gh CLI ..."
$b64 | gh secret set ANDROID_KEYSTORE_BASE64 -R $Repo
$Password | gh secret set ANDROID_KEYSTORE_PASSWORD -R $Repo
$Alias | gh secret set ANDROID_KEY_ALIAS -R $Repo
$Password | gh secret set ANDROID_KEY_PASSWORD -R $Repo

Write-Host ""
Write-Host "Done. Trigger the workflow:"
Write-Host "  gh workflow run 'Build & Release Android APK' -R $Repo"
Write-Host ""
Write-Host "Back up the keystore: $OutFile"
Write-Host "If lost, future APKs will not install over the previous one."
