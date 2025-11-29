# VSS OTTB - Deployment Guide
## Полное руководство по развертыванию системы с F-Flow поддержкой

---

## 📋 Предварительные требования

- Docker и Docker Compose установлены
- Порты 80, 3000, 5060, 5061, 5432, 5672, 6379, 8080, 8081, 8082, 8083, 8085, 9090, 15672 свободны
- Минимум 4GB RAM
- Минимум 20GB свободного места на диске

---

## 🚀 Пошаговое развертывание

### Шаг 1: Применить миграции базы данных

```bash
# Запустить PostgreSQL (если еще не запущен)
docker-compose -f docker-compose.vss-demiurge.yml up -d postgres

# Подождать 10 секунд для инициализации
sleep 10

# Применить миграцию F-Flow системы
docker exec -i vss-postgres psql -U vss -d vss_db < database/migrations/002_f_flow_system.sql

# Проверить, что таблицы созданы
docker exec -it vss-postgres psql -U vss -d vss_db -c "\dt f_flow*"
```

### Шаг 2: Запустить все сервисы

```bash
# Остановить существующие контейнеры (если есть)
docker-compose -f docker-compose.vss-demiurge.yml down

# Собрать и запустить все сервисы
docker-compose -f docker-compose.vss-demiurge.yml up -d --build

# Проверить статус всех сервисов
docker-compose -f docker-compose.vss-demiurge.yml ps
```

### Шаг 3: Проверить работу сервисов

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

### Шаг 4: Проверить SIP Trunk сервисы

```bash
# Проверить Kamailio
docker logs vss-kamailio

# Проверить Asterisk
docker logs vss-asterisk

# Проверить порты
netstat -tuln | grep 5060
netstat -tuln | grep 5061
```

### Шаг 5: Проверить RTMP сервер

```bash
# Проверить NGINX RTMP
docker logs vss-nginx-rtmp

# Проверить порты
netstat -tuln | grep 1935
netstat -tuln | grep 8085
```

---

## 🔍 Проверка F-Flow потоков

### Проверка через PostgreSQL

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

### Проверка через RabbitMQ Management

1. Откройте http://localhost:15672
2. Войдите: `vss-admin` / `vss_rabbit_pass`
3. Перейдите в раздел "Queues"
4. Проверьте очереди:
   - `vss.call.events` - События звонков (F-03, F-08)
   - `vss.slot.events` - События слотов (F-05)
   - `vss.autodial.leads` - Лиды автодозвона (F-01)
   - `vss.gacs.commands` - GACS команды (F-02)

---

## 🧪 Тестирование функциональности

### Тест 1: Запуск кампании автодозвона (F-01)

```bash
curl -X POST http://localhost:8083/api/autodialer/run-campaign \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "test-campaign-001",
    "name": "Test Campaign",
    "leads": [
      {"phone_number": "+1234567890", "lead_data": {"name": "Test Lead 1"}},
      {"phone_number": "+0987654321", "lead_data": {"name": "Test Lead 2"}}
    ]
  }'
```

**Ожидаемый результат:**
- Кампания создана в базе данных
- Лиды добавлены в `autodialer_leads`
- События F-01 опубликованы в RabbitMQ
- DCI обрабатывает лиды

### Тест 2: Выполнение GACS скрипта (F-02)

```bash
curl -X POST http://localhost:8083/api/slots/1/gacs \
  -H "Content-Type: application/json" \
  -d '{
    "script_name": "test_script",
    "script_type": "adb",
    "script_content": "adb shell input tap 100 200"
  }'
```

**Ожидаемый результат:**
- GACS скрипт создан в базе данных
- Событие F-02 опубликовано в RabbitMQ
- DCI выполняет скрипт через SlotEngine
- Статус обновляется через F-12

### Тест 3: Запуск звонка (F-03)

```bash
curl -X POST http://localhost:8083/api/call/start \
  -H "Content-Type: application/json" \
  -d '{
    "number": "+1234567890",
    "slot": 1
  }'
```

**Ожидаемый результат:**
- Звонок создан в базе данных
- Событие F-03 опубликовано в RabbitMQ
- Слот переходит в состояние CALLING
- SIP INVITE отправляется через Kamailio

### Тест 4: Перезагрузка устройства (F-06)

```bash
curl -X POST http://localhost:8083/api/slots/1/reboot-device
```

**Ожидаемый результат:**
- DRP операция создана в базе данных
- Событие F-06 опубликовано в RabbitMQ
- DCI выполняет DRP операцию
- Слот переходит в состояние FAULT, затем восстанавливается

### Тест 5: Начало записи звонка (F-14)

```bash
curl -X POST http://localhost:8083/api/recordings/start \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": 1,
    "slot_id": 1,
    "recording_type": "audio"
  }'
```

**Ожидаемый результат:**
- Запись создана в базе данных
- Событие F-14 опубликовано в RabbitMQ
- Запись начинается через Asterisk

---

## 📊 Мониторинг

### Логи сервисов

```bash
# Логи всех сервисов
docker-compose -f docker-compose.vss-demiurge.yml logs -f

# Логи конкретного сервиса
docker logs -f vss-ottb
docker logs -f vss-dci
docker logs -f vss-workspace
docker logs -f vss-kamailio
docker logs -f vss-asterisk
```

### Метрики через API

```bash
# Метрики дашборда
curl http://localhost:3000/api/dashboard

# Статус слотов
curl http://localhost:8083/api/slots

# Активные звонки
curl http://localhost:8083/api/calls/feed

# Статус PBX
curl http://localhost:8083/api/pbx/status
```

### Grafana Dashboard

1. Откройте http://localhost:3001
2. Войдите: `admin` / `vss_grafana_pass`
3. Создайте дашборды для:
   - F-Flow события
   - Активные звонки
   - Статусы слотов
   - RTMP потоки
   - GACS скрипты

---

## 🔧 Устранение неполадок

### Проблема: RabbitMQ connection error

**Симптомы:**
```
[WORKSPACE] RabbitMQ connection error: getaddrinfo ENOTFOUND rabbitmq
```

**Решение:**
```bash
# Проверить, что RabbitMQ запущен
docker ps | grep vss-rabbitmq

# Проверить логи
docker logs vss-rabbitmq

# Перезапустить RabbitMQ
docker restart vss-rabbitmq

# Проверить сеть Docker
docker network inspect vss-omni-telecom_vss-network
```

### Проблема: PostgreSQL connection error

**Симптомы:**
```
Error: connect ECONNREFUSED postgres:5432
```

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

**Симптомы:**
- Слоты не регистрируются в Kamailio
- Звонки не проходят

**Решение:**
```bash
# Проверить Kamailio
docker logs vss-kamailio
docker exec -it vss-kamailio kamctl ul show

# Проверить Asterisk
docker logs vss-asterisk
docker exec -it vss-asterisk asterisk -rx "pjsip show endpoints"

# Проверить конфигурации
docker exec -it vss-kamailio cat /etc/kamailio/kamailio.cfg
docker exec -it vss-asterisk cat /etc/asterisk/pjsip.conf
```

### Проблема: RTMP потоки не работают

**Симптомы:**
- RTMP потоки не запускаются
- HLS не доступен

**Решение:**
```bash
# Проверить NGINX RTMP
docker logs vss-nginx-rtmp

# Проверить порты
netstat -tuln | grep 1935
netstat -tuln | grep 8085

# Проверить конфигурацию
docker exec -it vss-nginx-rtmp cat /etc/nginx/nginx.conf

# Тест RTMP подключения
ffmpeg -re -i test.mp4 -c copy -f flv rtmp://localhost:1935/live/test_stream
```

### Проблема: F-Flow события не логируются

**Симптомы:**
- События не появляются в `f_flow_events`

**Решение:**
```bash
# Проверить, что миграция применена
docker exec -it vss-postgres psql -U vss -d vss_db -c "\dt f_flow*"

# Проверить RabbitMQ очереди
curl -u vss-admin:vss_rabbit_pass http://localhost:15672/api/queues

# Проверить логи сервисов
docker logs vss-ottb | grep "F-"
docker logs vss-dci | grep "F-"
```

---

## 📚 Дополнительные ресурсы

- [VSS Engineering Dissertation](./docs/VSS-ENGINEERING-DISSERTATION.md)
- [Event Mapping](./docs/EVENT-MAPPING.md)
- [Quick Start Guide](./docs/QUICK-START-F-FLOW.md)
- [Implementation Summary](./docs/IMPLEMENTATION-SUMMARY.md)
- [Database Migrations](./database/migrations/README.md)

---

## ✅ Чеклист развертывания

- [ ] Применены миграции базы данных
- [ ] Все сервисы запущены и здоровы
- [ ] RabbitMQ работает и очереди созданы
- [ ] PostgreSQL работает и таблицы созданы
- [ ] Kamailio запущен и доступен
- [ ] Asterisk запущен и доступен
- [ ] NGINX RTMP запущен и доступен
- [ ] Frontend доступен на http://localhost
- [ ] WebSocket подключение работает
- [ ] F-Flow события логируются
- [ ] Тесты пройдены успешно

---

**Версия:** 1.0  
**Дата:** 2025-01-XX

