# VSS OMNI TELECOM - Startup Script (PowerShell)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "VSS OMNI TELECOM - Startup Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Проверка Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[VSS] Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Проверка, что Docker запущен
try {
    docker ps | Out-Null
} catch {
    Write-Host "[VSS] Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Определение команды docker-compose
$composeCmd = "docker-compose"
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    $composeCmd = "docker compose"
}

# Проверка наличия docker-compose файла
$composeFile = "docker-compose.vss-demiurge.yml"
if (-not (Test-Path $composeFile)) {
    $composeFile = "docker-compose.yml"
    if (-not (Test-Path $composeFile)) {
        Write-Host "[VSS] Docker Compose file not found!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[VSS] Starting services with Docker Compose..." -ForegroundColor Blue
& $composeCmd -f $composeFile up -d

# Ожидание запуска сервисов
Write-Host "[VSS] Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Проверка статуса контейнеров
Write-Host "[VSS] Checking container status..." -ForegroundColor Blue
& $composeCmd -f $composeFile ps

# Ожидание готовности PostgreSQL
Write-Host "[VSS] Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
$postgresContainer = docker ps -q -f name=vss-postgres

while ($retryCount -lt $maxRetries) {
    try {
        docker exec $postgresContainer pg_isready -U vss | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[VSS] PostgreSQL is ready!" -ForegroundColor Green
            break
        }
    } catch {
        # Continue waiting
    }
    $retryCount++
    Write-Host "[VSS] Waiting for PostgreSQL... ($retryCount/$maxRetries)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

if ($retryCount -eq $maxRetries) {
    Write-Host "[VSS] PostgreSQL failed to start within timeout" -ForegroundColor Red
    exit 1
}

# Ожидание готовности Redis
Write-Host "[VSS] Waiting for Redis to be ready..." -ForegroundColor Yellow
$retryCount = 0
$redisContainer = docker ps -q -f name=vss-redis

while ($retryCount -lt $maxRetries) {
    try {
        docker exec $redisContainer redis-cli ping | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[VSS] Redis is ready!" -ForegroundColor Green
            break
        }
    } catch {
        # Continue waiting
    }
    $retryCount++
    Write-Host "[VSS] Waiting for Redis... ($retryCount/$maxRetries)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

if ($retryCount -eq $maxRetries) {
    Write-Host "[VSS] Redis failed to start within timeout" -ForegroundColor Red
    exit 1
}

# Инициализация базы данных (если нужно)
if (Test-Path "database\init\01-init-schema.sql") {
    Write-Host "[VSS] Database schema will be initialized automatically on first start" -ForegroundColor Blue
}

# Запуск health-check
Write-Host "[VSS] Running health checks..." -ForegroundColor Blue
if (Test-Path "scripts\health.ps1") {
    & .\scripts\health.ps1
} else {
    Write-Host "[VSS] Health check script not found, skipping..." -ForegroundColor Yellow
}

Write-Host "[VSS] Startup complete!" -ForegroundColor Green
Write-Host "[VSS] Services are running." -ForegroundColor Green
Write-Host "[VSS] Access points:" -ForegroundColor Blue
Write-Host "  - WORKSPACE: http://localhost:3000" -ForegroundColor White
Write-Host "  - OTTB API: http://localhost:8083" -ForegroundColor White
Write-Host "  - DCI API: http://localhost:8082" -ForegroundColor White
Write-Host "  - POINT API: http://localhost:8081" -ForegroundColor White
Write-Host "  - Guacamole: http://localhost:8080/guacamole" -ForegroundColor White
Write-Host "  - RabbitMQ Management: http://localhost:15672" -ForegroundColor White

