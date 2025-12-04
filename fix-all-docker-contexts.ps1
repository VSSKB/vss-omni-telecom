# Скрипт для исправления всех проблем с Docker build context
# Решает проблему "Cannot find module '../../utils/port-finder'"

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "║    ИСПРАВЛЕНИЕ DOCKER BUILD CONTEXT                     ║" -ForegroundColor Cyan
Write-Host "║    Решение проблемы с utils/port-finder                 ║" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$totalFixed = 0
$totalRebuilt = 0

# 1. Исправление docker-compose.vss-demiurge-simple.yml
if (Test-Path "docker-compose.vss-demiurge-simple.yml") {
    Write-Host "1. Исправление docker-compose.vss-demiurge-simple.yml..." -ForegroundColor Yellow
    
    $content = Get-Content "docker-compose.vss-demiurge-simple.yml" -Raw
    
    # Исправляем build context для всех сервисов
    $content = $content -replace 'context: \./services/ottb', 'context: .'
    $content = $content -replace 'context: \./services/dci', 'context: .'
    $content = $content -replace 'context: \./services/point', 'context: .'
    $content = $content -replace 'context: \./services/workspace', 'context: .'
    
    # Исправляем dockerfile paths
    $content = $content -replace 'dockerfile: Dockerfile(\s+)container_name: vss-ottb', 'dockerfile: services/ottb/Dockerfile$1container_name: vss-ottb'
    $content = $content -replace 'dockerfile: Dockerfile(\s+)container_name: vss-dci', 'dockerfile: services/dci/Dockerfile$1container_name: vss-dci'
    $content = $content -replace 'dockerfile: Dockerfile(\s+)container_name: vss-point', 'dockerfile: services/point/Dockerfile$1container_name: vss-point'
    $content = $content -replace 'dockerfile: Dockerfile(\s+)container_name: vss-workspace', 'dockerfile: services/workspace/Dockerfile$1container_name: vss-workspace'
    
    Set-Content "docker-compose.vss-demiurge-simple.yml" $content
    Write-Host "   ✅ Исправлено!" -ForegroundColor Green
    $totalFixed++
}

# 2. Остановка всех контейнеров VSS
Write-Host "`n2. Остановка всех VSS контейнеров..." -ForegroundColor Yellow
docker-compose -f docker-compose.vss-demiurge-simple.yml down 2>$null
Write-Host "   ✅ Остановлено" -ForegroundColor Green

# 3. Удаление старых образов
Write-Host "`n3. Удаление старых образов..." -ForegroundColor Yellow
@("vss-point", "vss-ottb", "vss-dci", "vss-workspace") | ForEach-Object {
    $imageName = "vss-omni-telecom-$_"
    docker rmi "${imageName}:latest" -f 2>$null
    Write-Host "   ✅ Удален $imageName" -ForegroundColor Green
}

# 4. Пересборка всех сервисов
Write-Host "`n4. Пересборка сервисов (это займет несколько минут)..." -ForegroundColor Yellow

if (Test-Path "docker-compose.vss-demiurge-simple.yml") {
    Write-Host "   Сборка vss-point..." -ForegroundColor Gray
    docker-compose -f docker-compose.vss-demiurge-simple.yml build --no-cache vss-point
    
    Write-Host "   Сборка vss-ottb..." -ForegroundColor Gray
    docker-compose -f docker-compose.vss-demiurge-simple.yml build --no-cache vss-ottb
    
    Write-Host "   Сборка vss-dci..." -ForegroundColor Gray
    docker-compose -f docker-compose.vss-demiurge-simple.yml build --no-cache vss-dci
    
    Write-Host "   Сборка vss-workspace..." -ForegroundColor Gray
    docker-compose -f docker-compose.vss-demiurge-simple.yml build --no-cache vss-workspace
    
    Write-Host "   ✅ Все сервисы пересобраны!" -ForegroundColor Green
    $totalRebuilt += 4
}

# 5. Запуск обновленных контейнеров
Write-Host "`n5. Запуск обновленных контейнеров..." -ForegroundColor Yellow
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d

Write-Host "`n⏳ Ожидание инициализации (30 секунд)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 6. Проверка статуса
Write-Host "`n6. Проверка статуса контейнеров:`n" -ForegroundColor Yellow
docker-compose -f docker-compose.vss-demiurge-simple.yml ps

# 7. Проверка логов на ошибки
Write-Host "`n7. Проверка логов на ошибки:" -ForegroundColor Yellow
Write-Host "`nПроверка vss-point:" -ForegroundColor White
$pointLogs = docker logs vss-point 2>&1 | Select-String "error|Error|ERROR|Cannot find" | Select-Object -Last 3
if ($pointLogs) {
    Write-Host "   ⚠️  Найдены ошибки:" -ForegroundColor Yellow
    $pointLogs | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
} else {
    Write-Host "   ✅ Ошибок нет" -ForegroundColor Green
}

Write-Host "`nПроверка vss-workspace:" -ForegroundColor White
$workspaceLogs = docker logs vss-workspace 2>&1 | Select-String "error|Error|ERROR|Cannot find" | Select-Object -Last 3
if ($workspaceLogs) {
    Write-Host "   ⚠️  Найдены ошибки:" -ForegroundColor Yellow
    $workspaceLogs | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
} else {
    Write-Host "   ✅ Ошибок нет" -ForegroundColor Green
}

# 8. Проверка healthchecks
Write-Host "`n8. Проверка healthchecks:" -ForegroundColor Yellow

$services = @(
    @{Name="WORKSPACE"; Port=3000},
    @{Name="POINT"; Port=8081},
    @{Name="DCI"; Port=8082},
    @{Name="OTTB"; Port=8083}
)

foreach ($svc in $services) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($svc.Port)/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ $($svc.Name) (port $($svc.Port)): Работает" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ❌ $($svc.Name) (port $($svc.Port)): Недоступен" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    ИТОГИ                                 ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Исправлено файлов:      $totalFixed                             ║" -ForegroundColor White
Write-Host "║  Пересобрано сервисов:   $totalRebuilt                             ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($totalFixed -gt 0 -and $totalRebuilt -gt 0) {
    Write-Host "✅ Исправление завершено успешно!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Проверьте результаты выше" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Для просмотра логов используйте:" -ForegroundColor Yellow
Write-Host "   docker-compose -f docker-compose.vss-demiurge-simple.yml logs -f" -ForegroundColor White
Write-Host ""

