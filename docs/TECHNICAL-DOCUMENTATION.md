# VSS DEMIURGE - Техническая Документация

**Версия:** 2.1.0  
**Дата:** 2024-01-15  
**Статус:** Production Ready

## Содержание

1. [Архитектурный обзор](#1-архитектурный-обзор)
2. [Компонентная модель](#2-компонентная-модель)
3. [API Документация](#3-api-документация)
4. [Конфигурация](#4-конфигурация)
5. [Развертывание](#5-развертывание)
6. [Мониторинг](#6-мониторинг)
7. [Безопасность](#7-безопасность)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Архитектурный обзор

### 1.1 Общая архитектура

```
┌────────────────────────────┐
│        External API         │
└──────────────┬─────────────┘
               │ REST / gRPC
┌──────────────▼─────────────┐
│       Gateway / Ingress     │
└──────────────┬─────────────┘
               │ Routing
┌──────────────▼─────────────┐
│    Application Services     │
│  (Core, Orchestrator, API)  │
└──────────────┬─────────────┘
               │ Messaging
┌──────────────▼─────────────┐
│         Message Bus         │
│         (RabbitMQ)          │
└──────────────┬─────────────┘
               │ Events / Jobs
┌──────────────▼─────────────┐
│        Storage Layer        │
│ (SQL, KV, Cache, Logs, S3)  │
└─────────────────────────────┘
```

### 1.2 Принципы проектирования

- **Микросервисная архитектура**: Каждый компонент - независимый сервис
- **Event-Driven**: Взаимодействие через шину событий
- **Горизонтальное масштабирование**: Автоматическое масштабирование компонентов
- **Resilience**: Устойчивость к отказам отдельных компонентов
- **Security by Design**: Безопасность на всех уровнях

---

## 2. Компонентная модель

### 2.1 Core Services

#### VSS WORKSPACE
- **Порт:** 3000
- **Назначение:** Единое рабочее пространство, UI backend, CRM
- **Зависимости:** PostgreSQL, Redis, RabbitMQ

#### VSS OTTB (Demiurge)
- **Порт:** 8083
- **Назначение:** Управление транками, слотами, VoIP
- **Зависимости:** PostgreSQL, RabbitMQ, SIP Trunk

#### VSS DCI (Archon)
- **Порт:** 8082
- **Назначение:** CI/CD, управление данными, логирование
- **Зависимости:** PostgreSQL, RabbitMQ

#### VSS POINT
- **Порт:** 8081
- **Назначение:** RBAC, аутентификация, авторизация
- **Зависимости:** PostgreSQL, Redis

### 2.2 Infrastructure Services

- **PostgreSQL:** Основная БД
- **Redis:** Кэш, сессии, очереди
- **RabbitMQ:** Message broker
- **Nginx:** Reverse proxy, load balancer
- **Guacamole/Guacd:** Удаленный доступ
- **PostgREST:** REST API для PostgreSQL

---

## 3. API Документация

### 3.1 Authentication

#### POST /api/auth/login
Создание сессии пользователя.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "roles": ["operator"]
  }
}
```

### 3.2 Slots Management

#### GET /api/slots
Получение списка слотов.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Slot 01",
    "status": "free",
    "device_type": "auto",
    "internal_sip_number": "6001",
    "fsm_state": "READY"
  }
]
```

#### POST /api/slots/:id/restart
Перезапуск слота.

### 3.3 Calls Management

#### POST /api/call/start
Начало звонка.

**Request:**
```json
{
  "slot_id": 1,
  "phone_number": "+79991234567"
}
```

### 3.4 ARCHONTs

#### GET /api/archonts/centers
Список развернутых call-центров (только для администраторов).

#### POST /api/archonts/centers
Развертывание нового call-центра.

**Request:**
```json
{
  "name": "Call Center 1",
  "template_id": 1,
  "created_by": "user_uuid"
}
```

### 3.5 Guacamole Integration

#### POST /api/guacamole/connect
Создание Guacamole подключения к слоту.

**Request:**
```json
{
  "slot_id": 1,
  "user_id": "user_uuid"
}
```

**Response:**
```json
{
  "connection_id": "guac_1_1234567890",
  "guacamole_url": "http://localhost:8080/guacamole/#/client/guac_1_1234567890",
  "connection_params": {
    "protocol": "rdp",
    "hostname": "192.168.1.100",
    "port": 3389
  }
}
```

---

## 4. Конфигурация

### 4.1 Environment Variables

Основные переменные окружения (см. `.env.production.example`):

- `POSTGRES_URL`: Строка подключения к PostgreSQL
- `RABBITMQ_URL`: Строка подключения к RabbitMQ
- `JWT_SECRET`: Секретный ключ для JWT токенов
- `GUACAMOLE_URL`: URL Guacamole сервера

### 4.2 Конфигурационные файлы

- `config/nginx/nginx.conf`: Конфигурация Nginx
- `config/rabbitmq/rabbitmq.conf`: Конфигурация RabbitMQ
- `config/redis/redis.conf`: Конфигурация Redis
- `config/demiurge.config.json`: Конфигурация Demiurge
- `config/archon.config.json`: Конфигурация Archon

---

## 5. Развертывание

### 5.1 Docker Compose

```bash
docker-compose -f docker-compose.production.yml up -d
```

### 5.2 Kubernetes

```bash
kubectl apply -f k8s/ -n vss-production
```

### 5.3 Systemd

```bash
sudo systemctl enable vss-core
sudo systemctl start vss-core
```

### 5.4 Автоматический деплой

```bash
./scripts/deploy.sh production
```

---

## 6. Мониторинг

### 6.1 Health Checks

Все сервисы предоставляют health endpoints:

- `GET /health` - Общая проверка
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### 6.2 Метрики

Prometheus метрики доступны на `/metrics` endpoint каждого сервиса.

### 6.3 Мониторинг скрипт

```bash
python3 scripts/monitor.py
```

---

## 7. Безопасность

### 7.1 Аутентификация

- JWT токены с коротким TTL
- Refresh tokens для обновления сессий
- RBAC для контроля доступа

### 7.2 Network Security

- TLS везде (HTTPS, WSS)
- Firewall правила
- Rate limiting на API endpoints

### 7.3 Audit Logging

Все действия логируются в `security_audit_log` таблицу.

---

## 8. Troubleshooting

### 8.1 Проблемы с подключением к БД

```bash
docker exec vss_postgres psql -U vss -d vss_db -c "SELECT 1"
```

### 8.2 Проблемы с RabbitMQ

```bash
docker exec vss_rabbitmq rabbitmq-diagnostics ping
```

### 8.3 Просмотр логов

```bash
docker-compose -f docker-compose.production.yml logs -f [service_name]
```

---

## Приложения

### Приложение A: Схема базы данных

См. `database/init/01-init-schema.sql`

### Приложение B: API Endpoints

Полный список API endpoints см. `API-DOCUMENTATION.md`

### Приложение C: Конфигурационные примеры

Все конфигурационные файлы находятся в директории `config/`

