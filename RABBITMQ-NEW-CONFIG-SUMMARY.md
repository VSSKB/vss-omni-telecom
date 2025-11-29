# Настройка RabbitMQ с новым vhost и функциями

## Дата: 2025-11-29

## Выполненные изменения

### 1. Обновление vhost
- **Было**: Использовались два vhost (`/vss` и `vss`)
- **Стало**: Единый vhost `vss` (без слеша) для всех компонентов
- **Причина**: Сервисы подключаются к `amqp://...@rabbitmq:5672/vss`, поэтому все компоненты должны быть в vhost `vss`

### 2. Обновление definitions.json
- Все exchanges перенесены в vhost `vss`:
  - `vss.events` (topic)
  - `vss.commands` (topic)
  - `vss.rpc` (direct)
- Все 10 queues перенесены в vhost `vss`:
  - `vss.call.events`
  - `vss.slot.events`
  - `vss.slot.commands`
  - `vss.autodial.leads`
  - `vss.gacs.commands`
  - `vss.pipeline.events`
  - `vss.system.alerts`
  - `vss.guacamole.sessions`
  - `vss.archonts.deployments`
  - `vss.telemetry.metrics`
- Все bindings обновлены для использования vhost `vss`
- Добавлены permissions для пользователя `vss-admin` на vhost `vss`

### 3. Добавление Policies
Добавлены две политики для автоматического управления очередями:

#### Policy: `vss-message-ttl`
- **Pattern**: `^vss\.`
- **Apply-to**: `queues`
- **Definition**: `{"message-ttl": 86400000}` (24 часа)
- **Priority**: 0

#### Policy: `vss-ha-policy`
- **Pattern**: `^vss\.`
- **Apply-to**: `queues`
- **Definition**: `{"ha-mode": "all"}` (высокая доступность)
- **Priority**: 1

### 4. Обновление docker-compose.vss-demiurge-simple.yml
- Изменен `RABBITMQ_DEFAULT_VHOST` с `/vss` на `vss`

### 5. Обновление rabbitmq.conf
Добавлены настройки производительности:
- `heartbeat = 60` - интервал heartbeat
- `frame_max = 131072` - максимальный размер фрейма
- `channel_max = 2047` - максимальное количество каналов
- `queue_master_locator = min-masters` - выбор мастера очереди

## Текущая конфигурация

### Exchanges (3)
1. `vss.events` - topic exchange для событий
2. `vss.commands` - topic exchange для команд
3. `vss.rpc` - direct exchange для RPC вызовов

### Queues (10)
1. `vss.call.events` - события звонков (TTL: 24ч, Max: 10000)
2. `vss.slot.events` - события слотов (TTL: 24ч, Max: 10000)
3. `vss.slot.commands` - команды слотов (DLX: vss.events)
4. `vss.autodial.leads` - лиды автодозвона (TTL: 1ч, Max: 50000)
5. `vss.gacs.commands` - команды GACS (DLX: vss.events)
6. `vss.pipeline.events` - события пайплайна (TTL: 24ч, Max: 10000)
7. `vss.system.alerts` - системные алерты (TTL: 7 дней, Max: 5000)
8. `vss.guacamole.sessions` - сессии Guacamole (TTL: 24ч)
9. `vss.archonts.deployments` - деплойменты Archonts (TTL: 24ч)
10. `vss.telemetry.metrics` - метрики телеметрии (TTL: 1ч, Max: 100000)

### Bindings (10)
- `vss.events` → `vss.call.events` (routing_key: `call.*`)
- `vss.events` → `vss.slot.events` (routing_key: `slot.*`)
- `vss.events` → `vss.pipeline.events` (routing_key: `pipeline.*`)
- `vss.events` → `vss.system.alerts` (routing_key: `system.alert`)
- `vss.events` → `vss.guacamole.sessions` (routing_key: `guacamole.*`)
- `vss.events` → `vss.archonts.deployments` (routing_key: `archonts.*`)
- `vss.events` → `vss.telemetry.metrics` (routing_key: `telemetry.*`)
- `vss.commands` → `vss.slot.commands` (routing_key: `slot.*`)
- `vss.commands` → `vss.autodial.leads` (routing_key: `autodial.lead`)
- `vss.commands` → `vss.gacs.commands` (routing_key: `gacs.execute`)

### Permissions
- Пользователь `vss-admin` имеет полные права (configure, write, read) на vhost `vss`

## Проверка работоспособности

### Статус сервисов
- ✅ RabbitMQ контейнер: healthy
- ✅ Vhost `vss`: создан и работает
- ✅ Все exchanges: созданы
- ✅ Все queues: созданы (10 из 10)
- ✅ Все bindings: настроены (10 из 10)
- ✅ Policies: применены (2 из 2)
- ✅ Permissions: настроены

### Подключение сервисов
- ✅ `vss-workspace`: подключен к RabbitMQ
- ✅ `vss-dci`: подключен к RabbitMQ
- ✅ `vss-ottb`: подключен к RabbitMQ
- ✅ `vss-point`: подключен к RabbitMQ

## Команды для проверки

```powershell
# Проверка vhost
docker exec vss-rabbitmq rabbitmqctl list_vhosts

# Проверка exchanges
docker exec vss-rabbitmq rabbitmqctl list_exchanges -p vss name type

# Проверка queues
docker exec vss-rabbitmq rabbitmqctl list_queues -p vss name messages

# Проверка bindings
docker exec vss-rabbitmq rabbitmqctl list_bindings -p vss

# Проверка policies
docker exec vss-rabbitmq rabbitmqctl list_policies -p vss

# Проверка permissions
docker exec vss-rabbitmq rabbitmqctl list_permissions -p vss

# Запуск скрипта проверки
powershell -ExecutionPolicy Bypass -File verify-rabbitmq-new-config.ps1
```

## Файлы изменены

1. `config/rabbitmq/definitions.json` - полная переработка конфигурации
2. `docker-compose.vss-demiurge-simple.yml` - обновлен RABBITMQ_DEFAULT_VHOST
3. `config/rabbitmq/rabbitmq.conf` - добавлены настройки производительности

## Новые файлы

1. `verify-rabbitmq-new-config.ps1` - скрипт для проверки конфигурации
2. `RABBITMQ-NEW-CONFIG-SUMMARY.md` - данный отчет

## Итог

✅ Все компоненты RabbitMQ успешно настроены на использование vhost `vss` (без слеша)
✅ Добавлены policies для автоматического управления TTL и высокой доступностью
✅ Все сервисы успешно подключаются к RabbitMQ
✅ Конфигурация соответствует требованиям проекта

