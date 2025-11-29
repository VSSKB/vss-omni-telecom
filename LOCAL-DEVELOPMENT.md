# Локальная разработка VSS DEMIURGE

## Проблема: "RabbitMQ connection error: getaddrinfo ENOTFOUND rabbitmq"

Эта ошибка возникает, когда сервис запускается локально (вне Docker), но пытается подключиться к `rabbitmq` (имя хоста Docker).

## Решение

### Вариант 1: Использовать Docker Compose (рекомендуется)

Запустите все сервисы через Docker Compose:

```powershell
docker-compose -f docker-compose.vss-demiurge.yml up -d
```

### Вариант 2: Локальная разработка с локальными сервисами

Если вы хотите запускать сервисы локально:

1. **Установите и запустите RabbitMQ локально:**

```powershell
# Через Docker
docker run -d --name rabbitmq-local -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=vss-admin -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass rabbitmq:3.12-management-alpine

# Или установите RabbitMQ напрямую на Windows
```

2. **Установите и запустите PostgreSQL локально:**

```powershell
# Через Docker
docker run -d --name postgres-local -p 5432:5432 -e POSTGRES_DB=vss_db -e POSTGRES_USER=vss -e POSTGRES_PASSWORD=vss_postgres_pass postgres:15-alpine
```

3. **Создайте файл `.env` в `services/workspace/`:**

```env
RABBITMQ_URL=amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss
POSTGRES_URL=postgresql://vss:vss_postgres_pass@localhost:5432/vss_db
PORT=3000
NODE_ENV=development
```

4. **Запустите сервис:**

```powershell
cd services/workspace
npm install
npm start
```

## Автоматическое определение окружения

Сервис теперь автоматически определяет, запущен ли он в Docker или локально:

- **В Docker:** использует `rabbitmq` и `postgres` как имена хостов
- **Локально:** использует `localhost` для всех сервисов

## Проверка подключения

После запуска вы должны увидеть:

```
[WORKSPACE] Connected to RabbitMQ
```

Если RabbitMQ недоступен, сервис продолжит работу, но без функциональности, требующей RabbitMQ.

## Быстрый старт для локальной разработки

```powershell
# 1. Запустить RabbitMQ и PostgreSQL
docker run -d --name rabbitmq-local -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=vss-admin -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass rabbitmq:3.12-management-alpine
docker run -d --name postgres-local -p 5432:5432 -e POSTGRES_DB=vss_db -e POSTGRES_USER=vss -e POSTGRES_PASSWORD=vss_postgres_pass postgres:15-alpine

# 2. Подождать 10 секунд для инициализации
Start-Sleep -Seconds 10

# 3. Создать .env файл
@"
RABBITMQ_URL=amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss
POSTGRES_URL=postgresql://vss:vss_postgres_pass@localhost:5432/vss_db
PORT=3000
NODE_ENV=development
"@ | Out-File -FilePath services/workspace/.env -Encoding utf8

# 4. Запустить сервис
cd services/workspace
npm install
npm start
```

