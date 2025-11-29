# VSS DEMIURGE - API Reference

## Base URL

- **Production:** `https://api.vss.example.com`
- **Staging:** `https://staging-api.vss.example.com`

## Authentication

Все API запросы (кроме `/api/auth/login`) требуют JWT токен в заголовке:

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Authentication

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
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_token_here",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "roles": ["operator"]
  }
}
```

### Slots

#### GET /api/slots
Получение списка всех слотов.

**Response:**
```json
[
  {
    "id": 1,
    "slot_number": 1,
    "name": "Slot 01",
    "status": "free",
    "device_type": "auto",
    "internal_sip_number": "6001",
    "sip_username": "slot_1@vss.internal",
    "fsm_state": "READY",
    "trunk_id": 1,
    "trunk_name": "AUTO HUB 1"
  }
]
```

#### GET /api/slots/:id
Получение информации о конкретном слоте.

#### POST /api/slots/:id/restart
Перезапуск слота (требует права `slots:write`).

#### POST /api/slots/:id/reboot-device
Перезагрузка устройства слота (требует права `slots:admin`).

### Calls

#### POST /api/call/start
Начало звонка.

**Request:**
```json
{
  "slot_id": 1,
  "phone_number": "+79991234567",
  "direction": "outbound"
}
```

**Response:**
```json
{
  "call_id": 12345,
  "status": "initiated",
  "slot_id": 1,
  "phone_number": "+79991234567"
}
```

#### POST /api/call/end
Завершение звонка.

**Request:**
```json
{
  "call_id": 12345
}
```

#### GET /api/calls/feed
Получение ленты активных звонков.

### ARCHONTs (только для администраторов)

#### GET /api/archonts/centers
Список развернутых call-центров.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Call Center 1",
    "status": "active",
    "template_name": "standard",
    "trunks_count": 10,
    "slots_count": 50,
    "created_at": "2024-01-15T10:00:00Z"
  }
]
```

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

### Guacamole

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

#### POST /api/guacamole/disconnect
Завершение Guacamole сессии.

#### GET /api/guacamole/sessions
Получение активных сессий.

### Dashboard

#### GET /api/dashboard
Получение данных для дашборда.

**Response:**
```json
{
  "slots": {
    "total": 18,
    "busy": 5,
    "free": 12,
    "error": 1
  },
  "calls": {
    "active": 5
  },
  "trunks": {
    "total": 10,
    "online": 9
  },
  "guacamole_sessions": 3,
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Неверные параметры |
| 401 | Unauthorized - Требуется аутентификация |
| 403 | Forbidden - Недостаточно прав |
| 404 | Not Found - Ресурс не найден |
| 500 | Internal Server Error - Внутренняя ошибка сервера |
| 503 | Service Unavailable - Сервис недоступен |

## Rate Limiting

- **API endpoints:** 10 запросов в секунду
- **Authentication:** 5 запросов в минуту

## WebSocket Events

### Подключение

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected');
});
```

### События

- `slot.update` - Обновление статуса слота
- `call.update` - Обновление статуса звонка
- `system.alert` - Системные алерты
- `pipeline.update` - Обновление CI/CD пайплайна

### Пример

```javascript
socket.on('slot.update', (data) => {
  console.log('Slot updated:', data);
  // data: { slot_id: 1, status: 'busy', fsm_state: 'CALLING' }
});
```

