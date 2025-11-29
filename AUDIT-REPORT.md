# VSS Infrastructure Audit Report

## Выполненные проверки

### 1. ✅ Проверка зависимостей
- Docker
- Docker Compose  
- Node.js

### 2. ✅ Проверка портов (10 тестов)
- Порт 3000 - VSS Workspace
- Порт 8083 - VSS OTTB
- Порт 8082 - VSS DCI
- Порт 8081 - VSS POINT
- Порт 8181 - Admin Backend
- Порт 5432 - PostgreSQL
- Порт 6379 - Redis
- Порт 5672 - RabbitMQ
- Порт 15672 - RabbitMQ Management
- Порт 80 - Nginx

### 3. ✅ Проверка Docker контейнеров
- Статус VSS контейнеров
- Статус инфраструктурных контейнеров

### 4. ✅ Проверка файлов конфигурации
- docker-compose.vss-demiurge.yml
- Конфигурационные файлы сервисов

### 5. ✅ Проверка подключений
- PostgreSQL
- Redis
- RabbitMQ

### 6. ✅ Проверка API эндпоинтов
- Health checks всех сервисов

## Запуск проекта

Для запуска полного аудита и тестов выполните:

```bash
npm run audit
```

Или напрямую:

```bash
node scripts/run-audit-and-start.js
```

Скрипт автоматически:
1. Проведет полный аудит инфраструктуры
2. Выполнит 10+ тестов
3. Запустит Docker инфраструктуру
4. Покажет статус всех сервисов

