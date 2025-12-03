# VSS - Исчерпывающее руководство по работе с системой

## 📖 Содержание

1. [Введение](#введение)
2. [Быстрый старт](#быстрый-старт)
3. [Архитектура системы](#архитектура-системы)
4. [Установка и развертывание](#установка-и-развертывание)
5. [Конфигурация](#конфигурация)
6. [Работа с сервисами](#работа-с-сервисами)
7. [Управление пользователями и ролями](#управление-пользователями-и-ролями)
8. [Работа со слотами и транками](#работа-со-слотами-и-транками)
9. [Управление звонками](#управление-звонками)
10. [CRM функционал](#crm-функционал)
11. [Автодозвон](#автодозвон)
12. [Мониторинг и логирование](#мониторинг-и-логирование)
13. [Устранение неполадок](#устранение-неполадок)
14. [API документация](#api-документация)
15. [Безопасность](#безопасность)
16. [Резервное копирование и восстановление](#резервное-копирование-и-восстановление)
17. [Масштабирование](#масштабирование)
18. [Часто задаваемые вопросы](#часто-задаваемые-вопросы)

---

## Введение

### Что такое VSS?

VSS (Virtual System Stack) - это комплексная телекоммуникационная платформа для управления гетерогенными коммуникационными слотами в реальном времени. Система обеспечивает:

- ✅ Полную SIP-маршрутизацию через Kamailio и Asterisk
- ✅ Управление слотами (AUTO, MF, LS)
- ✅ Автодозвон и управление кампаниями
- ✅ CRM интеграцию
- ✅ RBAC систему безопасности
- ✅ Real-time мониторинг через WebSocket
- ✅ Удаленный доступ к устройствам через Guacamole
- ✅ Event-driven архитектуру на базе RabbitMQ

### Ключевые возможности

- **Управление транками и слотами** - создание, настройка, мониторинг
- **SIP телефония** - полная интеграция с внешними провайдерами
- **Автодозвон** - автоматические кампании звонков
- **CRM** - управление лидами, клиентами, заметками
- **Мониторинг** - Prometheus + Grafana
- **Безопасность** - JWT + RBAC
- **Масштабируемость** - микросервисная архитектура

---

## Быстрый старт

### Предварительные требования

```bash
# Проверка Docker
docker --version  # Должно быть 20.10+

# Проверка Docker Compose
docker-compose --version  # Должно быть 2.0+ или 1.29+

# Проверка свободного места
df -h  # Минимум 20GB свободно
```

### Установка (Linux/Mac)

```bash
# 1. Клонирование репозитория (если нужно)
git clone <repository-url>
cd vss-omni-telecom

# 2. Создание .env файла
cp .env.example .env
nano .env  # Отредактируйте пароли

# 3. Запуск системы
chmod +x scripts/deploy-vss-demiurge.sh
./scripts/deploy-vss-demiurge.sh
```

### Установка (Windows PowerShell)

```powershell
# 1. Переход в директорию проекта
cd C:\Users\Administrator\Documents\vss-omni-telecom

# 2. Создание .env файла
Copy-Item .env.example .env
notepad .env  # Отредактируйте пароли

# 3. Запуск системы
.\scripts\deploy-vss-demiurge.ps1
```

### Проверка статуса

```bash
# Проверка контейнеров
docker-compose -f docker-compose.vss-demiurge.yml ps

# Просмотр логов
docker-compose -f docker-compose.vss-demiurge.yml logs -f
```

### Доступ к сервисам

После успешного запуска доступны следующие сервисы:

| Сервис | URL | Учетные данные |
|--------|-----|----------------|
| VSS Workspace | http://localhost:3000 | См. раздел "Управление пользователями" |
| RabbitMQ Management | http://localhost:15672 | vss-admin / пароль из .env |
| VSS OTTB API | http://localhost:8083 | JWT токен |
| VSS DCI API | http://localhost:8082 | JWT токен |
| VSS POINT API | http://localhost:8081 | JWT токен |
| Guacamole | http://localhost:8080 | Интеграция с VSS |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3001 | admin / пароль из .env |

---

## Архитектура системы

### Компоненты системы

```
┌─────────────────────────────────────────────────────────┐
│                   VSS DEMIURGE PLATFORM                  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │    OTTB     │  │    DCI      │  │    WORKSPACE    │  │
│  │  Core       │  │  Data & CI  │  │  UI & CRM       │  │
│  │  :8083      │  │  :8082      │  │  :3000          │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              POINT (RBAC & Auth)                  │ │
│  │                    :8081                          │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌───────────────────┐ ┌─────────────┐ ┌─────────────┐
│  CUSTOM GUACAMOLE │ │   PBX       │ │   RabbitMQ  │
│   Web Gateway     │ │ Asterisk/FS │ │   Message   │
│     :8080         │ │  Kamailio   │ │     Bus     │
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

### Потоки данных (F-Flow)

Подробное описание всех потоков данных см. в [VSS-ARCHITECTURE-EXPLAINED.md](VSS-ARCHITECTURE-EXPLAINED.md)

---

## Установка и развертывание

### Подготовка окружения

#### 1. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
# RabbitMQ
RABBITMQ_PASSWORD=your_secure_password_here

# PostgreSQL
DB_PASSWORD=your_secure_password_here

# Redis
REDIS_PASSWORD=your_secure_password_here

# JWT Secret
JWT_SECRET=your_jwt_secret_here_change_in_production

# Grafana
GRAFANA_PASSWORD=your_secure_password_here

# Asterisk AMI
AMI_PASSWORD=your_ami_password_here

# SIP Provider (опционально)
PROVIDER_HOST=sip.provider.com
PROVIDER_PORT=5060
PROVIDER_DOMAIN=provider.com
PROVIDER_USER=your_username
PROVIDER_PASSWORD=your_password

# Web Port
WEB_PORT=8181
```

#### 2. Инициализация базы данных

База данных инициализируется автоматически при первом запуске через скрипты в `database/init/`.

### Развертывание через Docker Compose

#### Полное развертывание

```bash
docker-compose -f docker-compose.vss-demiurge.yml up -d
```

#### Упрощенное развертывание

```bash
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d
```

#### Production развертывание

```bash
docker-compose -f docker-compose.production.yml up -d
```

### Проверка развертывания

```bash
# Проверка статуса всех сервисов
docker-compose -f docker-compose.vss-demiurge.yml ps

# Проверка логов
docker-compose -f docker-compose.vss-demiurge.yml logs --tail=100

# Проверка здоровья сервисов
docker-compose -f docker-compose.vss-demiurge.yml ps --format "table {{.Name}}\t{{.Status}}"
```

### Остановка системы

```bash
# Остановка всех сервисов
docker-compose -f docker-compose.vss-demiurge.yml stop

# Остановка и удаление контейнеров
docker-compose -f docker-compose.vss-demiurge.yml down

# Остановка с удалением volumes (ОСТОРОЖНО: удалит данные!)
docker-compose -f docker-compose.vss-demiurge.yml down -v
```

---

## Конфигурация

### Конфигурация RabbitMQ

Файл: `config/rabbitmq/definitions.json`

```json
{
  "queues": [
    {
      "name": "autodial.leads",
      "durable": true,
      "arguments": {
        "x-message-ttl": 3600000
      }
    },
    {
      "name": "slot.status",
      "durable": true
    }
  ],
  "exchanges": [
    {
      "name": "vss.events",
      "type": "topic",
      "durable": true
    }
  ],
  "bindings": [
    {
      "source": "vss.events",
      "destination": "slot.status",
      "routing_key": "slot.*"
    }
  ]
}
```

### Конфигурация Kamailio

Файлы: `config/sip/kamailio/`

Основные файлы:
- `kamailio.cfg` - Главная конфигурация
- `database.cfg` - Настройки БД
- `routing.cfg` - Маршрутизация

### Конфигурация Asterisk

Файлы: `config/sip/asterisk/`

Основные файлы:
- `sip.conf` - SIP конфигурация
- `extensions.conf` - Dialplan
- `manager.conf` - AMI конфигурация

### Конфигурация NGINX

Файл: `config/nginx/nginx-vss.conf`

```nginx
upstream vss_workspace {
    server vss-workspace:3000;
}

upstream vss_ottb {
    server vss-ottb:8083;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://vss_workspace;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ottb {
        proxy_pass http://vss_ottb;
    }
}
```

---

## Работа с сервисами

### VSS OTTB (Omni Telecom Trunk Builder)

**Порт:** 8083  
**Назначение:** Управление транками и слотами

#### Основные функции

- Управление транками (AUTO, MF, LS)
- Управление слотами
- SIP нумерация
- Автодозвон
- GACS управление
- CDR сбор

#### Проверка статуса

```bash
curl http://localhost:8083/api/health
```

#### Просмотр слотов

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/slots
```

### VSS DCI (Distributed Control Infrastructure)

**Порт:** 8082  
**Назначение:** Управление данными и CI/CD

#### Основные функции

- Управление PostgreSQL
- CI/CD пайплайны
- Логирование
- Event processing

#### Проверка статуса

```bash
curl http://localhost:8082/api/health
```

### VSS POINT (RBAC & Auth)

**Порт:** 8081  
**Назначение:** Аутентификация и авторизация

#### Основные функции

- JWT аутентификация
- RBAC управление
- Управление пользователями
- Управление ролями

#### Вход в систему

```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

### VSS WORKSPACE

**Порт:** 3000  
**Назначение:** UI Backend и CRM

#### Основные функции

- REST API для фронтенда
- CRM интеграция
- WebSocket сервер
- Dashboard API
- Guacamole интеграция

#### Проверка статуса

```bash
curl http://localhost:3000/api/health
```

---

## Управление пользователями и ролями

### Роли в системе

#### 1. Администратор (admin)

**Права:**
- Полный доступ ко всем функциям
- Управление пользователями и ролями
- Управление системными настройками
- Управление ARCHONTs
- Запуск CI/CD пайплайнов

#### 2. Оператор (operator)

**Права:**
- Работа со слотами
- Инициация и управление звонками
- Работа с CRM (чтение/запись)
- Создание заметок
- Подключение к слотам через Guacamole (ограничено)

#### 3. Продавец (seller)

**Права:**
- Работа с CRM
- Управление лидами
- Просмотр звонков (read-only)
- Создание/обновление заметок

#### 4. Супервизор (supervisor)

**Права:**
- Просмотр всех данных (read-only)
- Генерация отчетов
- Мониторинг системы
- Просмотр логов

### Создание пользователя

```bash
curl -X POST http://localhost:8081/api/users \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "operator1",
    "password": "secure_password",
    "email": "operator1@example.com",
    "role": "operator"
  }'
```

### Создание роли

```bash
curl -X POST http://localhost:8081/api/roles \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom_role",
    "permissions": {
      "calls": ["read", "create"],
      "slots": ["read"],
      "crm": ["read", "write"]
    }
  }'
```

### Проверка прав

```bash
curl "http://localhost:8081/api/point/rolecheck?action=slots.read" \
  -H "Authorization: Bearer <token>"
```

---

## Работа со слотами и транками

### Типы транков

#### AUTO HUB
- **Тип:** auto
- **Вместимость:** 10+ слотов
- **SIP нумерация:** 6xxx (6001, 6002, ...)
- **Описание:** Автоматизированные слоты с Magneticola

#### MF HUB (Mobile Farm)
- **Тип:** mf
- **Вместимость:** 20+ слотов
- **SIP нумерация:** 7xxx (7001, 7002, ...)
- **Описание:** Мобильные устройства

#### LS HUB (Local Script)
- **Тип:** ls
- **Вместимость:** Переменная
- **SIP нумерация:** 8xxx (8001, 8002, ...)
- **Описание:** Локальные скрипты (PowerShell, AutoHotkey)

### Создание транка

```bash
curl -X POST http://localhost:8083/api/trunks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AUTO HUB 1",
    "type": "auto",
    "capacity": 10,
    "description": "Primary AUTO hub"
  }'
```

### Создание слота

```bash
curl -X POST http://localhost:8083/api/slots \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "trunk_id": 1,
    "device_id": "device_001",
    "type": "auto"
  }'
```

### Статусы слотов

```
IDLE → ASSIGNED → REGISTERING → READY → CALLING → ACTIVE_CALL → POSTCALL → IDLE
                                                                      ↓
                                                                    FAULT
```

### Просмотр слотов

```bash
# Все слоты
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/slots

# Конкретный слот
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/slots/44

# Слоты по транку
curl -H "Authorization: Bearer <token>" "http://localhost:8083/api/slots?trunk_id=1"
```

### Мониторинг слотов

```bash
# Системные метрики слота
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/monitor/slots/44
```

---

## Управление звонками

### Инициация звонка

```bash
curl -X POST http://localhost:8083/api/call/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "slot_id": 44,
    "phone_number": "+79991234567",
    "caller_id": "+79991111111"
  }'
```

### Завершение звонка

```bash
curl -X POST http://localhost:8083/api/call/end \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "c_882",
    "reason": "completed"
  }'
```

### Просмотр активных звонков

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/calls/active
```

### Просмотр истории звонков

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/calls?date=2025-01-15"
```

### CDR записи

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:8083/api/cdr/records?start_date=2025-01-15&end_date=2025-01-16"
```

### WebSocket подписка на звонки

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  socket.emit('subscribe:calls');
});

socket.on('call.update', (data) => {
  console.log('Call update:', data);
});

socket.on('slot.update', (data) => {
  console.log('Slot update:', data);
});
```

---

## CRM функционал

### Создание лида

```bash
curl -X POST http://localhost:3000/api/crm/leads \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Иван Иванов",
    "phone": "+79991234567",
    "email": "ivan@example.com",
    "status": "new",
    "assigned_seller": "seller_uuid"
  }'
```

### Просмотр лидов

```bash
# Все лиды
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/crm/leads

# Лиды продавца
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/crm/leads?assigned_seller=seller_uuid"

# Лиды по статусу
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/crm/leads?status=new"
```

### Создание заметки

```bash
curl -X POST http://localhost:3000/api/crm/note \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "c_882",
    "lead_id": "lead_uuid",
    "text": "Клиент заинтересован в продукте",
    "type": "call_note"
  }'
```

### Просмотр заметок

```bash
# Заметки по звонку
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/crm/notes/c_882

# Заметки по лиду
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/crm/notes?lead_id=lead_uuid"
```

### Обновление статуса лида

```bash
curl -X PATCH http://localhost:3000/api/crm/leads/lead_uuid \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "contacted"
  }'
```

---

## Автодозвон

### Создание кампании

```bash
curl -X POST http://localhost:8083/api/autodialer/campaigns \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Campaign 2025-01",
    "leads": [
      {"phone": "+79991234567", "name": "Client 1"},
      {"phone": "+79991234568", "name": "Client 2"}
    ],
    "settings": {
      "max_concurrent_calls": 5,
      "retry_count": 3,
      "retry_delay": 300
    }
  }'
```

### Запуск кампании

```bash
curl -X POST http://localhost:8083/api/autodialer/run-campaign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "campaign_uuid"
  }'
```

### Остановка кампании

```bash
curl -X POST http://localhost:8083/api/autodialer/stop-campaign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "campaign_uuid"
  }'
```

### Статус кампании

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/autodialer/campaigns/campaign_uuid/status
```

### Работа с очередью лидов (F-01)

Лиды автоматически помещаются в очередь RabbitMQ `autodial.leads` и обрабатываются слотами по мере их доступности.

---

## Мониторинг и логирование

### Prometheus метрики

#### Доступ к метрикам

- VSS OTTB: http://localhost:8083/metrics
- VSS DCI: http://localhost:8082/metrics
- VSS POINT: http://localhost:8081/metrics
- VSS Workspace: http://localhost:3000/metrics

#### Просмотр метрик

```bash
curl http://localhost:8083/metrics
```

### Grafana дашборды

1. Откройте http://localhost:3001
2. Войдите (admin / пароль из .env)
3. Импортируйте дашборды из `config/grafana/dashboards/`

#### Доступные дашборды

- RabbitMQ Monitoring
- PostgreSQL Performance
- Service Health Overview
- Call Statistics
- Slot Monitoring

### Просмотр логов

#### Логи всех сервисов

```bash
docker-compose -f docker-compose.vss-demiurge.yml logs -f
```

#### Логи конкретного сервиса

```bash
docker-compose -f docker-compose.vss-demiurge.yml logs -f vss-ottb
docker-compose -f docker-compose.vss-demiurge.yml logs -f vss-dci
docker-compose -f docker-compose.vss-demiurge.yml logs -f vss-point
docker-compose -f docker-compose.vss-demiurge.yml logs -f vss-workspace
```

#### Логи через API

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:8082/api/dci/logs?module=OTTB&severity=error"
```

### Мониторинг через API

#### Системные метрики

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/monitor/system
```

#### Метрики слотов

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/monitor/slots
```

#### Метрики сети

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/monitor/network
```

---

## Устранение неполадок

### Проблемы с запуском

#### Контейнеры не запускаются

```bash
# Проверка логов
docker-compose -f docker-compose.vss-demiurge.yml logs

# Проверка статуса
docker-compose -f docker-compose.vss-demiurge.yml ps

# Пересборка образов
docker-compose -f docker-compose.vss-demiurge.yml build --no-cache

# Перезапуск
docker-compose -f docker-compose.vss-demiurge.yml restart
```

#### Проблемы с базой данных

```bash
# Проверка подключения к PostgreSQL
docker exec -it vss-postgres psql -U vss -d vss_db -c "SELECT version();"

# Проверка таблиц
docker exec -it vss-postgres psql -U vss -d vss_db -c "\dt"

# Восстановление из бэкапа
docker exec -i vss-postgres psql -U vss -d vss_db < backup.sql
```

#### Проблемы с RabbitMQ

```bash
# Проверка статуса
docker exec -it vss-rabbitmq rabbitmqctl status

# Проверка очередей
docker exec -it vss-rabbitmq rabbitmqctl list_queues

# Сброс (ОСТОРОЖНО!)
docker exec -it vss-rabbitmq rabbitmqctl reset
```

### Проблемы с SIP

#### Kamailio не отвечает

```bash
# Проверка статуса
docker exec -it vss-kamailio kamcmd core.ping

# Просмотр регистраций
docker exec -it vss-kamailio kamcmd ul.show

# Логи
docker logs vss-kamailio
```

#### Asterisk не отвечает

```bash
# Проверка статуса
docker exec -it vss-asterisk asterisk -rx "core show version"

# Просмотр SIP пиров
docker exec -it vss-asterisk asterisk -rx "sip show peers"

# Логи
docker logs vss-asterisk
```

### Проблемы с аутентификацией

#### Не могу войти в систему

1. Проверьте учетные данные в БД:
```bash
docker exec -it vss-postgres psql -U vss -d vss_db -c "SELECT username, role FROM users;"
```

2. Проверьте JWT_SECRET в .env

3. Проверьте логи VSS POINT:
```bash
docker logs vss-point
```

### Проблемы со слотами

#### Слот не регистрируется в SIP

1. Проверьте SIP учетные данные слота
2. Проверьте статус Kamailio
3. Проверьте логи слота
4. Проверьте сетевую связность

#### Слот не отвечает

1. Проверьте статус устройства
2. Проверьте ADB подключение
3. Проверьте логи DCI
4. Попробуйте DRP восстановление

### Полезные команды

```bash
# Перезапуск конкретного сервиса
docker-compose -f docker-compose.vss-demiurge.yml restart vss-ottb

# Просмотр использования ресурсов
docker stats

# Очистка неиспользуемых ресурсов
docker system prune -a

# Проверка портов
netstat -tulpn | grep LISTEN  # Linux
netstat -ano | findstr LISTENING  # Windows
```

---

## API документация

### Базовый URL

- VSS Workspace: `http://localhost:3000/api`
- VSS OTTB: `http://localhost:8083/api`
- VSS DCI: `http://localhost:8082/api`
- VSS POINT: `http://localhost:8081/api`

### Аутентификация

Все запросы (кроме `/api/auth/login`) требуют заголовок:

```
Authorization: Bearer <jwt_token>
```

### Основные эндпоинты

#### Аутентификация (POINT)

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}

Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "role": "admin"
  }
}
```

#### Слоты (OTTB)

```http
GET /api/slots
GET /api/slots/:id
POST /api/slots
PATCH /api/slots/:id
DELETE /api/slots/:id
```

#### Звонки (OTTB)

```http
POST /api/call/start
POST /api/call/end
GET /api/calls
GET /api/calls/:id
```

#### CRM (Workspace)

```http
GET /api/crm/leads
POST /api/crm/leads
PATCH /api/crm/leads/:id
POST /api/crm/note
GET /api/crm/notes/:call_id
```

#### Пользователи (POINT)

```http
GET /api/users
POST /api/users
PATCH /api/users/:id
DELETE /api/users/:id
GET /api/roles
POST /api/roles
```

Полная API документация: [API-DOCUMENTATION.md](API-DOCUMENTATION.md)

---

## Безопасность

### Рекомендации для production

1. **Измените все пароли** в `.env` файле
2. **Настройте SSL/TLS** сертификаты
3. **Настройте firewall** правила
4. **Включите аутентификацию** для всех сервисов
5. **Настройте регулярные бэкапы** БД
6. **Используйте сильные пароли** (минимум 16 символов)
7. **Ограничьте доступ** к портам извне
8. **Включите аудит** всех операций
9. **Регулярно обновляйте** зависимости
10. **Мониторьте** подозрительную активность

### Проверка безопасности

```bash
# Проверка открытых портов
nmap localhost

# Проверка SSL сертификатов (если настроены)
openssl s_client -connect localhost:443

# Проверка логов безопасности
curl -H "Authorization: Bearer <token>" http://localhost:8081/api/security/audit
```

---

## Резервное копирование и восстановление

### Резервное копирование PostgreSQL

```bash
# Создание бэкапа
docker exec -t vss-postgres pg_dump -U vss vss_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Создание сжатого бэкапа
docker exec -t vss-postgres pg_dump -U vss vss_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Восстановление PostgreSQL

```bash
# Восстановление из файла
docker exec -i vss-postgres psql -U vss -d vss_db < backup.sql

# Восстановление из сжатого файла
gunzip < backup.sql.gz | docker exec -i vss-postgres psql -U vss -d vss_db
```

### Резервное копирование Redis

```bash
# Создание бэкапа
docker exec -t vss-redis redis-cli SAVE
docker cp vss-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d_%H%M%S).rdb
```

### Резервное копирование конфигураций

```bash
# Создание архива конфигураций
tar -czf config_backup_$(date +%Y%m%d_%H%M%S).tar.gz config/
```

### Автоматическое резервное копирование

Создайте cron задачу или scheduled task:

```bash
# Linux/Mac (crontab -e)
0 2 * * * /path/to/backup-script.sh

# Windows (Task Scheduler)
# Используйте PowerShell скрипт для автоматизации
```

---

## Масштабирование

### Горизонтальное масштабирование сервисов

```bash
# Масштабирование OTTB
docker-compose -f docker-compose.vss-demiurge.yml up -d --scale vss-ottb=3

# Масштабирование DCI
docker-compose -f docker-compose.vss-demiurge.yml up -d --scale vss-dci=2
```

### Настройка балансировки нагрузки

Используйте NGINX для балансировки нагрузки между несколькими экземплярами сервисов.

### Масштабирование базы данных

Для production рекомендуется использовать:
- PostgreSQL репликацию
- Redis кластер
- RabbitMQ кластер

---

## Часто задаваемые вопросы

### Q: Как сбросить пароль администратора?

A: Подключитесь к PostgreSQL и обновите пароль:

```sql
UPDATE users SET password = '$2b$10$...' WHERE username = 'admin';
```

Или используйте скрипт восстановления пароля.

### Q: Как добавить новый тип транка?

A: Отредактируйте код VSS OTTB для поддержки нового типа и обновите конфигурацию SIP.

### Q: Как настроить внешний SIP провайдер?

A: Отредактируйте переменные окружения в `.env`:

```env
PROVIDER_HOST=sip.provider.com
PROVIDER_PORT=5060
PROVIDER_DOMAIN=provider.com
PROVIDER_USER=your_username
PROVIDER_PASSWORD=your_password
```

И обновите конфигурацию Asterisk.

### Q: Как увеличить количество одновременных звонков?

A: Увеличьте количество слотов и настройте `max_concurrent_calls` в настройках автодозвона.

### Q: Как настроить запись звонков?

A: Включите запись в конфигурации Asterisk и настройте хранение записей.

### Q: Как получить доступ к Guacamole?

A: Guacamole интегрирован с VSS аутентификацией. Войдите через VSS Workspace и используйте функцию подключения к слотам.

---

## Дополнительные ресурсы

- [Архитектура VSS](VSS-ARCHITECTURE-EXPLAINED.md)
- [Технологический стек](VSS-TECH-STACK.md)
- [Руководство по развертыванию](DEPLOYMENT-GUIDE.md)
- [API Документация](API-DOCUMENTATION.md)
- [Быстрый старт](QUICKSTART.md)

---

**Версия документа:** 1.0  
**Последнее обновление:** 2025-01-XX  
**Поддержка:** VSS Development Team

