# VSS DEMIURGE - Архитектурная Документация

## Общая архитектура системы

### Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────┐
│                   VSS DEMIURGE PLATFORM                  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │    OTTB     │  │    DCI      │  │    WORKSPACE    │  │
│  │  Core       │  │  Data & CI  │  │  UI & CRM       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌───────────────────┐ ┌─────────────┐ ┌─────────────┐
│  CUSTOM GUACAMOLE │ │   PBX       │ │   Redis     │
│   Web Gateway     │ │ Asterisk/FS │ │   Queue     │
└─────────┬─────────┘ └─────────────┘ └─────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                  PHYSICAL LAYER                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  AUTO HUB   │  │   MF HUB    │  │  LOCAL SCRIPT   │  │
│  │ 10+ slots   │  │ 20+ phones  │  │ PowerShell     │  │
│  │ Magneticola │  │ Mobile Farm │  │ AutoHotkey     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Компоненты системы

### 1. VSS WORKSPACE
- **Роль:** Единое рабочее пространство
- **Функции:**
  - UI Backend
  - CRM интеграция
  - WebSocket сервер для real-time обновлений
  - ARCHONTs управление (для администраторов)
  - Guacamole интеграция

### 2. VSS OTTB (Demiurge)
- **Роль:** Управление телекоммуникациями
- **Функции:**
  - Управление транками и слотами
  - SIP нумерация и маршрутизация
  - Автодозвон
  - GACS управление

### 3. VSS DCI (Archon)
- **Роль:** Управление данными и CI/CD
- **Функции:**
  - Управление PostgreSQL
  - CI/CD пайплайны
  - Логирование и аналитика
  - Event processing

### 4. VSS POINT
- **Роль:** Безопасность и доступ
- **Функции:**
  - RBAC
  - JWT аутентификация
  - Управление ролями и правами

## Потоки данных (F-Flow)

| F-Flow | Название | Протокол | Направление | Модуль |
|--------|----------|----------|-------------|--------|
| F-01 | Autodial Lead Queue | RabbitMQ | HUB → Slot | Control |
| F-02 | GACS Script Execution | SSH/ADB | HUB → Slot | Access |
| F-03 | SIP Outbound Call | SIP/RTP | Slot → Kamailio | Media |
| F-04 | RTMP Video/Audio Push | RTMP | Slot → NGINX | Media |
| F-05 | Slot Status Sync | WebSocket | Slot → HUB | Control |
| F-06 | Hardware DRP | SSH/uhubctl | DCI → Device | DRP |
| F-07 | Notification/Alerts | HTTPS | Slot → Notifier | Control |
| F-08 | DB Logging/CDR | PostgreSQL | Slot → DCI | Control |
| F-09 | SIP Inbound Call | SIP/RTP | Kamailio → Slot | Media |
| F-10 | IVR/Media Playback | RTP | Slot ↔ Asterisk | Media |
| F-11 | Autodialer Report | REST API | Slot → HUB | Control |
| F-12 | GACS Event Logging | WebSocket | Slot → HUB | Access |
| F-13 | RTMP Health Check | HTTP | Slot → NGINX | Monitoring |
| F-14 | Slot Config Sync | WebSocket | HUB → Slot | Control |

## Внутренняя SIP нумерация

- **6xxx** - AUTO слоты (6001, 6002, ...)
- **7xxx** - MF слоты (7001, 7002, ...)
- **8xxx** - LS слоты (8001, 8002, ...)
- **1xxx** - Сервисы (1001 - IVR, ...)

## FSM состояния слотов

```
IDLE → ASSIGNED → REGISTERING → READY → CALLING → ACTIVE_CALL → POSTCALL → IDLE
                                                                    ↓
                                                                  FAULT
```

## Безопасность

### Уровни безопасности

1. **Network Layer:** TLS, Firewall, VPN
2. **Application Layer:** JWT, RBAC, Rate Limiting
3. **Data Layer:** Encryption at rest, Audit logging
4. **Access Layer:** Guacamole с VSS аутентификацией

### Audit Logging

Все действия логируются в:
- `security_audit_log` - события безопасности
- `guacamole_sessions_audit` - сессии Guacamole
- `events_log` - системные события

## Масштабирование

### Горизонтальное масштабирование

- **Stateless сервисы:** Автоматическое масштабирование
- **Stateful сервисы:** Шардирование и репликация
- **Message Queue:** Партиционирование очередей

### Вертикальное масштабирование

- Ресурсные лимиты в Kubernetes/Docker
- Оптимизация запросов к БД
- Кэширование в Redis

