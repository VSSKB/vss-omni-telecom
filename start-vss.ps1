# VSS DEMIURGE Startup Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VSS DEMIURGE - Запуск системы" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Переходим в директорию скрипта
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "`n[1/5] Остановка существующих контейнеров..." -ForegroundColor Yellow
docker-compose -f docker-compose.vss-demiurge.yml down 2>&1 | Out-Null

Write-Host "[2/5] Пересборка образов с исправленными зависимостями..." -ForegroundColor Yellow
docker-compose -f docker-compose.vss-demiurge.yml build --no-cache vss-ottb vss-dci vss-point vss-workspace 2>&1 | Out-Null

Write-Host "[3/5] Запуск всех сервисов..." -ForegroundColor Yellow
docker-compose -f docker-compose.vss-demiurge.yml up -d

Write-Host "[4/5] Ожидание готовности сервисов (30 секунд)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "[5/5] Проверка статуса..." -ForegroundColor Yellow
docker-compose -f docker-compose.vss-demiurge.yml ps

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "VSS DEMIURGE запущен!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Доступ к сервисам:" -ForegroundColor Cyan
Write-Host "  - Главная страница: http://localhost/" -ForegroundColor White
Write-Host "  - Dashboard: http://localhost/dashboard" -ForegroundColor White
Write-Host "  - Guacamole: http://localhost/guacamole/" -ForegroundColor White
Write-Host "  - RabbitMQ: http://localhost:15672" -ForegroundColor White
Write-Host "  - Grafana: http://localhost:3001" -ForegroundColor White
Write-Host "  - Prometheus: http://localhost:9090" -ForegroundColor White
Write-Host ""
Write-Host "API Endpoints:" -ForegroundColor Cyan
Write-Host "  - Workspace: http://localhost/api/workspace/" -ForegroundColor White
Write-Host "  - OTTB: http://localhost/api/ottb/" -ForegroundColor White
Write-Host "  - DCI: http://localhost/api/dci/" -ForegroundColor White
Write-Host "  - POINT: http://localhost/api/point/" -ForegroundColor White
Write-Host ""
Write-Host "Для просмотра логов используйте:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.vss-demiurge.yml logs -f" -ForegroundColor Gray
Write-Host ""

