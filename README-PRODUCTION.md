# VSS DEMIURGE - Production Deployment Guide

## Быстрый старт

### 1. Подготовка окружения

```bash
# Клонировать репозиторий
git clone https://github.com/vss/vss-omni-telecom.git
cd vss-omni-telecom

# Создать .env.production из примера
cp .env.production.example .env.production

# Отредактировать секреты
nano .env.production
```

### 2. Развертывание через Docker Compose

```bash
# Запустить все сервисы
docker-compose -f docker-compose.production.yml up -d

# Проверить статус
docker-compose -f docker-compose.production.yml ps

# Просмотр логов
docker-compose -f docker-compose.production.yml logs -f
```

### 3. Развертывание через Kubernetes

```bash
# Создать namespace
kubectl create namespace vss-production

# Создать secrets
kubectl create secret generic vss-secrets \
  --from-literal=postgres-url="postgresql://vss:password@postgres:5432/vss_db" \
  --from-literal=rabbitmq-url="amqp://vss:password@rabbitmq:5672/vss" \
  -n vss-production

# Применить манифесты
kubectl apply -f k8s/ -n vss-production

# Проверить статус
kubectl get pods -n vss-production
```

### 4. Автоматический деплой

```bash
# Запустить скрипт деплоя
./scripts/deploy.sh production
```

## Мониторинг

### Health Checks

```bash
# Проверка всех сервисов
curl http://localhost/health

# Проверка конкретного сервиса
curl http://localhost:3000/health
curl http://localhost:8083/health
```

### Метрики Prometheus

```bash
# Метрики сервисов
curl http://localhost:3000/metrics
curl http://localhost:8083/metrics
```

### Мониторинг скрипт

```bash
# Запустить мониторинг
python3 scripts/monitor.py
```

## Миграции базы данных

```bash
# Выполнить миграции
./scripts/migrate.sh

# Проверить версию схемы
docker exec vss_postgres psql -U vss -d vss_db -c "SELECT * FROM schema_version ORDER BY created_at DESC LIMIT 1;"
```

## Troubleshooting

### Проблемы с подключением

```bash
# Проверить PostgreSQL
docker exec vss_postgres psql -U vss -d vss_db -c "SELECT 1"

# Проверить RabbitMQ
docker exec vss_rabbitmq rabbitmq-diagnostics ping

# Проверить Redis
docker exec vss_redis redis-cli ping
```

### Просмотр логов

```bash
# Все сервисы
docker-compose -f docker-compose.production.yml logs -f

# Конкретный сервис
docker-compose -f docker-compose.production.yml logs -f api
```

### Перезапуск сервисов

```bash
# Перезапустить все
docker-compose -f docker-compose.production.yml restart

# Перезапустить конкретный сервис
docker-compose -f docker-compose.production.yml restart api
```

## Безопасность

### Обновление секретов

```bash
# Обновить .env.production
nano .env.production

# Перезапустить сервисы
docker-compose -f docker-compose.production.yml up -d
```

### SSL сертификаты

```bash
# Разместить сертификаты в
./certs/vss.example.com.crt
./certs/vss.example.com.key
```

## Масштабирование

### Горизонтальное масштабирование

```bash
# Увеличить количество реплик
docker-compose -f docker-compose.production.yml up -d --scale api=3
```

### Kubernetes масштабирование

```bash
# Масштабировать deployment
kubectl scale deployment vss-core --replicas=5 -n vss-production
```

## Резервное копирование

```bash
# Создать бэкап БД
docker exec vss_postgres pg_dump -U vss vss_db > backup_$(date +%Y%m%d).sql

# Восстановить из бэкапа
docker exec -i vss_postgres psql -U vss vss_db < backup_20240115.sql
```

## Обновление

```bash
# Обновить образы
docker-compose -f docker-compose.production.yml pull

# Перезапустить с новыми образами
docker-compose -f docker-compose.production.yml up -d
```

