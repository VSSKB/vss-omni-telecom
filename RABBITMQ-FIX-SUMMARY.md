# Исправление проблемы RabbitMQ Management UI

## Проблема
RabbitMQ Management UI не отвечал на порту 15672 с ошибкой "Connection refused" или "Connection closed".

## Причина
1. В файле `definitions.json` были пользователи с пустыми `password_hash`, что вызывало ошибку `invalid_definitions_file` при загрузке
2. Management плагин мог не слушать на всех интерфейсах

## Решение

### 1. Исправлен файл `config/rabbitmq/definitions.json`
- Удалены секции `users` и `permissions` с пустыми паролями
- Оставлены только `vhosts`, `exchanges`, `queues` и `bindings`
- Пользователи создаются через переменные окружения Docker

### 2. Отключена загрузка definitions.json
В файле `config/rabbitmq/rabbitmq.conf`:
```
# load_definitions = /etc/rabbitmq/definitions.json
```

### 3. Добавлена явная настройка интерфейса
В файле `config/rabbitmq/rabbitmq.conf`:
```
management.tcp.ip = 0.0.0.0
```

## Текущий статус

✅ RabbitMQ работает (ping succeeded)
✅ Management плагин запущен и слушает на 0.0.0.0:15672
✅ Порт 15672 проброшен из контейнера на хост

## Доступ

- **URL:** http://localhost:15672
- **Username:** vss-admin
- **Password:** vss_rabbit_pass (или из переменной RABBITMQ_PASSWORD)

## Через nginx-proxy-manager

- **URL:** http://rabbitmq.localhost:8084 (после добавления записи в hosts файл)
- Использует `host.docker.internal:15672` как backend

## Проверка

```powershell
# Проверить статус
docker exec vss-rabbitmq rabbitmq-diagnostics status

# Проверить Management плагин
docker exec vss-rabbitmq rabbitmq-plugins list | findstr management

# Проверить API
curl -u vss-admin:vss_rabbit_pass http://localhost:15672/api/overview
```

