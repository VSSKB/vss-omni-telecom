# VSS OMNI TELECOM - Краткий справочник

**Быстрая справка по основным командам и настройкам VSS**

---

## 🚀 Быстрый старт

### Запуск системы

```bash
# Запустить все сервисы
docker-compose -f docker-compose.vss-demiurge.yml up -d

# Проверить статус
docker-compose -f docker-compose.vss-demiurge.yml ps

# Просмотр логов
docker-compose -f docker-compose.vss-demiurge.yml logs -f
```

### Остановка системы

```bash
# Остановить все сервисы
docker-compose -f docker-compose.vss-demiurge.yml down

# Остановить с удалением volumes
docker-compose -f docker-compose.vss-demiurge.yml down -v
```

---

## 🌐 URL и порты

| Сервис | URL | Порт | Описание |
|--------|-----|------|----------|
| VSS Workspace | http://localhost:3000 | 3000 | Основной UI |
| VSS OTTB | http://localhost:8083 | 8083 | API управления слотами |
| VSS DCI | http://localhost:8082 | 8082 | API данных |
| VSS POINT | http://localhost:8081 | 8081 | API аутентификации |
| RabbitMQ Management | http://localhost:15672 | 15672 | Управление очередями |
| Grafana | http://localhost:3001 | 3001 | Мониторинг |
| Prometheus | http://localhost:9090 | 9090 | Метрики |
| Guacamole | http://localhost:8080 | 8080 | Удаленный доступ |
| Kamailio SIP | - | 5060 | SIP Proxy |
| Asterisk SIP | - | 5061 | PBX |
| PostgreSQL | - | 5432 | База данных |
| Redis | - | 6379 | Кэш |
| RabbitMQ AMQP | - | 5672 | Message Queue |

---

## 🔐 Учетные данные по умолчанию

### RabbitMQ
- **URL**: http://localhost:15672
- **Логин**: `vss-admin`
- **Пароль**: из файла `.env` (RABBITMQ_PASSWORD)

### Grafana
- **URL**: http://localhost:3001
- **Логин**: `admin`
- **Пароль**: из файла `.env` (GRAFANA_PASSWORD)

### PostgreSQL
- **Хост**: `localhost:5432`
- **Пользователь**: `vss`
- **Пароль**: из файла `.env` (DB_PASSWORD)
- **База данных**: `vss_db`

### Redis
- **Хост**: `localhost:6379`
- **Пароль**: из файла `.env` (REDIS_PASSWORD)

---

## 📡 Основные API команды

### Аутентификация

```bash
# Вход в систему
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "op12", "password": "1234"}'

# Использование токена
TOKEN="your-jwt-token-here"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8083/api/slots
```

### Слоты

```bash
# Список всех слотов
curl -H "Authorization: Bearer $TOKEN" http://localhost:8083/api/slots

# Детали слота
curl -H "Authorization: Bearer $TOKEN" http://localhost:8083/api/slots/44

# Перезапуск слота
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8083/api/slots/44/restart

# Перезагрузка устройства
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8083/api/slots/44/reboot-device
```

### Звонки

```bash
# Запуск звонка
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"number": "+380991234567", "slot": "AUTO"}' \
  http://localhost:8083/api/call/start

# Завершение звонка
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"call_id": "c_882"}' \
  http://localhost:8083/api/call/end

# Статус звонка
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8083/api/call/c_882

# Live feed звонков
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8083/api/calls/feed
```

### Автодозвон

```bash
# Запуск кампании
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "campaign_001",
    "leads": [
      {"number": "+380991234567", "name": "John Doe"},
      {"number": "+380991234568", "name": "Jane Smith"}
    ]
  }' \
  http://localhost:8083/api/autodialer/run-campaign

# Остановка кампании
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"campaign_id": "campaign_001"}' \
  http://localhost:8083/api/autodialer/stop-campaign
```

### CRM

```bash
# Список лидов
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/crm/leads

# Добавление заметки
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"call_id": "c_882", "text": "Client asked about price."}' \
  http://localhost:3000/api/crm/note

# Заметки по звонку
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/crm/notes/c_882
```

### Мониторинг

```bash
# Системные метрики
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8083/api/monitor/system

# Статус USB HUB
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8083/api/monitor/usb

# Сетевые метрики
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8083/api/monitor/network

# Мониторинг слота
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8083/api/monitor/slots/44
```

---

## 🐳 Docker команды

### Управление контейнерами

```bash
# Список контейнеров
docker ps

# Логи контейнера
docker logs -f vss-ottb
docker logs -f vss-dci
docker logs -f vss-workspace
docker logs -f vss-postgres
docker logs -f vss-rabbitmq

# Перезапуск контейнера
docker restart vss-ottb

# Остановка контейнера
docker stop vss-ottb

# Запуск контейнера
docker start vss-ottb

# Удаление контейнера
docker rm vss-ottb
```

### Работа с образами

```bash
# Список образов
docker images

# Сборка образа
docker build -t vss-ottb ./services/ottb

# Удаление образа
docker rmi vss-ottb
```

### Работа с volumes

```bash
# Список volumes
docker volume ls

# Информация о volume
docker volume inspect vss-omni-telecom_postgres_data

# Удаление volume
docker volume rm vss-omni-telecom_postgres_data
```

---

## 🗄️ База данных

### PostgreSQL команды

```bash
# Подключение к БД
docker exec -it vss-postgres psql -U vss -d vss_db

# Выполнение SQL запроса
docker exec -it vss-postgres psql -U vss -d vss_db -c "SELECT COUNT(*) FROM slots;"

# Список таблиц
docker exec -it vss-postgres psql -U vss -d vss_db -c "\dt"

# Список пользователей
docker exec -it vss-postgres psql -U vss -d vss_db -c "\du"

# Создание бэкапа
docker exec vss-postgres pg_dump -U vss vss_db > backup_$(date +%Y%m%d).sql

# Восстановление из бэкапа
docker exec -i vss-postgres psql -U vss vss_db < backup_20240115.sql
```

### Redis команды

```bash
# Подключение к Redis
docker exec -it vss-redis redis-cli

# Проверка подключения
docker exec vss-redis redis-cli ping

# Получение ключа
docker exec vss-redis redis-cli GET key_name

# Установка ключа
docker exec vss-redis redis-cli SET key_name value

# Список всех ключей
docker exec vss-redis redis-cli KEYS "*"
```

---

## 🔍 Диагностика

### Проверка здоровья сервисов

```bash
# Проверка всех сервисов
curl http://localhost:3000/health
curl http://localhost:8083/health
curl http://localhost:8082/health
curl http://localhost:8081/health

# Проверка PostgreSQL
docker exec vss-postgres pg_isready -U vss -d vss_db

# Проверка RabbitMQ
docker exec vss-rabbitmq rabbitmq-diagnostics ping

# Проверка Redis
docker exec vss-redis redis-cli ping
```

### Проверка портов

```bash
# Linux/Mac
netstat -tuln | grep 3000
netstat -tuln | grep 5060
netstat -tuln | grep 8083

# Windows PowerShell
netstat -an | findstr 3000
netstat -an | findstr 5060
netstat -an | findstr 8083
```

### Проверка логов

```bash
# Все сервисы
docker-compose -f docker-compose.vss-demiurge.yml logs -f

# Конкретный сервис
docker-compose -f docker-compose.vss-demiurge.yml logs -f vss-ottb

# Последние 100 строк
docker-compose -f docker-compose.vss-demiurge.yml logs --tail=100 vss-ottb
```

---

## 📊 Мониторинг

### Prometheus метрики

```bash
# Метрики сервисов
curl http://localhost:3000/metrics
curl http://localhost:8083/metrics
curl http://localhost:8082/metrics
curl http://localhost:8081/metrics
```

### Grafana

1. Откройте http://localhost:3001
2. Войдите с учетными данными
3. Импортируйте дашборды из `config/grafana/dashboards/`

### RabbitMQ Management

1. Откройте http://localhost:15672
2. Войдите с учетными данными
3. Проверьте очереди и exchanges

---

## 🔧 Конфигурация

### Основные файлы конфигурации

- `.env` - Переменные окружения
- `docker-compose.vss-demiurge.yml` - Docker Compose конфигурация
- `config/sip/kamailio/kamailio.cfg` - Конфигурация Kamailio
- `config/sip/asterisk/pjsip.conf` - Конфигурация Asterisk PJSIP
- `config/sip/asterisk/extensions.conf` - Dialplan Asterisk
- `config/rabbitmq/definitions.json` - Очереди RabbitMQ
- `config/nginx/nginx-vss.conf` - Конфигурация NGINX
- `config/prometheus/prometheus.yml` - Конфигурация Prometheus

### Переменные окружения

Основные переменные в `.env`:

```env
DB_PASSWORD=vss_postgres_pass
RABBITMQ_PASSWORD=vss_rabbit_pass
REDIS_PASSWORD=vss_redis_pass
JWT_SECRET=your-secret-key-here
GRAFANA_PASSWORD=vss_grafana_pass
```

---

## 🆘 Устранение неполадок

### Проблемы с подключением

```bash
# Проверить сеть Docker
docker network inspect vss-omni-telecom_vss-network

# Проверить DNS
docker exec vss-ottb nslookup rabbitmq
docker exec vss-ottb nslookup postgres
```

### Проблемы с SIP

```bash
# Проверить Kamailio
docker exec -it vss-kamailio kamctl ul show
docker exec -it vss-kamailio kamctl ping

# Проверить Asterisk
docker exec -it vss-asterisk asterisk -rx "pjsip show endpoints"
docker exec -it vss-asterisk asterisk -rx "core show channels"
```

### Очистка системы

```bash
# Остановить все контейнеры
docker-compose -f docker-compose.vss-demiurge.yml down

# Удалить все volumes (ОСТОРОЖНО!)
docker-compose -f docker-compose.vss-demiurge.yml down -v

# Очистить неиспользуемые ресурсы
docker system prune -a
```

---

## 📝 Полезные команды

### Поиск в логах

```bash
# Поиск ошибок
docker logs vss-ottb 2>&1 | grep -i error

# Поиск по времени
docker logs --since 1h vss-ottb

# Поиск в нескольких контейнерах
docker-compose -f docker-compose.vss-demiurge.yml logs | grep -i error
```

### Мониторинг ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
docker system df

# Детальная информация о контейнере
docker inspect vss-ottb
```

---

## 🔗 Полезные ссылки

- [Полная документация](DOCUMENTATION.md)
- [API документация](API-DOCUMENTATION.md)
- [Руководство по развертыванию](DEPLOYMENT-GUIDE.md)
- [Быстрый старт](QUICKSTART.md)
- [Архитектура](VSS-ARCHITECTURE-EXPLAINED.md)
- [Технологический стек](VSS-TECH-STACK.md)

---

**Версия:** 1.0  
**Последнее обновление:** 2025-01-XX

