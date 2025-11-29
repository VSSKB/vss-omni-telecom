# VSS OTTB F-Flow System - Quick Start Guide

## Обзор

Этот документ описывает быстрый старт системы VSS OTTB с полной поддержкой всех F-Flow потоков.

## Предварительные требования

- Docker и Docker Compose установлены
- Порты 80, 3000, 5060, 5061, 5432, 5672, 6379, 8080, 8081, 8082, 8083, 9090, 15672 свободны

## Быстрый старт

### 1. Применить миграции базы данных

Миграции применяются автоматически при первом запуске PostgreSQL. Если нужно применить вручную:

```bash
# Проверить, что PostgreSQL запущен
docker ps | grep vss-postgres

# Применить миграцию F-Flow системы
docker exec -i vss-postgres psql -U vss -d vss_db < database/migrations/002_f_flow_system.sql
```

### 2. Запустить все сервисы

```bash
# Запустить все сервисы через Docker Compose
docker-compose -f docker-compose.vss-demiurge.yml up -d

# Проверить статус всех сервисов
docker-compose -f docker-compose.vss-demiurge.yml ps
```

### 3. Проверить работу сервисов

```bash
# Проверить здоровье сервисов
curl http://localhost:3000/health
curl http://localhost:8083/health
curl http://localhost:8082/health
curl http://localhost:8081/health

# Проверить RabbitMQ
curl -u vss-admin:vss_rabbit_pass http://localhost:15672/api/overview

# Проверить PostgreSQL
docker exec -it vss-postgres psql -U vss -d vss_db -c "SELECT COUNT(*) FROM f_flow_events;"
```

### 4. Доступ к интерфейсам

- **Frontend Dashboard:** http://localhost
- **Workspace API:** http://localhost:3000
- **OTTB API:** http://localhost:8083
- **DCI API:** http://localhost:8082
- **POINT API:** http://localhost:8081
- **Guacamole:** http://localhost:8080/guacamole
- **RabbitMQ Management:** http://localhost:15672 (vss-admin / vss_rabbit_pass)
- **Grafana:** http://localhost:3001 (admin / vss_grafana_pass)
- **Prometheus:** http://localhost:9090

## Проверка F-Flow потоков

### F-01: Autodial Lead Queue

```bash
# Создать кампанию автодозвона
curl -X POST http://localhost:8083/api/autodialer/run-campaign \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "test-campaign-001",
    "leads": [
      {"phone_number": "+1234567890", "lead_data": {"name": "Test Lead 1"}},
      {"phone_number": "+0987654321", "lead_data": {"name": "Test Lead 2"}}
    ]
  }'
```

### F-02: GACS Script Execution

```bash
# Выполнить GACS скрипт на слоте
curl -X POST http://localhost:8083/api/slots/1/gacs \
  -H "Content-Type: application/json" \
  -d '{
    "script_name": "test_script",
    "script_type": "adb",
    "script_content": "adb shell input tap 100 200"
  }'
```

### F-03: SIP Outbound Call

```bash
# Запустить звонок
curl -X POST http://localhost:8083/api/call/start \
  -H "Content-Type: application/json" \
  -d '{
    "number": "+1234567890",
    "slot": 1
  }'
```

### F-05: Slot Status Sync

Статусы слотов обновляются автоматически через WebSocket. Проверьте в frontend dashboard.

### F-06: Hardware DRP

```bash
# Перезагрузить устройство слота
curl -X POST http://localhost:8083/api/slots/1/reboot-device
```

## Мониторинг F-Flow событий

### Через PostgreSQL

```sql
-- Посмотреть последние F-Flow события
SELECT flow_number, event_type, slot_id, status, created_at
FROM f_flow_events
ORDER BY created_at DESC
LIMIT 20;

-- Статистика по F-Flow потокам
SELECT flow_number, COUNT(*) as count, 
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM f_flow_events
GROUP BY flow_number
ORDER BY flow_number;
```

### Через RabbitMQ Management

1. Откройте http://localhost:15672
2. Войдите с учетными данными: vss-admin / vss_rabbit_pass
3. Перейдите в раздел "Queues"
4. Проверьте очереди:
   - `vss.call.events` - События звонков (F-03, F-08)
   - `vss.slot.events` - События слотов (F-05)
   - `vss.autodial.leads` - Лиды автодозвона (F-01)
   - `vss.gacs.commands` - GACS команды (F-02)

## Устранение неполадок

### Проблема: RabbitMQ connection error

**Решение:**
```bash
# Проверить, что RabbitMQ запущен
docker ps | grep vss-rabbitmq

# Проверить логи
docker logs vss-rabbitmq

# Перезапустить RabbitMQ
docker restart vss-rabbitmq
```

### Проблема: PostgreSQL connection error

**Решение:**
```bash
# Проверить, что PostgreSQL запущен
docker ps | grep vss-postgres

# Проверить логи
docker logs vss-postgres

# Проверить подключение
docker exec -it vss-postgres psql -U vss -d vss_db -c "SELECT 1;"
```

### Проблема: SIP Trunk не работает

**Решение:**
```bash
# Проверить Kamailio
docker logs vss-kamailio

# Проверить Asterisk
docker logs vss-asterisk

# Проверить порты
netstat -tuln | grep 5060
```

## Следующие шаги

1. Изучите [VSS-ENGINEERING-DISSERTATION.md](./VSS-ENGINEERING-DISSERTATION.md) для полного понимания архитектуры
2. Изучите [EVENT-MAPPING.md](./EVENT-MAPPING.md) для понимания событий UI
3. Настройте внешние SIP провайдеры в `config/sip/asterisk/pjsip.conf`
4. Настройте мониторинг в Grafana
5. Настройте уведомления в Telegram/WhatsApp через Notifier API

---

**Версия:** 1.0  
**Дата:** 2025-01-XX

