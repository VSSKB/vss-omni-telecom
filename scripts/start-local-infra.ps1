# Скрипт для запуска всей инфраструктуры локально (RabbitMQ, PostgreSQL, Redis)
# Используется для локальной разработки сервисов

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Запуск локальной инфраструктуры VSS OTTB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверяем Docker
Write-Host "Проверка Docker..." -ForegroundColor Yellow
$dockerCheck = docker --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка: Docker не установлен или не запущен!" -ForegroundColor Red
    exit 1
}
Write-Host "Docker: $dockerCheck" -ForegroundColor Green
Write-Host ""

# Функция для запуска контейнера
function Start-Container {
    param($Name, $Image, $Ports, $EnvVars, $Volumes = @())
    
    # Проверяем, существует ли контейнер
    $existing = docker ps -a --filter "name=$Name" --format "{{.Names}}"
    if ($existing -eq $Name) {
        $status = docker ps --filter "name=$Name" --format "{{.Status}}"
        if ($status) {
            Write-Host "$Name уже запущен" -ForegroundColor Green
            return $true
        } else {
            Write-Host "Запуск существующего контейнера $Name..." -ForegroundColor Yellow
            docker start $Name | Out-Null
            return $true
        }
    }
    
    # Создаем новый контейнер
    Write-Host "Создание контейнера $Name..." -ForegroundColor Cyan
    $dockerCmd = "docker run -d --name $Name"
    
    foreach ($port in $Ports) {
        $dockerCmd += " -p $port"
    }
    
    foreach ($env in $EnvVars) {
        $dockerCmd += " -e $env"
    }
    
    foreach ($vol in $Volumes) {
        $dockerCmd += " -v $vol"
    }
    
    $dockerCmd += " $Image"
    
    Invoke-Expression $dockerCmd | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "$Name успешно создан и запущен" -ForegroundColor Green
        return $true
    } else {
        Write-Host "Ошибка при создании $Name" -ForegroundColor Red
        return $false
    }
}

# 1. RabbitMQ
Write-Host "1. Запуск RabbitMQ..." -ForegroundColor Cyan
Start-Container -Name "rabbitmq-local" `
    -Image "rabbitmq:3.12-management-alpine" `
    -Ports @("5672:5672", "15672:15672") `
    -EnvVars @(
        "RABBITMQ_DEFAULT_USER=vss-admin",
        "RABBITMQ_DEFAULT_PASS=vss_rabbit_pass",
        "RABBITMQ_DEFAULT_VHOST=/vss"
    ) | Out-Null

# 2. PostgreSQL
Write-Host "2. Запуск PostgreSQL..." -ForegroundColor Cyan
Start-Container -Name "postgres-local" `
    -Image "postgres:15-alpine" `
    -Ports @("5432:5432") `
    -EnvVars @(
        "POSTGRES_DB=vss_db",
        "POSTGRES_USER=vss",
        "POSTGRES_PASSWORD=vss_postgres_pass",
        "PGDATA=/var/lib/postgresql/data/pgdata"
    ) | Out-Null

# 3. Redis
Write-Host "3. Запуск Redis..." -ForegroundColor Cyan
Start-Container -Name "redis-local" `
    -Image "redis:7-alpine" `
    -Ports @("6379:6379") `
    -EnvVars @() | Out-Null

Write-Host ""
Write-Host "Ожидание инициализации сервисов (15 секунд)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Инфраструктура запущена!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Доступные сервисы:" -ForegroundColor Cyan
Write-Host "  - RabbitMQ:        amqp://localhost:5672" -ForegroundColor White
Write-Host "  - RabbitMQ UI:     http://localhost:15672 (vss-admin / vss_rabbit_pass)" -ForegroundColor White
Write-Host "  - PostgreSQL:      postgresql://vss:vss_postgres_pass@localhost:5432/vss_db" -ForegroundColor White
Write-Host "  - Redis:           redis://localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "Следующий шаг:" -ForegroundColor Yellow
Write-Host "  1. Применить миграции: docker exec -i postgres-local psql -U vss -d vss_db < database/migrations/002_f_flow_system.sql" -ForegroundColor White
Write-Host "  2. Запустить сервисы локально: cd services/workspace && npm start" -ForegroundColor White
Write-Host ""

