#!/usr/bin/env pwsh
# Скрипт для быстрого запуска портала документации VSS OMNI TELECOM

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "📚 VSS OMNI TELECOM - Портал документации" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Проверка наличия Docker
$dockerRunning = $false
try {
    docker ps | Out-Null
    $dockerRunning = $true
    Write-Host "✅ Docker запущен" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker не запущен или не установлен" -ForegroundColor Red
}

Write-Host ""
Write-Host "Выберите способ запуска:" -ForegroundColor Yellow
Write-Host "1. Docker Compose (рекомендуется)" -ForegroundColor White
Write-Host "2. Локально через npm" -ForegroundColor White
Write-Host "3. Только открыть в браузере" -ForegroundColor White
Write-Host "4. Остановить портал" -ForegroundColor White
Write-Host "5. Просмотреть логи" -ForegroundColor White
Write-Host "0. Выход" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Ваш выбор"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🚀 Запуск через Docker Compose..." -ForegroundColor Cyan
        
        if (-not $dockerRunning) {
            Write-Host "❌ Ошибка: Docker не запущен!" -ForegroundColor Red
            exit 1
        }
        
        docker-compose -f docker-compose.vss-demiurge-simple.yml up -d vss-docs
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Портал документации запущен!" -ForegroundColor Green
            Write-Host ""
            Write-Host "🌐 Откройте в браузере: http://localhost:3100" -ForegroundColor Yellow
            Write-Host ""
            
            Start-Sleep -Seconds 2
            Start-Process "http://localhost:3100"
        } else {
            Write-Host "❌ Ошибка при запуске!" -ForegroundColor Red
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "🚀 Локальный запуск через npm..." -ForegroundColor Cyan
        
        if (-not (Test-Path "docs-portal\node_modules")) {
            Write-Host "📦 Установка зависимостей..." -ForegroundColor Yellow
            Set-Location docs-portal
            npm install
            Set-Location ..
        }
        
        Write-Host ""
        Write-Host "▶️  Запуск сервера..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🌐 Откройте в браузере: http://localhost:3100" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "⚠️  Нажмите Ctrl+C для остановки" -ForegroundColor Yellow
        Write-Host ""
        
        Set-Location docs-portal
        npm start
        Set-Location ..
    }
    
    "3" {
        Write-Host ""
        Write-Host "🌐 Открытие в браузере..." -ForegroundColor Cyan
        Start-Process "http://localhost:3100"
        
        Write-Host ""
        Write-Host "ℹ️  Если портал не открывается, сначала запустите его (вариант 1 или 2)" -ForegroundColor Yellow
    }
    
    "4" {
        Write-Host ""
        Write-Host "🛑 Остановка портала..." -ForegroundColor Cyan
        
        if ($dockerRunning) {
            docker-compose -f docker-compose.vss-demiurge-simple.yml stop vss-docs
            Write-Host "✅ Портал остановлен" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Остановите локальный сервер нажав Ctrl+C в его терминале" -ForegroundColor Yellow
        }
    }
    
    "5" {
        Write-Host ""
        Write-Host "📋 Просмотр логов..." -ForegroundColor Cyan
        Write-Host ""
        
        if ($dockerRunning) {
            docker logs vss-docs-portal -f
        } else {
            Write-Host "❌ Docker не запущен" -ForegroundColor Red
        }
    }
    
    "0" {
        Write-Host ""
        Write-Host "👋 До свидания!" -ForegroundColor Cyan
        exit 0
    }
    
    default {
        Write-Host ""
        Write-Host "❌ Неверный выбор" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Для справки: см. QUICK-START-DOCS-PORTAL.md" -ForegroundColor Gray
Write-Host "=====================================" -ForegroundColor Cyan

