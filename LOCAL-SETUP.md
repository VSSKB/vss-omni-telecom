# Локальная разработка VSS OTTB

## Проблема: RabbitMQ connection error

Если вы видите ошибку:
```
[WORKSPACE] RabbitMQ connection error: getaddrinfo ENOTFOUND rabbitmq
[WORKSPACE] RabbitMQ недоступен. Сервис будет работать без RabbitMQ.
```

Это означает, что сервис запускается локально (вне Docker), но RabbitMQ не запущен.

## Решение

### Вариант 1: Запустить RabbitMQ локально (быстро)

**Windows (PowerShell):**
```powershell
.\scripts\start-rabbitmq-local.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/start-rabbitmq-local.sh
./scripts/start-rabbitmq-local.sh
```

**Или вручную:**
```bash
docker run -d --name rabbitmq-local -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=vss-admin -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass -e RABBITMQ_DEFAULT_VHOST=/vss rabbitmq:3.12-management-alpine
```

### Вариант 2: Запустить все через Docker Compose (рекомендуется)

```bash
docker-compose -f docker-compose.vss-demiurge.yml up -d
```

Это запустит все сервисы, включая RabbitMQ, PostgreSQL, Redis и другие.

### Вариант 3: Запустить только инфраструктуру

Если вы хотите запускать сервисы локально, но использовать Docker для инфраструктуры:

```bash
# Запустить только инфраструктурные сервисы
docker-compose -f docker-compose.vss-demiurge.yml up -d rabbitmq postgres redis

# Затем запустить сервисы локально
cd services/workspace && npm start
cd services/ottb && npm start
cd services/dci && npm start
```

## Проверка подключения

После запуска RabbitMQ проверьте:

```bash
# Проверить статус контейнера
docker ps | grep rabbitmq-local

# Проверить логи
docker logs rabbitmq-local

# Проверить подключение (должен вернуть "pong")
docker exec rabbitmq-local rabbitmq-diagnostics ping
```

## Доступ к RabbitMQ Management

После запуска RabbitMQ Management UI доступен по адресу:
- **URL:** http://localhost:15672
- **Username:** vss-admin
- **Password:** vss_rabbit_pass

## Проблема: Порт занят

Если вы видите:
```
⚠️  [WORKSPACE] Порт 3000 занят. Используется порт 3002
```

Это нормально - сервис автоматически находит свободный порт. Просто используйте порт 3002 вместо 3000.

**Обновление frontend:**
Если frontend подключается к сервису, обновите URL в `vss-dashboard.html`:
```javascript
workspace: 'http://localhost:3002'  // вместо 3000
```

## Полная локальная настройка

Для полной локальной разработки:

1. **Запустить инфраструктуру:**
   ```bash
   docker-compose -f docker-compose.vss-demiurge.yml up -d rabbitmq postgres redis
   ```

2. **Применить миграции:**
   ```bash
   docker exec -i vss-postgres psql -U vss -d vss_db < database/migrations/002_f_flow_system.sql
   ```

3. **Создать .env файлы:**
   
   `services/workspace/.env`:
   ```env
   RABBITMQ_URL=amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss
   POSTGRES_URL=postgresql://vss:vss_postgres_pass@localhost:5432/vss_db
   PORT=3000
   NODE_ENV=development
   ```

   `services/ottb/.env`:
   ```env
   RABBITMQ_URL=amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss
   POSTGRES_URL=postgresql://vss:vss_postgres_pass@localhost:5432/vss_db
   PORT=8083
   NODE_ENV=development
   ```

   `services/dci/.env`:
   ```env
   RABBITMQ_URL=amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss
   POSTGRES_URL=postgresql://vss:vss_postgres_pass@localhost:5432/vss_db
   PORT=8082
   NODE_ENV=development
   ```

4. **Установить зависимости:**
   ```bash
   cd services/workspace && npm install
   cd services/ottb && npm install
   cd services/dci && npm install
   ```

5. **Запустить сервисы:**
   ```bash
   # Терминал 1
   cd services/workspace && npm start
   
   # Терминал 2
   cd services/ottb && npm start
   
   # Терминал 3
   cd services/dci && npm start
   ```

## Остановка RabbitMQ

```bash
docker stop rabbitmq-local
docker rm rabbitmq-local  # если нужно удалить контейнер
```

---

**Версия:** 1.0  
**Дата:** 2025-01-XX

