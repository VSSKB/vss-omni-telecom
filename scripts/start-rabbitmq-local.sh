#!/bin/bash
# Скрипт для запуска RabbitMQ локально (для разработки)
# Используется когда сервисы запускаются локально, а не в Docker

echo "Запуск RabbitMQ для локальной разработки..."

# Проверяем, запущен ли уже RabbitMQ
if docker ps -a --filter "name=rabbitmq-local" --format "{{.Names}}" | grep -q "rabbitmq-local"; then
    echo "Контейнер rabbitmq-local уже существует. Проверяем статус..."
    if docker ps --filter "name=rabbitmq-local" --format "{{.Status}}" | grep -q "Up"; then
        echo "RabbitMQ уже запущен!"
        exit 0
    else
        echo "Запускаем существующий контейнер..."
        docker start rabbitmq-local
        sleep 5
        echo "RabbitMQ запущен!"
        exit 0
    fi
fi

# Запускаем новый контейнер RabbitMQ
echo "Создание и запуск нового контейнера RabbitMQ..."
docker run -d \
    --name rabbitmq-local \
    -p 5672:5672 \
    -p 15672:15672 \
    -e RABBITMQ_DEFAULT_USER=vss-admin \
    -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass \
    -e RABBITMQ_DEFAULT_VHOST=/vss \
    rabbitmq:3.12-management-alpine

if [ $? -eq 0 ]; then
    echo "Ожидание инициализации RabbitMQ (10 секунд)..."
    sleep 10
    
    echo "RabbitMQ успешно запущен!"
    echo "Management UI: http://localhost:15672"
    echo "Username: vss-admin"
    echo "Password: vss_rabbit_pass"
else
    echo "Ошибка при запуске RabbitMQ!"
    exit 1
fi

