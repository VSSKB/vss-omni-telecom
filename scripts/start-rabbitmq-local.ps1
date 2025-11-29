# Скрипт для запуска RabbitMQ локально (для разработки)
# Используется когда сервисы запускаются локально, а не в Docker

Write-Host "Запуск RabbitMQ для локальной разработки..." -ForegroundColor Cyan

# Проверяем, запущен ли уже RabbitMQ
$existing = docker ps -a --filter "name=rabbitmq-local" --format "{{.Names}}"
if ($existing -eq "rabbitmq-local") {
    Write-Host "Контейнер rabbitmq-local уже существует. Проверяем статус..." -ForegroundColor Yellow
    $status = docker ps --filter "name=rabbitmq-local" --format "{{.Status}}"
    if ($status) {
        Write-Host "RabbitMQ уже запущен!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "Запускаем существующий контейнер..." -ForegroundColor Yellow
        docker start rabbitmq-local
        Start-Sleep -Seconds 5
        Write-Host "RabbitMQ запущен!" -ForegroundColor Green
        exit 0
    }
}

# Запускаем новый контейнер RabbitMQ
Write-Host "Создание и запуск нового контейнера RabbitMQ..." -ForegroundColor Cyan
docker run -d `
    --name rabbitmq-local `
    -p 5672:5672 `
    -p 15672:15672 `
    -e RABBITMQ_DEFAULT_USER=vss-admin `
    -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass `
    -e RABBITMQ_DEFAULT_VHOST=/vss `
    rabbitmq:3.12-management-alpine

if ($LASTEXITCODE -eq 0) {
    Write-Host "Ожидание инициализации RabbitMQ (10 секунд)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    Write-Host "RabbitMQ успешно запущен!" -ForegroundColor Green
    Write-Host "Management UI: http://localhost:15672" -ForegroundColor Cyan
    Write-Host "Username: vss-admin" -ForegroundColor Cyan
    Write-Host "Password: vss_rabbit_pass" -ForegroundColor Cyan
} else {
    Write-Host "Ошибка при запуске RabbitMQ!" -ForegroundColor Red
    exit 1
}

