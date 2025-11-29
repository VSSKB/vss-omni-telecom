# VSS Infrastructure Audit and Start Script
# Полный аудит инфраструктуры, тесты и запуск проекта

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🔍 VSS INFRASTRUCTURE AUDIT & TEST SUITE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0
$warnings = 0

function Test-Command {
    param($Name, $Command, $Test)
    try {
        $result = & $Command 2>&1
        if ($Test) {
            $testResult = & $Test $result
            if ($testResult) {
                Write-Host "✅ $Name" -ForegroundColor Green
                $script:passed++
                return $true
            } else {
                Write-Host "⚠️  $Name - предупреждение" -ForegroundColor Yellow
                $script:warnings++
                return $false
            }
        } else {
            Write-Host "✅ $Name" -ForegroundColor Green
            if ($result) { Write-Host "   $result" -ForegroundColor Gray }
            $script:passed++
            return $true
        }
    } catch {
        Write-Host "❌ $Name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

function Test-Port {
    param($Port, $Name)
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
        if ($connection) {
            Write-Host "✅ $Name (порт $Port) - доступен" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            Write-Host "⚠️  $Name (порт $Port) - недоступен" -ForegroundColor Yellow
            $script:warnings++
            return $false
        }
    } catch {
        Write-Host "⚠️  $Name (порт $Port) - недоступен" -ForegroundColor Yellow
        $script:warnings++
        return $false
    }
}

# Тест 1: Docker
Write-Host "📦 Проверка зависимостей:" -ForegroundColor Cyan
Write-Host ""
Test-Command "Docker установлен" { docker --version }
Test-Command "Docker Compose установлен" { 
    try { docker-compose --version } catch { docker compose version }
}

# Тест 2: Node.js
Test-Command "Node.js установлен" { node -v }

# Тест 3: Проверка портов
Write-Host ""
Write-Host "📡 Проверка портов:" -ForegroundColor Cyan
Write-Host ""
Test-Port 3000 "VSS Workspace"
Test-Port 8083 "VSS OTTB"
Test-Port 8082 "VSS DCI"
Test-Port 8081 "VSS POINT"
Test-Port 8181 "Admin Backend"
Test-Port 5432 "PostgreSQL"
Test-Port 6379 "Redis"
Test-Port 5672 "RabbitMQ"
Test-Port 15672 "RabbitMQ Management"
Test-Port 80 "Nginx"

# Тест 4: Проверка Docker контейнеров
Write-Host ""
Write-Host "🐳 Проверка Docker контейнеров:" -ForegroundColor Cyan
Write-Host ""
try {
    $containers = docker ps --format "{{.Names}}\t{{.Status}}" 2>&1
    if ($LASTEXITCODE -eq 0 -and $containers) {
        $vssContainers = $containers | Where-Object { $_ -match "vss-|rabbitmq|postgres|redis" }
        if ($vssContainers) {
            Write-Host "✅ VSS контейнеры запущены ($($vssContainers.Count) контейнеров)" -ForegroundColor Green
            $vssContainers | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
            $script:passed++
        } else {
            Write-Host "⚠️  VSS контейнеры не найдены" -ForegroundColor Yellow
            $script:warnings++
        }
    } else {
        Write-Host "⚠️  Docker контейнеры не запущены" -ForegroundColor Yellow
        $script:warnings++
    }
} catch {
    Write-Host "⚠️  Ошибка проверки контейнеров: $($_.Exception.Message)" -ForegroundColor Yellow
    $script:warnings++
}

# Тест 5: Проверка файлов конфигурации
Write-Host ""
Write-Host "📋 Проверка файлов конфигурации:" -ForegroundColor Cyan
Write-Host ""
$configFiles = @(
    "docker-compose.vss-demiurge.yml",
    "config\rabbitmq\rabbitmq.conf",
    "config\redis\redis.conf"
)

foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Конфиг: $file" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "⚠️  Конфиг: $file - не найден" -ForegroundColor Yellow
        $script:warnings++
    }
}

# Итоги
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "📊 РЕЗУЛЬТАТЫ АУДИТА" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ Пройдено: $passed" -ForegroundColor Green
Write-Host "❌ Провалено: $failed" -ForegroundColor Red
Write-Host "⚠️  Предупреждений: $warnings" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Запуск инфраструктуры
if ($failed -eq 0) {
    Write-Host "🚀 Запуск VSS инфраструктуры..." -ForegroundColor Cyan
    Write-Host ""
    
    # Определяем команду docker-compose
    $composeCmd = "docker-compose"
    try {
        docker-compose --version | Out-Null
    } catch {
        $composeCmd = "docker compose"
    }
    
    # Проверяем наличие файла docker-compose
    $composeFile = "docker-compose.vss-demiurge.yml"
    if (-not (Test-Path $composeFile)) {
        $composeFile = "docker-compose.vss-demiurge-simple.yml"
    }
    
    if (Test-Path $composeFile) {
        Write-Host "   Используется: $composeFile" -ForegroundColor Blue
        
        # Проверяем статус контейнеров
        $running = docker ps --filter "name=vss-" --format "{{.Names}}" 2>&1
        if ($running) {
            Write-Host "   ✅ Найдено $($running.Count) запущенных контейнеров" -ForegroundColor Green
            Write-Host "   Инфраструктура уже запущена" -ForegroundColor Green
        } else {
            Write-Host "   Запуск контейнеров..." -ForegroundColor Blue
            & $composeCmd -f $composeFile up -d
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Инфраструктура запущена" -ForegroundColor Green
                Write-Host "   Ожидание готовности сервисов (10 секунд)..." -ForegroundColor Blue
                Start-Sleep -Seconds 10
            } else {
                Write-Host "   ❌ Ошибка запуска инфраструктуры" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ⚠️  Файлы docker-compose не найдены" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "✅ ЗАПУСК ЗАВЕРШЕН" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📡 Доступные сервисы:" -ForegroundColor Cyan
    Write-Host "   - VSS Workspace: http://localhost:3000" -ForegroundColor Green
    Write-Host "   - VSS OTTB: http://localhost:8083" -ForegroundColor Green
    Write-Host "   - VSS DCI: http://localhost:8082" -ForegroundColor Green
    Write-Host "   - VSS POINT: http://localhost:8081" -ForegroundColor Green
    Write-Host "   - Admin Backend: http://localhost:8181" -ForegroundColor Green
    Write-Host "   - RabbitMQ Management: http://localhost:15672" -ForegroundColor Green
    Write-Host "   - Guacamole: http://localhost:8080" -ForegroundColor Green
    Write-Host "   - Grafana: http://localhost:3001" -ForegroundColor Green
    Write-Host "   - Prometheus: http://localhost:9090" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "❌ Обнаружены критические проблемы. Запуск отменен." -ForegroundColor Red
    exit 1
}

