# Быстрое решение проблемы RabbitMQ

## Проблема

При запуске скрипта `start` (2-24) вы видите:
```
[WORKSPACE] RabbitMQ connection error: getaddrinfo ENOTFOUND rabbitmq
[WORKSPACE] RabbitMQ недоступен. Сервис будет работать без RabbitMQ.
```

## Причина

Сервис `vss-workspace` запускается локально (вне Docker), но RabbitMQ не запущен на `localhost:5672`.

## ✅ Решение (выполнено)

RabbitMQ уже запущен! Контейнер `rabbitmq-local` работает на портах:
- **5672** - AMQP протокол
- **15672** - Management UI

## Проверка

```bash
# Проверить статус
docker ps | grep rabbitmq-local

# Проверить подключение
docker exec rabbitmq-local rabbitmq-diagnostics ping

# Проверить пользователей
docker exec rabbitmq-local rabbitmqctl list_users
```

## Перезапуск сервиса

Теперь перезапустите сервис `vss-workspace`:

```bash
# Остановите текущий процесс (Ctrl+C)
# Затем запустите снова
cd services/workspace
npm start
```

После перезапуска вы должны увидеть:
```
[WORKSPACE] Подключение к RabbitMQ: amqp://vss-admin:****@localhost:5672/vss
[WORKSPACE] Connected to RabbitMQ
```

## Если RabbitMQ не запущен

Запустите его вручную:

```powershell
# Windows PowerShell
.\scripts\start-rabbitmq-local.ps1

# Или вручную
docker run -d --name rabbitmq-local -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=vss-admin -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass -e RABBITMQ_DEFAULT_VHOST=/vss rabbitmq:3.12-management-alpine
```

## Доступ к RabbitMQ Management

- **URL:** http://localhost:15672
- **Username:** vss-admin
- **Password:** vss_rabbit_pass

## Дополнительно

Если нужны PostgreSQL и Redis для локальной разработки:

```powershell
# Запустить всю инфраструктуру
.\scripts\start-local-infra.ps1
```

Или запустить через docker-compose:

```bash
docker-compose -f docker-compose.vss-demiurge.yml up -d rabbitmq postgres redis
```

---

**Статус:** ✅ RabbitMQ запущен и готов к использованию

