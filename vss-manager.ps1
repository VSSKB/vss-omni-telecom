# VSS DEMIURGE Infrastructure Manager
# Удобное управление всей инфраструктурой VSS из PowerShell

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'rebuild', 'clean', 'help')]
    [string]$Action = 'help',
    
    [Parameter(Position=1)]
    [string]$Service = '',
    
    [switch]$Follow,
    [switch]$Build,
    [int]$Tail = 50
)

$ErrorActionPreference = "Continue"
$ComposeFile = "docker-compose.vss-demiurge-simple.yml"
$ProjectRoot = $PSScriptRoot

# Цвета для вывода
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Header { param($Message) Write-Host "`n$('='*60)" -ForegroundColor Magenta; Write-Host "  $Message" -ForegroundColor Magenta; Write-Host "$('='*60)" -ForegroundColor Magenta }

# Проверка Docker
function Test-Docker {
    try {
        $null = docker --version 2>$null
        return $true
    } catch {
        Write-Error "Docker не установлен или не запущен!"
        Write-Info "Установите Docker Desktop: https://www.docker.com/products/docker-desktop"
        return $false
    }
}

# Проверка Docker Compose
function Test-DockerCompose {
    try {
        $null = docker compose version 2>$null
        return "docker compose"
    } catch {
        try {
            $null = docker-compose --version 2>$null
            return "docker-compose"
        } catch {
            Write-Error "Docker Compose не найден!"
            return $null
        }
    }
}

# Главная функция
function Main {
    Set-Location $ProjectRoot
    
    if (-not (Test-Docker)) { return }
    $composeCmd = Test-DockerCompose
    if (-not $composeCmd) { return }
    
    switch ($Action) {
        'start' {
            Start-Infrastructure $composeCmd
        }
        'stop' {
            Stop-Infrastructure $composeCmd
        }
        'restart' {
            Restart-Infrastructure $composeCmd
        }
        'status' {
            Show-Status $composeCmd
        }
        'logs' {
            Show-Logs $composeCmd
        }
        'rebuild' {
            Rebuild-Infrastructure $composeCmd
        }
        'clean' {
            Clean-Infrastructure $composeCmd
        }
        'help' {
            Show-Help
        }
    }
}

# Запуск инфраструктуры
function Start-Infrastructure {
    param($composeCmd)
    
    Write-Header "ЗАПУСК VSS DEMIURGE INFRASTRUCTURE"
    
    Write-Info "Проверка текущего состояния..."
    $running = & $composeCmd -f $ComposeFile ps -q 2>$null
    
    if ($running) {
        Write-Warning "Некоторые контейнеры уже запущены"
        $response = Read-Host "Перезапустить? (y/N)"
        if ($response -ne 'y' -and $response -ne 'Y') {
            Write-Info "Отменено"
            return
        }
        Write-Info "Останавливаем существующие контейнеры..."
        & $composeCmd -f $ComposeFile down
    }
    
    Write-Info "Запуск всех сервисов..."
    
    if ($Build) {
        Write-Info "Режим пересборки образов..."
        & $composeCmd -f $ComposeFile up -d --build
    } else {
        & $composeCmd -f $ComposeFile up -d
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Инфраструктура запущена!"
        Write-Info "`nОжидание готовности сервисов (30 сек)..."
        Start-Sleep -Seconds 5
        
        Write-Info "Промежуточный статус:"
        Show-Status $composeCmd
        
        Write-Info "`nСервисы инициализируются. Полная готовность через 1-2 минуты."
        Write-Info "Проверить статус: .\vss-manager.ps1 status"
        Write-Info "Смотреть логи: .\vss-manager.ps1 logs -Follow"
        
        Write-Header "ДОСТУП К СЕРВИСАМ"
        Write-Host "🌐 VSS Workspace:      " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Yellow
        Write-Host "🐰 RabbitMQ Management:" -NoNewline; Write-Host "http://localhost:15672" -ForegroundColor Yellow
        Write-Host "🖥️  Guacamole:         " -NoNewline; Write-Host "http://localhost:8080/guacamole" -ForegroundColor Yellow
        Write-Host "🔐 VSS Point API:      " -NoNewline; Write-Host "http://localhost:8081" -ForegroundColor Yellow
        Write-Host "💾 VSS DCI API:        " -NoNewline; Write-Host "http://localhost:8082" -ForegroundColor Yellow
        Write-Host "📞 VSS OTTB API:       " -NoNewline; Write-Host "http://localhost:8083" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Error "Ошибка при запуске инфраструктуры!"
        Write-Info "Смотрите логи: .\vss-manager.ps1 logs"
    }
}

# Остановка инфраструктуры
function Stop-Infrastructure {
    param($composeCmd)
    
    Write-Header "ОСТАНОВКА VSS DEMIURGE INFRASTRUCTURE"
    
    Write-Info "Останавливаем все контейнеры..."
    & $composeCmd -f $ComposeFile down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Инфраструктура остановлена"
    } else {
        Write-Error "Ошибка при остановке"
    }
}

# Перезапуск
function Restart-Infrastructure {
    param($composeCmd)
    
    Write-Header "ПЕРЕЗАПУСК VSS DEMIURGE INFRASTRUCTURE"
    
    if ($Service) {
        Write-Info "Перезапуск сервиса: $Service"
        & $composeCmd -f $ComposeFile restart $Service
    } else {
        Write-Info "Перезапуск всех сервисов..."
        & $composeCmd -f $ComposeFile restart
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Перезапуск завершен"
        Start-Sleep -Seconds 3
        Show-Status $composeCmd
    } else {
        Write-Error "Ошибка при перезапуске"
    }
}

# Статус
function Show-Status {
    param($composeCmd)
    
    Write-Header "СТАТУС VSS DEMIURGE INFRASTRUCTURE"
    
    Write-Host ""
    & $composeCmd -f $ComposeFile ps
    Write-Host ""
    
    # Подсчет контейнеров
    $allContainers = @(& $composeCmd -f $ComposeFile ps -q)
    $runningContainers = @(& $composeCmd -f $ComposeFile ps -q --filter "status=running")
    
    Write-Host "📊 Всего контейнеров:   " -NoNewline
    Write-Host "$($allContainers.Count)" -ForegroundColor Cyan
    Write-Host "✅ Запущено:            " -NoNewline
    Write-Host "$($runningContainers.Count)" -ForegroundColor Green
    Write-Host "❌ Остановлено/Ошибка:  " -NoNewline
    Write-Host "$($allContainers.Count - $runningContainers.Count)" -ForegroundColor $(if ($allContainers.Count -eq $runningContainers.Count) { "Green" } else { "Red" })
    Write-Host ""
    
    # Проверка здоровья
    Write-Info "Проверка health checks..."
    $healthChecks = @{
        "PostgreSQL" = { docker exec vss-postgres pg_isready -U vss 2>$null }
        "Redis" = { docker exec vss-redis redis-cli ping 2>$null }
        "RabbitMQ" = { docker exec vss-rabbitmq rabbitmq-diagnostics ping 2>$null }
    }
    
    foreach ($service in $healthChecks.Keys) {
        try {
            $result = & $healthChecks[$service]
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ $service" -ForegroundColor Green -NoNewline
                Write-Host " - healthy" -ForegroundColor DarkGray
            } else {
                Write-Host "  ⚠️  $service" -ForegroundColor Yellow -NoNewline
                Write-Host " - not ready" -ForegroundColor DarkGray
            }
        } catch {
            Write-Host "  ❌ $service" -ForegroundColor Red -NoNewline
            Write-Host " - not running" -ForegroundColor DarkGray
        }
    }
    Write-Host ""
}

# Логи
function Show-Logs {
    param($composeCmd)
    
    Write-Header "ЛОГИ VSS DEMIURGE"
    
    $params = @('-f', $ComposeFile, 'logs', "--tail=$Tail")
    
    if ($Follow) {
        $params += '-f'
        Write-Info "Следим за логами в реальном времени (Ctrl+C для выхода)..."
    }
    
    if ($Service) {
        $params += $Service
        Write-Info "Сервис: $Service"
    } else {
        Write-Info "Все сервисы"
    }
    
    Write-Host ""
    & $composeCmd @params
}

# Пересборка
function Rebuild-Infrastructure {
    param($composeCmd)
    
    Write-Header "ПЕРЕСБОРКА VSS DEMIURGE INFRASTRUCTURE"
    
    Write-Warning "Это пересоберет все Docker образы с нуля!"
    $response = Read-Host "Продолжить? (y/N)"
    
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Info "Отменено"
        return
    }
    
    Write-Info "Останавливаем контейнеры..."
    & $composeCmd -f $ComposeFile down
    
    Write-Info "Пересборка образов..."
    & $composeCmd -f $ComposeFile build --no-cache
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Образы пересобраны!"
        Write-Info "`nЗапустить инфраструктуру: .\vss-manager.ps1 start"
    } else {
        Write-Error "Ошибка при пересборке!"
    }
}

# Полная очистка
function Clean-Infrastructure {
    param($composeCmd)
    
    Write-Header "ПОЛНАЯ ОЧИСТКА VSS DEMIURGE"
    
    Write-Warning "⚠️  ЭТО УДАЛИТ:"
    Write-Host "   - Все контейнеры VSS"
    Write-Host "   - Все Docker образы VSS"
    Write-Host "   - Все volumes (базы данных, кэш, очереди)"
    Write-Host "   ⚠️  ПОТЕРЯ ВСЕХ ДАННЫХ!"
    Write-Host ""
    
    $response = Read-Host "Вы уверены? Введите 'DELETE' для подтверждения"
    
    if ($response -ne 'DELETE') {
        Write-Info "Отменено"
        return
    }
    
    Write-Info "Останавливаем и удаляем контейнеры..."
    & $composeCmd -f $ComposeFile down -v --rmi all --remove-orphans
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Инфраструктура полностью очищена"
        Write-Info "`nДля повторного запуска: .\vss-manager.ps1 start -Build"
    } else {
        Write-Error "Ошибка при очистке!"
    }
}

# Справка
function Show-Help {
    Write-Header "VSS DEMIURGE INFRASTRUCTURE MANAGER"
    
    Write-Host @"

📖 ИСПОЛЬЗОВАНИЕ:
    .\vss-manager.ps1 <команда> [опции]

🎯 КОМАНДЫ:

    start       Запустить всю инфраструктуру
                Опции: -Build (пересобрать образы)
                
    stop        Остановить всю инфраструктуру
    
    restart     Перезапустить инфраструктуру
                Опции: [service_name] (конкретный сервис)
                
    status      Показать статус всех сервисов
    
    logs        Показать логи
                Опции: -Follow (следить в реальном времени)
                       -Tail N (последние N строк, по умолчанию 50)
                       [service_name] (конкретный сервис)
                       
    rebuild     Пересобрать все Docker образы с нуля
    
    clean       Полная очистка (удаление контейнеров, образов, volumes)
    
    help        Показать эту справку

📋 ПРИМЕРЫ:

    # Запустить всю инфраструктуру
    .\vss-manager.ps1 start

    # Запустить с пересборкой образов
    .\vss-manager.ps1 start -Build

    # Проверить статус
    .\vss-manager.ps1 status

    # Следить за всеми логами
    .\vss-manager.ps1 logs -Follow

    # Логи конкретного сервиса
    .\vss-manager.ps1 logs vss-workspace -Follow

    # Перезапустить конкретный сервис
    .\vss-manager.ps1 restart vss-workspace

    # Остановить всё
    .\vss-manager.ps1 stop

    # Пересобрать образы
    .\vss-manager.ps1 rebuild

🎛️  ДОСТУПНЫЕ СЕРВИСЫ:

    vss-workspace     - UI Backend & CRM (порт 3000)
    vss-ottb          - Telecom Core (порт 8083)
    vss-dci           - Data & CI/CD (порт 8082)
    vss-point         - Auth & RBAC (порт 8081)
    vss-guacamole     - Remote Access (порт 8080)
    guacd             - Guacamole Daemon
    rabbitmq          - Message Bus (порты 5672, 15672)
    postgres          - Database (порт 5432)
    redis             - Cache (порт 6379)

🌐 ДОСТУП К СЕРВИСАМ:

    Workspace:      http://localhost:3000
    RabbitMQ:       http://localhost:15672 (vss-admin / vss_rabbit_pass)
    Guacamole:      http://localhost:8080/guacamole
    Point API:      http://localhost:8081
    DCI API:        http://localhost:8082
    OTTB API:       http://localhost:8083
    PostgreSQL:     localhost:5432 (vss / vss_postgres_pass)
    Redis:          localhost:6379

📚 ДОКУМЕНТАЦИЯ:

    VSS-INFRASTRUCTURE-TOUR.md  - Полная экскурсия по инфраструктуре
    VSS-STATUS-REPORT.md        - Отчет о статусе и troubleshooting
    docs/ARCHITECTURE.md        - Архитектурная документация
    docs/API-REFERENCE.md       - API справочник

"@ -ForegroundColor Cyan
}

# Запуск
Main

