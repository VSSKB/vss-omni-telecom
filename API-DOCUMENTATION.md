# VSS OTTB API Documentation

Полная документация API для VSS DEMIURGE OTTB Platform.

## Базовые URL

- **OTTB API**: `http://localhost:8083`
- **DCI API**: `http://localhost:8082`
- **POINT API**: `http://localhost:8081`
- **WORKSPACE API**: `http://localhost:3000`

## 1. Authentication API (POINT)

### POST /api/auth/login
Вход в систему.

**Request:**
```json
{
  "username": "op12",
  "password": "1234"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "role": "operator",
  "expires": 3600,
  "permissions": {...}
}
```

### POST /api/auth/refresh
Обновление токена.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "token": "new_jwt_token",
  "expires": 3600
}
```

### POST /api/auth/logout
Выход из системы.

## 2. RBAC / USERS API (POINT)

### GET /api/point/rolecheck?action=call.start
Проверка прав пользователя на действие.

**Response:**
```json
{
  "allowed": true,
  "permissions": ["call.start", "slot.view", "pipeline.run"]
}
```

### GET /api/roles
Список всех ролей.

### POST /api/roles/:id
Обновление роли.

**Request:**
```json
{
  "permissions": {
    "OTTB": ["read", "write"],
    "WORKSPACE": ["view", "call"]
  }
}
```

### GET /api/users
Список пользователей.

### POST /api/users
Создание пользователя.

**Request:**
```json
{
  "username": "op21",
  "password": "secure123",
  "email": "op21@example.com",
  "role": "operator"
}
```

### PATCH /api/users/:id
Обновление пользователя.

### DELETE /api/users/:id
Удаление пользователя.

## 3. SLOTS API (OTTB)

### GET /api/slots
Список всех слотов.

**Response:**
```json
[
  {
    "id": 44,
    "status": "ONLINE",
    "device": "A52",
    "user": "op12",
    "trunk": "trunk-1",
    "last_activity": "2025-11-15T10:30:00Z",
    "metrics": {...}
  }
]
```

### GET /api/slots/:id
Детали слота.

**Response:**
```json
{
  "id": 44,
  "status": "ONLINE",
  "device": "A52",
  "user": "op12",
  "trunk": "trunk-1",
  "temperature": "38C",
  "battery": "82%",
  "last_event": "call.start",
  "config": {...},
  "network": {...}
}
```

### POST /api/slots/:id/restart
Перезапуск слота.

**Response:**
```json
{
  "status": "restarting",
  "slot": 44
}
```

### POST /api/slots/:id/reboot-device
Перезагрузка физического устройства.

### POST /api/slots/:id/adb-command
Выполнение ADB/GACS команды.

**Request:**
```json
{
  "command": "input tap 200 400"
}
```

**Response:**
```json
{
  "status": "executing",
  "slot": 44
}
```

## 4. CALLS / AUTODIALER API (OTTB)

### POST /api/call/start
Запуск звонка.

**Request:**
```json
{
  "number": "+380991234567",
  "slot": "AUTO"
}
```

**Response:**
```json
{
  "call_id": "c_882",
  "slot": 44,
  "state": "RING"
}
```

### POST /api/call/end
Завершение звонка.

**Request:**
```json
{
  "call_id": "c_882"
}
```

### GET /api/call/:id
Статус звонка.

**Response:**
```json
{
  "call_id": "c_882",
  "slot": 44,
  "number": "+380991234567",
  "status": "connected",
  "start_time": "2025-11-15T10:30:00Z",
  "end_time": null,
  "duration": null
}
```

### GET /api/calls/feed
Live feed всех звонков.

**Response:**
```json
[
  {
    "call_id": "c_882",
    "slot": 44,
    "number": "+380991234567",
    "user": "op12",
    "status": "ringing",
    "start_time": "2025-11-15T10:30:00Z"
  }
]
```

### POST /api/autodialer/run-campaign
Запуск кампании.

**Request:**
```json
{
  "campaign_id": "campaign_001",
  "leads": [
    {"number": "+380991234567", "name": "John Doe"},
    {"number": "+380991234568", "name": "Jane Smith"}
  ]
}
```

### POST /api/autodialer/stop-campaign
Остановка кампании.

**Request:**
```json
{
  "campaign_id": "campaign_001"
}
```

## 5. GACS / AUTOMATION API (OTTB)

### POST /api/gacs/run-script
Запуск скрипта GUI.

**Request:**
```json
{
  "slot_id": 44,
  "script": "telegram_call",
  "params": {
    "number": "+380991234567"
  }
}
```

**Response:**
```json
{
  "status": "executing",
  "script_id": "gacs_001"
}
```

### GET /api/gacs/status/:script_id
Статус выполнения скрипта.

### POST /api/gacs/stop/:script_id
Остановка скрипта.

## 6. SIP / PBX API (OTTB)

### GET /api/pbx/status
Статус всех транков.

**Response:**
```json
{
  "trunks": [
    {
      "name": "ottb-sip-1",
      "state": "OK",
      "failed": 0,
      "last_check": "2025-11-15T10:30:00Z"
    },
    {
      "name": "ottb-sip-2",
      "state": "WARN",
      "failed": 1,
      "last_check": "2025-11-15T10:25:00Z"
    }
  ]
}
```

### POST /api/pbx/dial
Инициация звонка через внутренний SIP Trunk.

**Request:**
```json
{
  "from": "slot_12",
  "to": "+380991234567",
  "trunk": "trunk-1"
}
```

### GET /api/pbx/cdr/:id
Получение записи CDR звонка.

## 7. MONITORING API (OTTB)

### GET /api/monitor/system
Системные метрики (CPU, RAM, uptime).

**Response:**
```json
{
  "cpu": 37,
  "ram": 61,
  "uptime": "14h32m"
}
```

### GET /api/monitor/usb
Статус USB HUB.

**Response:**
```json
[
  {
    "hub": "HUB1",
    "online": 20,
    "total": 20
  },
  {
    "hub": "HUB2",
    "online": 17,
    "total": 20
  }
]
```

### GET /api/monitor/network
Сетевые метрики.

**Response:**
```json
{
  "bandwidth_mbps": 1000,
  "latency_ms": 12
}
```

### GET /api/monitor/slots/:id
Подробный мониторинг слота.

**Response:**
```json
{
  "slot_id": 44,
  "cpu": 15,
  "ram": 45,
  "temperature": "38C",
  "battery": "82%",
  "latency": 12
}
```

## 8. DCI / PIPELINES API

### GET /api/dci/pipelines
Список пайплайнов.

**Response:**
```json
[
  {
    "id": 1,
    "name": "deploy-production",
    "branch": "main",
    "status": "running",
    "triggered_by": "admin",
    "start_time": "2025-11-15T10:30:00Z",
    "end_time": null,
    "log_url": "http://..."
  }
]
```

### POST /api/dci/pipeline/:id/run
Запуск пайплайна.

### POST /api/dci/pipeline/:id/stop
Остановка пайплайна.

### GET /api/dci/pipeline/:id/status
Статус выполнения пайплайна.

### GET /api/dci/status
Статус DCI системы.

### GET /api/dci/logs
Логи пайплайнов.

**Query Parameters:**
- `module` - фильтр по модулю
- `severity` - фильтр по уровню (info, warning, error)
- `limit` - лимит записей (по умолчанию 100)

### POST /api/dci/log-event
Логирование события.

**Request:**
```json
{
  "module": "OTTB",
  "severity": "info",
  "message": "Slot 44 restarted",
  "context": {
    "slot_id": 44,
    "user": "admin"
  },
  "user_id": "uuid-here"
}
```

## 9. CRM / NOTES API (WORKSPACE)

### POST /api/crm/note
Добавление заметки.

**Request:**
```json
{
  "call_id": "c_882",
  "text": "Client asked about price."
}
```

### GET /api/crm/notes/:call_id
Получить все заметки по звонку.

**Response:**
```json
{
  "notes": [
    {
      "text": "Client asked about price.",
      "timestamp": "2025-11-15T10:30:00Z"
    }
  ]
}
```

### GET /api/crm/leads
Получение лидов.

**Query Parameters:**
- `status` - фильтр по статусу
- `assigned_seller` - фильтр по продавцу

## 10. DASHBOARD API (WORKSPACE)

### GET /api/dashboard
Данные дашборда.

**Response:**
```json
{
  "active_calls": 5,
  "active_slots": 12,
  "today_calls": 982,
  "failed_calls": 37,
  "timestamp": "2025-11-15T10:30:00Z"
}
```

## 11. WebSocket Events (WORKSPACE)

Подключение через Socket.IO к `http://localhost:3000`.

### События от клиента:

- `subscribe:calls` - подписка на события звонков
- `subscribe:slots` - подписка на события слотов

### События от сервера:

- `call.update` - обновление статуса звонка
- `slot.update` - обновление статуса слота

**Пример события:**
```json
{
  "event": "call.update",
  "data": {
    "call_id": "c_882",
    "slot": 44,
    "state": "ACTIVE"
  }
}
```

## 12. Error Format

Все ошибки возвращаются в едином формате:

```json
{
  "error": true,
  "code": "SLOT_BUSY",
  "message": "Slot is currently used."
}
```

### Коды ошибок:

- `AUTH_FAIL` - ошибка аутентификации
- `PERMISSION_DENIED` - недостаточно прав
- `SLOT_BUSY` - слот занят
- `SLOT_OFFLINE` - слот офлайн
- `CALL_FAILED` - ошибка звонка
- `PIPELINE_ERROR` - ошибка пайплайна
- `INVALID_PARAMS` - неверные параметры
- `NOT_FOUND` - ресурс не найден

## 13. Authentication

Большинство эндпоинтов требуют JWT токен в заголовке:

```
Authorization: Bearer <token>
```

Токен получается через `/api/auth/login` и действителен 1 час.

