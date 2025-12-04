# Скрипт автоматического исправления инфраструктуры VSS OMNI TELECOM
# Решает проблемы с PostgreSQL, RabbitMQ, Redis и CORS

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "║   VSS OMNI TELECOM - АВТОИСПРАВЛЕНИЕ                    ║" -ForegroundColor Cyan
Write-Host "║   Исправление инфраструктуры и подключений              ║" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$fixedIssues = 0

# ПРОБЛЕМА 1: PostgreSQL не запущен
Write-Host "[1/5] Проверка и запуск PostgreSQL..." -ForegroundColor Yellow

$postgresRunning = docker ps --filter "name=vss-postgres" --format "{{.Names}}" 2>$null
if ($postgresRunning) {
    Write-Host "   ✅ PostgreSQL уже запущен" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  PostgreSQL не запущен, запускаю..." -ForegroundColor Yellow
    docker-compose -f docker-compose.vss-demiurge-simple.yml up -d postgres
    
    Write-Host "   ⏳ Ожидание инициализации PostgreSQL (30 сек)..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    
    # Проверка
    $testResult = docker exec vss-postgres psql -U vss -d vss_db -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PostgreSQL запущен и работает!" -ForegroundColor Green
        $fixedIssues++
    } else {
        Write-Host "   ❌ Ошибка запуска PostgreSQL" -ForegroundColor Red
    }
}

# ПРОБЛЕМА 2: RabbitMQ не запущен
Write-Host "`n[2/5] Проверка и запуск RabbitMQ..." -ForegroundColor Yellow

$rabbitmqRunning = docker ps --filter "name=vss-rabbitmq" --format "{{.Names}}" 2>$null
if ($rabbitmqRunning) {
    Write-Host "   ✅ RabbitMQ уже запущен" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  RabbitMQ не запущен, запускаю..." -ForegroundColor Yellow
    docker-compose -f docker-compose.vss-demiurge-simple.yml up -d rabbitmq
    
    Write-Host "   ⏳ Ожидание инициализации RabbitMQ (30 сек)..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    
    # Проверка
    $testResult = docker exec vss-rabbitmq rabbitmq-diagnostics ping 2>&1
    if ($testResult -match "Ping succeeded") {
        Write-Host "   ✅ RabbitMQ запущен и работает!" -ForegroundColor Green
        $fixedIssues++
    } else {
        Write-Host "   ❌ Ошибка запуска RabbitMQ" -ForegroundColor Red
    }
}

# ПРОБЛЕМА 3: Redis не запущен
Write-Host "`n[3/5] Проверка и запуск Redis..." -ForegroundColor Yellow

$redisRunning = docker ps --filter "name=vss-redis" --format "{{.Names}}" 2>$null
if ($redisRunning) {
    Write-Host "   ✅ Redis уже запущен" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Redis не запущен, запускаю..." -ForegroundColor Yellow
    docker-compose -f docker-compose.vss-demiurge-simple.yml up -d redis
    
    Write-Host "   ⏳ Ожидание инициализации Redis (10 сек)..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
    
    # Проверка
    $testResult = docker exec vss-redis redis-cli ping 2>&1
    if ($testResult -match "PONG") {
        Write-Host "   ✅ Redis запущен и работает!" -ForegroundColor Green
        $fixedIssues++
    } else {
        Write-Host "   ❌ Ошибка запуска Redis" -ForegroundColor Red
    }
}

# ПРОБЛЕМА 4: CORS в OTTB
Write-Host "`n[4/5] Исправление CORS в OTTB..." -ForegroundColor Yellow

$ottbFile = "services/ottb/index.js"
if (Test-Path $ottbFile) {
    $content = Get-Content $ottbFile -Raw
    
    # Проверяем есть ли проблема с CORS
    if ($content -match "app\.use\(cors\(\)\)") {
        Write-Host "   ✅ CORS уже настроен правильно" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Требуется обновление CORS конфигурации" -ForegroundColor Yellow
        Write-Host "   💡 Откройте services/ottb/index.js и убедитесь что:" -ForegroundColor White
        Write-Host "      app.use(cors()); // Без параметров для development" -ForegroundColor Gray
    }
} else {
    Write-Host "   ⚠️  Файл не найден: $ottbFile" -ForegroundColor Yellow
}

# ПРОБЛЕМА 5: Проверка подключений
Write-Host "`n[5/5] Проверка подключений к инфраструктуре..." -ForegroundColor Yellow

$connections = @{
    "PostgreSQL" = @{
        Test = { docker exec vss-postgres psql -U vss -d vss_db -c "SELECT 1" 2>&1 }
        ExpectedOutput = "1 row"
    }
    "RabbitMQ" = @{
        Test = { docker exec vss-rabbitmq rabbitmq-diagnostics ping 2>&1 }
        ExpectedOutput = "Ping succeeded"
    }
    "Redis" = @{
        Test = { docker exec vss-redis redis-cli ping 2>&1 }
        ExpectedOutput = "PONG"
    }
}

$workingConnections = 0
foreach ($name in $connections.Keys) {
    try {
        $result = & $connections[$name].Test
        $expected = $connections[$name].ExpectedOutput
        
        if ($result -match $expected) {
            Write-Host "   ✅ $name подключение работает" -ForegroundColor Green
            $workingConnections++
        } else {
            Write-Host "   ❌ $name не отвечает" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ❌ $name недоступен" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    ИТОГИ                                 ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor White
Write-Host "║  Исправлено проблем:      $fixedIssues/3                          ║" -ForegroundColor White
Write-Host "║  Работающих подключений:  $workingConnections/3                          ║" -ForegroundColor White
Write-Host "║                                                          ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($workingConnections -eq 3) {
    Write-Host "✅ Инфраструктура полностью работает!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Следующие шаги:" -ForegroundColor Yellow
    Write-Host "   1. Перезапустите микросервисы: npm run start:services" -ForegroundColor White
    Write-Host "   2. Или через Docker: docker-compose -f docker-compose.vss-demiurge-simple.yml up -d" -ForegroundColor White
    Write-Host "   3. Проверьте healthchecks: curl http://localhost:8083/health" -ForegroundColor White
} elseif ($workingConnections -ge 2) {
    Write-Host "⚠️  Инфраструктура частично работает" -ForegroundColor Yellow
    Write-Host "💡 Проверьте логи: docker-compose -f docker-compose.vss-demiurge-simple.yml logs" -ForegroundColor White
} else {
    Write-Host "❌ Критические проблемы с инфраструктурой" -ForegroundColor Red
    Write-Host "💡 Проверьте Docker Desktop и запустите заново" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host "📊 Статус сервисов:" -ForegroundColor Cyan
docker-compose -f docker-compose.vss-demiurge-simple.yml ps
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

