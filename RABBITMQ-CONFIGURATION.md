# Конфигурация RabbitMQ для VSS проекта

## Обзор

RabbitMQ настроен согласно архитектуре проекта VSS (VSS Omni Telecom). Конфигурация включает все необходимые exchanges, queues и bindings для работы всех сервисов.

## Архитектура

### Exchanges

1. **vss.events** (topic)
   - Используется для публикации событий системы
   - Тип: topic (поддержка pattern-based routing)

2. **vss.commands** (topic)
   - Используется для отправки команд сервисам
   - Тип: topic (поддержка pattern-based routing)

3. **vss.rpc** (direct)
   - Резервный exchange для RPC вызовов
   - Тип: direct (точное совпадение routing key)

### Queues

#### События (Events)

1. **vss.call.events**
   - Назначение: События звонков (start, end, update)
   - Routing key: `call.*`
   - TTL: 24 часа (86400000 мс)
   - Max length: 10000 сообщений

2. **vss.slot.events**
   - Назначение: События слотов (update, status changes)
   - Routing key: `slot.*`
   - TTL: 24 часа
   - Max length: 10000 сообщений

3. **vss.pipeline.events**
   - Назначение: События пайплайна (start, stop, update)
   - Routing key: `pipeline.*`
   - TTL: 24 часа
   - Max length: 10000 сообщений

4. **vss.system.alerts**
   - Назначение: Системные алерты
   - Routing key: `system.alert`
   - TTL: 7 дней (604800000 мс)
   - Max length: 5000 сообщений

5. **vss.guacamole.sessions**
   - Назначение: События сессий Guacamole
   - Routing key: `guacamole.*`
   - TTL: 24 часа

6. **vss.archonts.deployments**
   - Назначение: События деплоймента Archonts
   - Routing key: `archonts.*`
   - TTL: 24 часа

7. **vss.telemetry.metrics**
   - Назначение: Метрики телеметрии
   - Routing key: `telemetry.*`
   - TTL: 1 час (3600000 мс)
   - Max length: 100000 сообщений

#### Команды (Commands)

8. **vss.slot.commands**
   - Назначение: Команды для слотов (restart, reboot, etc.)
   - Routing key: `slot.*`
   - Dead letter exchange: `vss.events`
   - Dead letter routing key: `command.failed`

9. **vss.autodial.leads**
   - Назначение: Лиды для автодозвона (F-01)
   - Routing key: `autodial.lead`
   - TTL: 1 час
   - Max length: 50000 сообщений

10. **vss.gacs.commands**
    - Назначение: Команды GACS (execute, stop)
    - Routing key: `gacs.execute`
    - Dead letter exchange: `vss.events`
    - Dead letter routing key: `gacs.failed`

## Bindings

| Exchange | Queue | Routing Key | Описание |
|----------|-------|-------------|----------|
| vss.events | vss.call.events | call.* | Все события звонков |
| vss.events | vss.slot.events | slot.* | Все события слотов |
| vss.events | vss.pipeline.events | pipeline.* | Все события пайплайна |
| vss.events | vss.system.alerts | system.alert | Системные алерты |
| vss.events | vss.guacamole.sessions | guacamole.* | События Guacamole |
| vss.events | vss.archonts.deployments | archonts.* | События Archonts |
| vss.events | vss.telemetry.metrics | telemetry.* | Метрики телеметрии |
| vss.commands | vss.slot.commands | slot.* | Команды для слотов |
| vss.commands | vss.autodial.leads | autodial.lead | Лиды автодозвона |
| vss.commands | vss.gacs.commands | gacs.execute | Команды GACS |

## Routing Keys

### Events (vss.events)

- `call.start` - Начало звонка
- `call.end` - Завершение звонка
- `call.update` - Обновление статуса звонка
- `slot.update` - Обновление статуса слота
- `slot.restart` - Перезапуск слота
- `slot.drp.reboot` - Перезагрузка DRP
- `pipeline.start` - Запуск пайплайна
- `pipeline.stop` - Остановка пайплайна
- `pipeline.update` - Обновление пайплайна
- `system.alert` - Системный алерт
- `guacamole.session.start` - Начало сессии Guacamole
- `guacamole.session.end` - Завершение сессии Guacamole
- `rtmp.stream.start` - Начало RTMP стрима
- `rtmp.stream.stop` - Остановка RTMP стрима
- `sip.register` - Регистрация SIP номера
- `gacs.event` - Событие GACS
- `recording.start` - Начало записи
- `recording.completed` - Завершение записи
- `campaign.status` - Статус кампании
- `pbx.route.update` - Обновление маршрута PBX
- `archonts.center.deployed` - Деплоймент Archonts центра

### Commands (vss.commands)

- `slot.restart` - Перезапуск слота
- `slot.drp.reboot` - Перезагрузка DRP
- `autodial.lead` - Лид для автодозвона (F-01)
- `autodial.stop` - Остановка автодозвона
- `gacs.execute` - Выполнение GACS команды
- `gacs.stop` - Остановка GACS
- `sip.dial` - Инициация SIP звонка
- `rtmp.start` - Запуск RTMP стрима
- `rtmp.stop` - Остановка RTMP стрима

## Использование в сервисах

### OTTB Service
- Публикует: события звонков, события слотов, команды
- Потребляет: события для логирования

### DCI Service
- Потребляет: `vss.autodial.leads`, `vss.gacs.commands`
- Публикует: события пайплайна, события слотов, события звонков

### Workspace Service
- Потребляет: все event queues для передачи через Socket.IO
- Публикует: системные алерты, события Guacamole, события RTMP

## Проверка конфигурации

Используйте скрипт для проверки:
```powershell
.\verify-rabbitmq-config.ps1
```

Или через API:
```powershell
# Проверить exchanges
Invoke-RestMethod -Uri "http://localhost:15672/api/exchanges/%2Fvss" -Headers @{Authorization="Basic ..."}

# Проверить queues
Invoke-RestMethod -Uri "http://localhost:15672/api/queues/%2Fvss" -Headers @{Authorization="Basic ..."}

# Проверить bindings
Invoke-RestMethod -Uri "http://localhost:15672/api/bindings/%2Fvss" -Headers @{Authorization="Basic ..."}
```

## Доступ

- **Management UI:** http://localhost:15672
- **Username:** vss-admin
- **Password:** vss_rabbit_pass (или из переменной RABBITMQ_PASSWORD)
- **VHost:** /vss

## Файлы конфигурации

- `config/rabbitmq/definitions.json` - Определения exchanges, queues, bindings
- `config/rabbitmq/rabbitmq.conf` - Основная конфигурация RabbitMQ

## Примечания

1. Все очереди durable (сохраняются при перезапуске)
2. Используются TTL для автоматической очистки старых сообщений
3. Dead letter exchange настроен для обработки неудачных команд
4. Pattern-based routing через topic exchanges позволяет гибко маршрутизировать сообщения

