# VSS OMNI TELECOM - Health Check Script (PowerShell)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "VSS OMNI TELECOM - Health Check" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$failed = 0

# Функция проверки HTTP endpoint
function Check-Http {
    param (
        [string]$Url,
        [string]$Name
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        if ($statusCode -eq 200 -or $statusCode -eq 401 -or $statusCode -eq 403) {
            Write-Host "[OK] $Name - HTTP $statusCode" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[FAIL] $Name - HTTP $statusCode" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[FAIL] $Name - Connection failed" -ForegroundColor Red
        return $false
    }
}

# Функция проверки Docker контейнера
function Check-Container {
    param (
        [string]$Name
    )
    
    $container = docker ps --format '{{.Names}}' | Select-String -Pattern "^${Name}$"
    if ($container) {
        $status = docker inspect --format='{{.State.Status}}' $Name 2>$null
        if ($status -eq "running") {
            Write-Host "[OK] Container $Name - Running" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[FAIL] Container $Name - Status: $status" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "[FAIL] Container $Name - Not found" -ForegroundColor Red
        return $false
    }
}

# Функция проверки PostgreSQL
function Check-Postgres {
    $container = docker ps -q -f name=vss-postgres
    if (-not $container) {
        Write-Host "[FAIL] PostgreSQL - Container not found" -ForegroundColor Red
        return $false
    }
    
    try {
        docker exec $container pg_isready -U vss | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] PostgreSQL - Ready" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[FAIL] PostgreSQL - Not ready" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[FAIL] PostgreSQL - Not ready" -ForegroundColor Red
        return $false
    }
}

# Функция проверки Redis
function Check-Redis {
    $container = docker ps -q -f name=vss-redis
    if (-not $container) {
        Write-Host "[FAIL] Redis - Container not found" -ForegroundColor Red
        return $false
    }
    
    try {
        docker exec $container redis-cli ping | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Redis - Ready" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[FAIL] Redis - Not ready" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[FAIL] Redis - Not ready" -ForegroundColor Red
        return $false
    }
}

# Функция проверки RabbitMQ
function Check-RabbitMQ {
    $container = docker ps -q -f name=vss-rabbitmq
    if (-not $container) {
        Write-Host "[FAIL] RabbitMQ - Container not found" -ForegroundColor Red
        return $false
    }
    
    try {
        docker exec $container rabbitmq-diagnostics ping | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] RabbitMQ - Ready" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[FAIL] RabbitMQ - Not ready" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[FAIL] RabbitMQ - Not ready" -ForegroundColor Red
        return $false
    }
}

Write-Host "[VSS] Running health checks..." -ForegroundColor Yellow
Write-Host ""

# Проверка контейнеров
Write-Host "Checking containers..." -ForegroundColor Yellow
if (-not (Check-Container "vss-postgres")) { $failed++ }
if (-not (Check-Container "vss-redis")) { $failed++ }
if (-not (Check-Container "vss-rabbitmq")) { $failed++ }
if (-not (Check-Container "vss-ottb")) { $failed++ }
if (-not (Check-Container "vss-dci")) { $failed++ }
if (-not (Check-Container "vss-point")) { $failed++ }
if (-not (Check-Container "vss-workspace")) { $failed++ }
if (-not (Check-Container "vss-guacamole")) { $failed++ }
Write-Host ""

# Проверка баз данных
Write-Host "Checking databases..." -ForegroundColor Yellow
if (-not (Check-Postgres)) { $failed++ }
if (-not (Check-Redis)) { $failed++ }
if (-not (Check-RabbitMQ)) { $failed++ }
Write-Host ""

# Проверка HTTP endpoints
Write-Host "Checking HTTP endpoints..." -ForegroundColor Yellow
if (-not (Check-Http "http://localhost:3000/health" "WORKSPACE")) { $failed++ }
if (-not (Check-Http "http://localhost:8083/health" "OTTB")) { $failed++ }
if (-not (Check-Http "http://localhost:8082/health" "DCI")) { $failed++ }
if (-not (Check-Http "http://localhost:8081/health" "POINT")) { $failed++ }
if (-not (Check-Http "http://localhost:8080/guacamole" "Guacamole")) { $failed++ }
if (-not (Check-Http "http://localhost:15672" "RabbitMQ Management")) { $failed++ }
Write-Host ""

# Итоговый результат
if ($failed -eq 0) {
    Write-Host "[VSS] All services are healthy!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[VSS] Health check failed: $failed service(s) are not healthy" -ForegroundColor Red
    exit 1
}

