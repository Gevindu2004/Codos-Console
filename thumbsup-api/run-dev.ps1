# ThumbsUp Email API - start the server on Windows.
# Usage (from the Codos-Console folder):   .\thumbsup-api\run-dev.ps1
# First run creates a virtual environment, installs packages and creates .env.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment (first run only)..." -ForegroundColor Cyan
    python -m venv .venv
    & .\.venv\Scripts\python.exe -m pip install --upgrade pip
}
# Always make sure packages match requirements.txt (fast when nothing changed)
& .\.venv\Scripts\python.exe -m pip install -q -r requirements.txt

if (-not (Test-Path ".env")) {
    Copy-Item .env.example .env
    $secret = & .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
    (Get-Content .env) -replace '^JWT_SECRET=.*', "JWT_SECRET=$secret" | Set-Content .env
    Write-Host ""
    Write-Host "Created thumbsup-api\.env" -ForegroundColor Yellow
    Write-Host "Open it and fill in SMTP_USERNAME, SMTP_PASSWORD and DEFAULT_FROM_EMAIL, then run this script again." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "ThumbsUp Email API  ->  http://localhost:8001" -ForegroundColor Green
Write-Host "API reference       ->  http://localhost:8001/docs" -ForegroundColor Green
Write-Host ""
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --reload-include ".env" --port 8001
