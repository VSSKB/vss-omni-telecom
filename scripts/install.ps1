# VSS OMNI TELECOM - Installation Script (PowerShell)
# Run as Administrator

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "VSS OMNI TELECOM - Installation Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Проверка прав администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Please run as Administrator" -ForegroundColor Red
    exit 1
}

Write-Host "[VSS] Installing platform dependencies..." -ForegroundColor Green

# Проверка и установка Chocolatey (если не установлен)
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "[VSS] Installing Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Установка базовых зависимостей через Chocolatey
Write-Host "[VSS] Installing base dependencies..." -ForegroundColor Yellow
choco install -y git nodejs-lts python3 docker-desktop postgresql redis-64 adb

# Установка Node.js модулей для всех сервисов
Write-Host "[VSS] Installing Node.js dependencies..." -ForegroundColor Yellow

# OTTB Core
if (Test-Path "services\ottb") {
    Write-Host "[VSS] Installing OTTB dependencies..." -ForegroundColor Green
    Set-Location services\ottb
    npm install
    Set-Location ..\..
}

# DCI
if (Test-Path "services\dci") {
    Write-Host "[VSS] Installing DCI dependencies..." -ForegroundColor Green
    Set-Location services\dci
    npm install
    Set-Location ..\..
}

# POINT
if (Test-Path "services\point") {
    Write-Host "[VSS] Installing POINT dependencies..." -ForegroundColor Green
    Set-Location services\point
    npm install
    Set-Location ..\..
}

# WORKSPACE
if (Test-Path "services\workspace") {
    Write-Host "[VSS] Installing WORKSPACE dependencies..." -ForegroundColor Green
    Set-Location services\workspace
    npm install
    Set-Location ..\..
}

# Установка зависимостей для главного приложения
if (Test-Path "package.json") {
    Write-Host "[VSS] Installing main application dependencies..." -ForegroundColor Green
    npm install
}

# Установка зависимостей для admin-backend
if (Test-Path "admin-backend") {
    Write-Host "[VSS] Installing admin-backend dependencies..." -ForegroundColor Green
    Set-Location admin-backend
    npm install
    Set-Location ..
}

# Установка Python зависимостей для MF-HUB (если есть)
if (Test-Path "services\mf-hub\requirements.txt") {
    Write-Host "[VSS] Installing Python dependencies for MF-HUB..." -ForegroundColor Yellow
    python -m pip install --upgrade pip
    pip install -r services\mf-hub\requirements.txt
}

# Создание необходимых директорий
Write-Host "[VSS] Creating required directories..." -ForegroundColor Yellow
$directories = @(
    "C:\vss\data",
    "C:\vss\logs",
    "C:\vss\config",
    "C:\vss\data\postgres",
    "C:\vss\data\redis",
    "C:\vss\data\guacamole",
    "C:\vss\logs\ottb",
    "C:\vss\logs\dci",
    "C:\vss\logs\point",
    "C:\vss\logs\workspace"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

Write-Host "[VSS] Installation complete!" -ForegroundColor Green
Write-Host "[VSS] Next steps:" -ForegroundColor Green
Write-Host "  1. Start Docker Desktop" -ForegroundColor Yellow
Write-Host "  2. Start services: .\scripts\startup.ps1" -ForegroundColor Yellow
Write-Host "  3. Check health: .\scripts\health.ps1" -ForegroundColor Yellow

