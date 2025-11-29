#!/usr/bin/env pwsh
<#
.SYNOPSIS
    VSS DEMIURGE Infrastructure Control Script
    
.DESCRIPTION
    Удобный скрипт для управления инфраструктурой VSS DEMIURGE
    
.EXAMPLE
    .\vss-control.ps1 start
    .\vss-control.ps1 stop
    .\vss-control.ps1 restart
    .\vss-control.ps1 status
    .\vss-control.ps1 logs
#>

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'rebuild', 'clean', 'ps', 'open', 'help')]
    [string]$Command = 'help',
    
    [Parameter(Position=1)]
    [string]$Service = ''
)

$COMPOSE_FILE = "docker-compose.vss-demiurge-simple.yml"
$PROJECT_NAME = "vss-demiurge"

function Show-Banner {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║       VSS DEMIURGE Infrastructure Control            ║" -ForegroundColor Cyan
    Write-Host "║              Telecom Platform v2.0                    ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Help {
    Show-Banner
    Write-Host "ИСПОЛЬЗОВАНИЕ:" -ForegroundColor Yellow
    Write-Host "  .\vss-control.ps1 [команда] [сервис]" -ForegroundColor White
    Write-Host ""
    Write-Host "КОМАНДЫ:" -ForegroundColor Yellow
    Write-Host "  start       " -ForegroundColor Green -NoNewline
    Write-Host "- Запустить всю инфраструктуру"
    Write-Host "  stop        " -ForegroundColor Red -NoNewline
    Write-Host "- Остановить всю инфраструктуру"
    Write-Host "  restart     " -ForegroundColor Cyan -NoNewline
    Write-Host "- Перезапустить инфраструктуру"
    Write-Host "  rebuild     " -ForegroundColor Magenta -NoNewline
    Write-Host "- Пересобрать и запустить (после изменений кода)"
    Write-Host "  status      " -ForegroundColor Blue -NoNewline
    Write-Host "- Показать статус всех сервисов"
    Write-Host "  ps          " -ForegroundColor Blue -NoNewline
    Write-Host "- Показать запущенные контейнеры"
    Write-Host "  logs        " -ForegroundColor Gray -NoNewline
    Write-Host "- Показать логи (добавьте имя сервиса)"
    Write-Host "  clean       " -ForegroundColor DarkRed -NoNewline
    Write-Host "- Удалить все контейнеры и volumes (⚠️  ПОТЕРЯ ДАННЫХ!)"
    Write-Host "  open        " -ForegroundColor Green -NoNewline
    Write-Host "- Открыть веб-интерфейсы в браузере"
    Write-Host "  help        " -ForegroundColor White -NoNewline
    Write-Host "- Показать эту справку"
    Write-Host ""
    Write-Host "ПРИМЕРЫ:" -ForegroundColor Yellow
    Write-Host "  .\vss-control.ps1 start                " -ForegroundColor White -NoNewline
    Write-Host "- Запустить все" -ForegroundColor Gray
    Write-Host "  .\vss-control.ps1 logs vss-workspace  " -ForegroundColor White -NoNewline
    Write-Host "- Логи Workspace" -ForegroundColor Gray
    Write-Host "  .\vss-control.ps1 rebuild              " -ForegroundColor White -NoNewline
    Write-Host "- Пересобрать после изменений" -ForegroundColor Gray
    Write-Host "  .\vss-control.ps1 restart vss-ottb    " -ForegroundColor White -NoNewline
    Write-Host "- Перезапустить OTTB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "СЕРВИСЫ:" -ForegroundColor Yellow
    Write-Host "  vss-workspace, vss-ottb, vss-dci, vss-point," -ForegroundColor Gray
    Write-Host "  vss-guacamole, rabbitmq, postgres, redis" -ForegroundColor Gray
    Write-Host ""
}

function Show-Status {
    Write-Host "📊 Статус сервисов VSS DEMIURGE:" -ForegroundColor Cyan
    Write-Host ""
    docker compose -f $COMPOSE_FILE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    Write-Host ""
    
    # Подсчет сервисов
    $running = (docker compose -f $COMPOSE_FILE ps --filter "status=running" -q | Measure-Object).Count
    $total = (docker compose -f $COMPOSE_FILE ps -q | Measure-Object).Count
    
    if ($running -eq $total -and $total -gt 0) {
        Write-Host "✅ Все сервисы запущены ($running/$total)" -ForegroundColor Green
    } elseif ($running -gt 0) {
        Write-Host "⚠️  Частично запущено ($running/$total)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Сервисы остановлены (0/$total)" -ForegroundColor Red
    }
    Write-Host ""
}

function Start-Infrastructure {
    Show-Banner
    Write-Host "🚀 Запуск инфраструктуры VSS DEMIURGE..." -ForegroundColor Green
    Write-Host ""
    
    docker compose -f $COMPOSE_FILE up -d
    
    Write-Host ""
    Write-Host "✅ Запуск инициирован. Ожидайте 1-2 минуты готовности." -ForegroundColor Green
    Write-Host ""
    Write-Host "Проверить статус: " -NoNewline
    Write-Host ".\vss-control.ps1 status" -ForegroundColor Cyan
    Write-Host "Смотреть логи:    " -NoNewline
    Write-Host ".\vss-control.ps1 logs" -ForegroundColor Cyan
    Write-Host ""
}

function Stop-Infrastructure {
    Show-Banner
    Write-Host "⏹️  Остановка инфраструктуры VSS DEMIURGE..." -ForegroundColor Red
    Write-Host ""
    
    docker compose -f $COMPOSE_FILE down
    
    Write-Host ""
    Write-Host "✅ Инфраструктура остановлена." -ForegroundColor Green
    Write-Host ""
}

function Restart-Infrastructure {
    param([string]$ServiceName)
    
    Show-Banner
    
    if ($ServiceName) {
        Write-Host "🔄 Перезапуск сервиса: $ServiceName" -ForegroundColor Cyan
        docker compose -f $COMPOSE_FILE restart $ServiceName
    } else {
        Write-Host "🔄 Перезапуск всей инфраструктуры..." -ForegroundColor Cyan
        docker compose -f $COMPOSE_FILE restart
    }
    
    Write-Host ""
    Write-Host "✅ Перезапуск завершен." -ForegroundColor Green
    Write-Host ""
}

function Rebuild-Infrastructure {
    Show-Banner
    Write-Host "🔨 Пересборка и запуск инфраструктуры..." -ForegroundColor Magenta
    Write-Host ""
    Write-Host "⚠️  Это займет несколько минут..." -ForegroundColor Yellow
    Write-Host ""
    
    # Останавливаем
    Write-Host "1️⃣  Остановка контейнеров..." -ForegroundColor Gray
    docker compose -f $COMPOSE_FILE down
    
    # Пересборка и запуск
    Write-Host "2️⃣  Пересборка образов..." -ForegroundColor Gray
    docker compose -f $COMPOSE_FILE build --no-cache
    
    Write-Host "3️⃣  Запуск сервисов..." -ForegroundColor Gray
    docker compose -f $COMPOSE_FILE up -d
    
    Write-Host ""
    Write-Host "✅ Пересборка завершена. Ожидайте готовности сервисов (1-2 минуты)." -ForegroundColor Green
    Write-Host ""
    Write-Host "Проверить статус: " -NoNewline
    Write-Host ".\vss-control.ps1 status" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Logs {
    param([string]$ServiceName)
    
    if ($ServiceName) {
        Write-Host "📋 Логи сервиса: $ServiceName" -ForegroundColor Cyan
        Write-Host "Нажмите Ctrl+C для выхода" -ForegroundColor Gray
        Write-Host ""
        docker compose -f $COMPOSE_FILE logs -f --tail=100 $ServiceName
    } else {
        Write-Host "📋 Логи всех сервисов" -ForegroundColor Cyan
        Write-Host "Нажмите Ctrl+C для выхода" -ForegroundColor Gray
        Write-Host ""
        docker compose -f $COMPOSE_FILE logs -f --tail=50
    }
}

function Clean-Infrastructure {
    Show-Banner
    Write-Host "⚠️  ВНИМАНИЕ: Это удалит все контейнеры и данные!" -ForegroundColor Red
    Write-Host ""
    $confirmation = Read-Host "Вы уверены? Введите 'yes' для подтверждения"
    
    if ($confirmation -eq 'yes') {
        Write-Host ""
        Write-Host "🗑️  Удаление инфраструктуры и данных..." -ForegroundColor Red
        docker compose -f $COMPOSE_FILE down -v
        
        Write-Host ""
        Write-Host "✅ Очистка завершена." -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Отменено." -ForegroundColor Yellow
        Write-Host ""
    }
}

function Open-Interfaces {
    Show-Banner
    Write-Host "🌐 Открытие веб-интерфейсов..." -ForegroundColor Green
    Write-Host ""
    
    $urls = @{
        "VSS Workspace" = "http://localhost:3000"
        "RabbitMQ Management" = "http://localhost:15672"
        "Guacamole" = "http://localhost:8080/guacamole"
        "VSS Point API" = "http://localhost:8081"
        "VSS DCI API" = "http://localhost:8082"
        "VSS OTTB API" = "http://localhost:8083"
    }
    
    foreach ($name in $urls.Keys) {
        Write-Host "  $name : " -NoNewline -ForegroundColor Cyan
        Write-Host $urls[$name] -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "Открыть в браузере?" -ForegroundColor Yellow
    Write-Host "1) VSS Workspace (Главный интерфейс)" -ForegroundColor White
    Write-Host "2) RabbitMQ Management" -ForegroundColor White
    Write-Host "3) Guacamole (Удаленный доступ)" -ForegroundColor White
    Write-Host "4) Открыть все" -ForegroundColor White
    Write-Host "0) Отмена" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "Выберите (0-4)"
    
    switch ($choice) {
        "1" { Start-Process "http://localhost:3000" }
        "2" { Start-Process "http://localhost:15672" }
        "3" { Start-Process "http://localhost:8080/guacamole" }
        "4" {
            Start-Process "http://localhost:3000"
            Start-Sleep -Milliseconds 500
            Start-Process "http://localhost:15672"
            Start-Sleep -Milliseconds 500
            Start-Process "http://localhost:8080/guacamole"
        }
        default { Write-Host "Отменено." -ForegroundColor Gray }
    }
    Write-Host ""
}

# Основная логика
switch ($Command.ToLower()) {
    'start' { 
        Start-Infrastructure 
    }
    'stop' { 
        Stop-Infrastructure 
    }
    'restart' { 
        Restart-Infrastructure -ServiceName $Service 
    }
    'status' { 
        Show-Banner
        Show-Status 
    }
    'ps' { 
        Show-Banner
        docker compose -f $COMPOSE_FILE ps 
    }
    'logs' { 
        Show-Logs -ServiceName $Service 
    }
    'rebuild' { 
        Rebuild-Infrastructure 
    }
    'clean' { 
        Clean-Infrastructure 
    }
    'open' { 
        Open-Interfaces 
    }
    'help' { 
        Show-Help 
    }
    default { 
        Show-Help 
    }
}

