# VSS OMNI TELECOM - Полная документация проекта

**Версия документации:** 1.0  
**Дата обновления:** 2025-01-XX  
**Статус:** Актуальная

---

## 📚 Оглавление

1. [Введение](#введение)
2. [Обзор системы](#обзор-системы)
3. [Архитектура](#архитектура)
4. [Компоненты системы](#компоненты-системы)
5. [Установка и настройка](#установка-и-настройка)
6. [Конфигурация](#конфигурация)
7. [API документация](#api-документация)
8. [Роли и права доступа](#роли-и-права-доступа)
9. [Рабочие процессы](#рабочие-процессы)
10. [Мониторинг и логирование](#мониторинг-и-логирование)
11. [Безопасность](#безопасность)
12. [Устранение неполадок](#устранение-неполадок)
13. [Разработка](#разработка)
14. [Масштабирование](#масштабирование)
15. [Резервное копирование](#резервное-копирование)

---

## 🎯 Введение

### Что такое VSS OMNI TELECOM?

VSS OMNI TELECOM (Virtual System Stack) - это комплексная телекоммуникационная платформа для управления гетерогенными коммуникационными слотами в реальном времени. Система обеспечивает полную SIP-маршрутизацию, автоматизацию и контроль на всех уровнях.

### Основные возможности

- **Управление слотами**: Мониторинг и управление различными типами коммуникационных слотов (AUTO, MF, LS)
- **SIP телефония**: Полная интеграция с Kamailio и Asterisk для маршрутизации звонков
- **Автодозвон**: Автоматические кампании звонков с распределенной обработкой
- **CRM интеграция**: Управление лидами, клиентами и историей коммуникаций
- **Удаленный доступ**: Web Gateway через Apache Guacamole для управления устройствами
- **Мониторинг**: Real-time мониторинг через Prometheus и Grafana
- **Безопасность**: RBAC система с полным аудитом операций

### Целевая аудитория

- **Администраторы**: Управление системой, пользователями и инфраструктурой
- **Операторы**: Работа со слотами и звонками
- **Продавцы**: Работа с CRM и лидами
- **Супервизоры**: Мониторинг и отчетность
- **Разработчики**: Расширение функциональности системы

---

## 🏗️ Обзор системы

### Высокоуровневая архитектура

VSS построена на микросервисной архитектуре с event-driven коммуникацией:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Web UI     │  │  Admin UI    │  │  Mobile App  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└───────────────────────────┬────────────────────────────────┘
                             │ HTTP/WebSocket
┌─────────────────────────────▼────────────────────────────────┐
│                    API GATEWAY LAYER                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              NGINX Reverse Proxy                      │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬────────────────────────────────┘
                             │
┌─────────────────────────────▼────────────────────────────────┐
│                    APPLICATION LAYER                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ WORKSPACE│  │   OTTB    │  │   DCI    │  │  POINT    │    │
│  │  :3000   │  │  :8083    │  │  :8082   │  │  :8081    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└───────────────────────────┬────────────────────────────────┘
                             │
┌─────────────────────────────▼────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │PostgreSQL│  │ RabbitMQ │  │  Redis   │  │ Guacamole│    │
│  │  :5432   │  │  :5672    │  │  :6379   │  │  :8080   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└───────────────────────────┬────────────────────────────────┘
                             │
┌─────────────────────────────▼────────────────────────────────┐
│                    SIP LAYER                                  │
│  ┌──────────┐  ┌──────────┐                                 │
│  │ Kamailio │  │ Asterisk  │                                 │
│  │  :5060   │  │  :5061    │                                 │
│  └──────────┘  └──────────┘                                 │
└───────────────────────────┬────────────────────────────────┘
                             │
┌─────────────────────────────▼────────────────────────────────┐
│                    PHYSICAL LAYER                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ AUTO HUB │  │  MF HUB  │  │ LS HUB   │                   │
│  │ 10+ slots│  │ 20+ slots│  │ 5+ slots │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└────────────────────────────────────────────────────────────────┘
```

### Технологический стек

#### Backend
- **Node.js** 18+ (LTS)
- **Express** 4.21.2 - Web framework
- **Socket.IO** 4.8.1 - WebSocket сервер
- **PostgreSQL** 15 - Основная БД
- **Redis** 7 - Кэширование
- **RabbitMQ** 3.12 - Message Queue

#### SIP & Telephony
- **Kamailio** - SIP Proxy
- **Asterisk** 18 - PBX

#### Remote Access
- **Apache Guacamole** 1.5.3 - Web Gateway

#### Monitoring
- **Prometheus** - Метрики
- **Grafana** - Визуализация

#### Containerization
- **Docker** 20.10+
- **Docker Compose** 2.0+

Подробнее: [VSS-TECH-STACK.md](VSS-TECH-STACK.md)

---

## 🧩 Архитектура

### Микросервисная архитектура

VSS состоит из четырех основных микросервисов:

1. **VSS WORKSPACE** (Порт: 3000)
   - Единое рабочее пространство
   - CRM интеграция
   - WebSocket сервер для real-time обновлений
   - Dashboard API

2. **VSS OTTB** (Порт: 8083)
   - Управление транками и слотами
   - Автодозвон
   - SIP нумерация
   - GACS управление

3. **VSS DCI** (Порт: 8082)
   - Управление данными
   - CI/CD пайплайны
   - Логирование и аналитика
   - Event processing

4. **VSS POINT** (Порт: 8081)
   - Аутентификация (JWT)
   - RBAC система
   - Управление пользователями и ролями

### Потоки данных (F-Flow)

Система использует стандартизированные потоки данных:

| Поток | Назначение | Протокол | Направление |
|-------|-----------|----------|-------------|
| F-01 | Autodial Lead Queue | RabbitMQ | HUB → Slot |
| F-02 | GACS Script Execution | SSH/ADB | HUB → Slot |
| F-03 | SIP Outbound Call | SIP/RTP | Slot → Kamailio → PSTN |
| F-04 | RTMP Video/Audio Push | RTMP/HLS | Slot → NGINX |
| F-05 | Slot Status Sync | WebSocket | Slot → HUB |
| F-06 | Hardware DRP | SSH/uhubctl | DCI → Device |
| F-09 | SIP Registration | SIP | Slot → Kamailio |
| F-10 | SIP Media RTP | RTP/RTCP | Slot ↔ Asterisk |
| F-13 | CDR Collection | PostgreSQL | Asterisk → DCI |
| F-14 | SIP Call Recording | RTP → Storage | Asterisk → Storage |

Подробнее: [VSS-ARCHITECTURE-EXPLAINED.md](VSS-ARCHITECTURE-EXPLAINED.md)

---

## 🔧 Компоненты системы

### VSS WORKSPACE

**Назначение**: Единое рабочее пространство и CRM интеграция

**Основные функции**:
- REST API для фронтенда
- CRM интеграция (лиды, клиенты, заметки)
- WebSocket сервер (Socket.IO)
- Dashboard API
- Guacamole интеграция

**API эндпоинты**:
- `GET /api/dashboard` - Данные дашборда
- `GET /api/crm/leads` - Список лидов
- `POST /api/crm/note` - Добавление заметки
- `GET /api/crm/notes/:call_id` - Заметки по звонку

**WebSocket события**:
- `call.update` - Обновление статуса звонка
- `slot.update` - Обновление статуса слота
- `pipeline.update` - Обновление пайплайна

### VSS OTTB

**Назначение**: Управление телекоммуникациями и автодозвоном

**Основные функции**:
- Управление транками и слотами
- SIP нумерация и маршрутизация
- Автодозвон
- GACS управление
- PBX интеграция
- CDR и запись звонков

**Внутренняя SIP нумерация**:
- `6xxx` (6001-6999) - AUTO слоты
- `7xxx` (7001-7999) - MF слоты
- `8xxx` (8001-8999) - LS слоты
- `9xxx` (9001-9999) - Сервисы

**Состояния слотов (FSM)**:
```
IDLE → ASSIGNED → REGISTERING → READY → CALLING → ACTIVE_CALL → POSTCALL → IDLE
                                                                      ↓
                                                                    FAULT
```

### VSS DCI

**Назначение**: Управление данными, CI/CD и логированием

**Основные функции**:
- Управление PostgreSQL
- CI/CD пайплайны
- Логирование и аналитика
- Event processing
- DCI узлы

### VSS POINT

**Назначение**: Безопасность, аутентификация и RBAC

**Основные функции**:
- JWT аутентификация
- RBAC (Role-Based Access Control)
- Управление ролями
- Управление пользователями
- Проверка прав

### Kamailio + Asterisk

**Kamailio**:
- SIP Proxy и маршрутизация
- Регистрация слотов
- Балансировка нагрузки
- Интеграция с PostgreSQL

**Asterisk**:
- PBX и медиа обработка
- Обработка RTP медиа
- Запись звонков
- CDR сбор
- IVR функционал

### Apache Guacamole

**Назначение**: Web Gateway для удаленного доступа к слотам

**Протоколы**:
- RDP (Remote Desktop Protocol)
- VNC (Virtual Network Computing)
- SSH (Secure Shell)
- Telnet

**Интеграция**:
- Аутентификация через VSS POINT
- Аудит сессий в PostgreSQL
- RBAC контроль доступа

---

## 📦 Установка и настройка

### Системные требования

#### Минимальные требования
- **ОС**: Linux (Ubuntu 20.04+), Windows 10/11, macOS 10.15+
- **RAM**: 8GB+
- **CPU**: 4 ядра+
- **Диск**: 20GB+ свободного места
- **Docker**: 20.10+
- **Docker Compose**: 2.0+ (или 1.29+)

#### Рекомендуемые требования
- **RAM**: 16GB+
- **CPU**: 8 ядер+
- **Диск**: 50GB+ SSD
- **Сеть**: Стабильное подключение для SIP

### Установка

#### Шаг 1: Клонирование репозитория

```bash
git clone https://github.com/vss/vss-omni-telecom.git
cd vss-omni-telecom
```

#### Шаг 2: Настройка переменных окружения

```bash
cp .env.example .env
nano .env  # Обязательно измените пароли!
```

#### Шаг 3: Запуск через Docker Compose

```bash
docker-compose -f docker-compose.vss-demiurge.yml up -d --build
```

#### Шаг 4: Применение миграций БД

```bash
docker exec -i vss-postgres psql -U vss -d vss_db < database/migrations/001_init.sql
```

#### Шаг 5: Проверка статуса

```bash
docker-compose -f docker-compose.vss-demiurge.yml ps
```

Подробнее: [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md), [QUICKSTART.md](QUICKSTART.md)

---

## ⚙️ Конфигурация

### Переменные окружения

Основные переменные в файле `.env`:

```env
# База данных
DB_PASSWORD=vss_postgres_pass
POSTGRES_URL=postgresql://vss:vss_postgres_pass@postgres:5432/vss_db

# RabbitMQ
RABBITMQ_PASSWORD=vss_rabbit_pass
RABBITMQ_URL=amqp://vss-admin:vss_rabbit_pass@rabbitmq:5672/vss

# Redis
REDIS_PASSWORD=vss_redis_pass
REDIS_URL=redis://:vss_redis_pass@redis:6379

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=3600

# Grafana
GRAFANA_PASSWORD=vss_grafana_pass
```

### Конфигурация SIP

#### Kamailio

Конфигурация находится в `config/sip/kamailio/kamailio.cfg`:

- Маршрутизация SIP запросов
- Регистрация слотов
- Интеграция с PostgreSQL
- Балансировка нагрузки

#### Asterisk

Конфигурация находится в `config/sip/asterisk/`:

- `pjsip.conf` - PJSIP конфигурация
- `extensions.conf` - Dialplan
- `cdr.conf` - CDR настройки
- `manager.conf` - AMI настройки

### Конфигурация RabbitMQ

Файл `config/rabbitmq/definitions.json` содержит:
- Очереди для автодозвона
- Exchanges для событий
- Bindings между очередями и exchanges

### Конфигурация NGINX

Файлы в `config/nginx/`:
- `nginx-vss.conf` - Reverse proxy конфигурация
- `nginx-rtmp.conf` - RTMP сервер конфигурация

---

## 📡 API документация

### Базовые URL

- **VSS WORKSPACE**: `http://localhost:3000`
- **VSS OTTB**: `http://localhost:8083`
- **VSS DCI**: `http://localhost:8082`
- **VSS POINT**: `http://localhost:8081`

### Аутентификация

Большинство эндпоинтов требуют JWT токен:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8083/api/slots
```

Получение токена:

```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "op12",
    "password": "1234"
  }'
```

### Основные эндпоинты

#### Аутентификация (POINT)
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/refresh` - Обновление токена
- `POST /api/auth/logout` - Выход из системы

#### Слоты (OTTB)
- `GET /api/slots` - Список всех слотов
- `GET /api/slots/:id` - Детали слота
- `POST /api/slots/:id/restart` - Перезапуск слота
- `POST /api/slots/:id/reboot-device` - Перезагрузка устройства
- `POST /api/slots/:id/adb-command` - Выполнение ADB команды

#### Звонки (OTTB)
- `POST /api/call/start` - Запуск звонка
- `POST /api/call/end` - Завершение звонка
- `GET /api/call/:id` - Статус звонка
- `GET /api/calls/feed` - Live feed всех звонков

#### Автодозвон (OTTB)
- `POST /api/autodialer/run-campaign` - Запуск кампании
- `POST /api/autodialer/stop-campaign` - Остановка кампании

#### GACS (OTTB)
- `POST /api/gacs/run-script` - Запуск скрипта GUI
- `GET /api/gacs/status/:script_id` - Статус выполнения скрипта
- `POST /api/gacs/stop/:script_id` - Остановка скрипта

#### CRM (WORKSPACE)
- `GET /api/crm/leads` - Получение лидов
- `POST /api/crm/note` - Добавление заметки
- `GET /api/crm/notes/:call_id` - Заметки по звонку

#### Мониторинг (OTTB)
- `GET /api/monitor/system` - Системные метрики
- `GET /api/monitor/usb` - Статус USB HUB
- `GET /api/monitor/network` - Сетевые метрики
- `GET /api/monitor/slots/:id` - Мониторинг слота

Полная документация: [API-DOCUMENTATION.md](API-DOCUMENTATION.md)

---

## 👥 Роли и права доступа

### Администратор (admin)

**Права доступа**:
- Полный доступ ко всем функциям
- Управление пользователями и ролями
- Управление транками и ARCHONTs
- Системные настройки и мониторинг
- Запуск CI/CD пайплайнов

**Guacamole права**:
- Все протоколы (RDP, VNC, SSH)
- Неограниченное количество подключений
- Доступ ко всем слотам

### Оператор (operator)

**Права доступа**:
- Работа со слотами и звонками
- Инициация и завершение звонков
- Работа с CRM (лиды, заметки)
- Подключение к назначенным слотам через Guacamole

**Guacamole права**:
- Ограниченные протоколы (по назначению)
- Максимум 5 подключений
- Доступ только к назначенным слотам
- Таймаут сессии: 3600 секунд

**Ограничения**:
- Не может создавать/удалять пользователей
- Не может управлять системными настройками
- Не может перезапускать систему
- Не может управлять ARCHONTs

### Продавец (seller)

**Права доступа**:
- Управление лидами и клиентами
- Создание и обновление заметок
- Просмотр истории звонков

**Ограничения**:
- Не может управлять слотами
- Не может инициировать звонки напрямую
- Не может подключаться к слотам через Guacamole
- Работает только с CRM функционалом

### Супервизор (supervisor)

**Права доступа**:
- Мониторинг всех операций
- Просмотр отчетов и статистики
- Просмотр логов системы

**Ограничения**:
- Не может изменять системные настройки
- Не может управлять пользователями (только просмотр)
- Не может инициировать звонки
- Не может управлять ARCHONTs

Подробнее: [VSS-ARCHITECTURE-EXPLAINED.md](VSS-ARCHITECTURE-EXPLAINED.md#роли-пользователей-и-их-права)

---

## 🔄 Рабочие процессы

### Процесс аутентификации

1. Пользователь отправляет запрос на `/api/auth/login`
2. POINT проверяет учетные данные в PostgreSQL
3. Получение роли и прав из таблицы `roles`
4. Генерация JWT токена с role и permissions
5. Обновление `last_login` в таблице `users`
6. Возврат токена клиенту

### Процесс работы оператора

#### Инициация звонка:

1. Оператор подключается к системе и получает JWT токен
2. Просмотр доступных слотов через `GET /api/slots`
3. Начало звонка через `POST /api/call/start`
4. OTTB проверяет статус слота и создает запись в БД
5. Отправка команды через RabbitMQ (F-01) в DCI
6. DCI находит свободный слот и регистрирует SIP (F-09)
7. Инициация SIP INVITE через Kamailio (F-03)
8. Обновление статуса через WebSocket (F-05)
9. Во время звонка: RTMP поток (F-04), RTP медиа (F-10)
10. Завершение звонка через `POST /api/call/end`
11. Обновление CDR (F-13)

#### Работа с CRM:

1. Добавление заметки через `POST /api/crm/note`
2. WORKSPACE сохраняет в БД
3. Привязка к лиду в `crm_leads`

### Процесс автодозвона

1. Администратор запускает кампанию через `POST /api/autodialer/run-campaign`
2. OTTB создает кампанию в БД
3. Лиды добавляются в очередь RabbitMQ (F-01)
4. DCI узлы потребляют лиды из очереди
5. Слоты обрабатывают лиды по очереди
6. Для каждого лида выполняется процесс звонка
7. Статистика обновляется в реальном времени

### Процесс работы продавца

1. Просмотр назначенных лидов через `GET /api/crm/leads?assigned_seller=<id>`
2. Просмотр истории звонков по лиду через `GET /api/calls?lead_id=<id>`
3. Создание/обновление лида через `POST /api/crm/leads`
4. Просмотр статистики через `GET /api/dashboard` (только свои лиды)

---

## 📊 Мониторинг и логирование

### Prometheus метрики

Метрики доступны на эндпоинтах:
- `http://localhost:3000/metrics` - VSS WORKSPACE
- `http://localhost:8083/metrics` - VSS OTTB
- `http://localhost:8082/metrics` - VSS DCI
- `http://localhost:8081/metrics` - VSS POINT

### Grafana дашборды

1. Откройте http://localhost:3001
2. Войдите с учетными данными из `.env`
3. Импортируйте дашборды из `config/grafana/dashboards/`

### Логи

```bash
# Все сервисы
docker-compose -f docker-compose.vss-demiurge.yml logs -f

# Конкретный сервис
docker logs -f vss-ottb
docker logs -f vss-dci
docker logs -f vss-workspace
docker logs -f vss-kamailio
docker logs -f vss-asterisk
```

### WebSocket события

Подключение через Socket.IO:

```javascript
const socket = io('http://localhost:3000');

socket.on('call.update', (data) => {
  console.log('Call update:', data);
});

socket.on('slot.update', (data) => {
  console.log('Slot update:', data);
});
```

---

## 🔐 Безопасность

### Реализованные меры

- ✅ JWT аутентификация с истечением токенов
- ✅ RBAC (Role-Based Access Control)
- ✅ Хеширование паролей (BCrypt)
- ✅ Аудит всех операций
- ✅ Изоляция контейнеров через Docker networks
- ✅ Безопасная конфигурация Redis

### Рекомендации для production

- 🔒 Использовать SSL/TLS сертификаты
- 🔒 Настроить firewall правила
- 🔒 Регулярно обновлять зависимости
- 🔒 Мониторить безопасность
- 🔒 Регулярно делать резервные копии БД
- 🔒 Использовать сильные пароли
- 🔒 Ограничить доступ к портам

---

## 🔧 Устранение неполадок

### Проблемы с подключением

```bash
# Проверить PostgreSQL
docker exec vss-postgres psql -U vss -d vss_db -c "SELECT 1"

# Проверить RabbitMQ
docker exec vss-rabbitmq rabbitmq-diagnostics ping

# Проверить Redis
docker exec vss-redis redis-cli ping
```

### Проблемы с SIP

```bash
# Проверить Kamailio
docker logs vss-kamailio
docker exec -it vss-kamailio kamctl ul show

# Проверить Asterisk
docker logs vss-asterisk
docker exec -it vss-asterisk asterisk -rx "pjsip show endpoints"
```

### Проблемы с портами

```bash
# Проверить занятые порты
netstat -tuln | grep 5060
netstat -tuln | grep 3000
netstat -tuln | grep 8083

# Использовать скрипт проверки
.\check-port-conflicts.ps1
```

Подробнее: [VSS-MANUAL.md](VSS-MANUAL.md) (раздел "Устранение неполадок")

---

## 💻 Разработка

### Структура проекта

```
vss-omni-telecom/
├── services/              # Микросервисы
│   ├── ottb/             # VSS OTTB
│   ├── dci/              # VSS DCI
│   ├── point/            # VSS POINT
│   ├── workspace/        # VSS WORKSPACE
│   ├── kamailio/         # Kamailio конфигурация
│   ├── asterisk/         # Asterisk конфигурация
│   └── guacamole/        # Guacamole конфигурация
├── config/               # Конфигурационные файлы
├── database/             # База данных
├── scripts/              # Скрипты автоматизации
├── frontend/             # Frontend приложения
└── admin-frontend/       # Админ панель
```

### Запуск в режиме разработки

```bash
# Установить зависимости
npm install

# Запустить все сервисы
npm run start:all

# Или запустить отдельные сервисы
npm run start:ottb
npm run start:dci
npm run start:point
npm run start:workspace
```

Подробнее: [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md)

---

## 📈 Масштабирование

### Горизонтальное масштабирование

```bash
# Увеличить количество реплик
docker-compose -f docker-compose.production.yml up -d --scale vss-ottb=3
```

### Kubernetes масштабирование

```bash
# Масштабировать deployment
kubectl scale deployment vss-ottb --replicas=5 -n vss-production
```

---

## 💾 Резервное копирование

### Создание бэкапа БД

```bash
docker exec vss-postgres pg_dump -U vss vss_db > backup_$(date +%Y%m%d).sql
```

### Восстановление из бэкапа

```bash
docker exec -i vss-postgres psql -U vss vss_db < backup_20240115.sql
```

---

## 📚 Дополнительные ресурсы

- [VSS-DOCUMENTATION-INDEX.md](VSS-DOCUMENTATION-INDEX.md) - Индекс всей документации
- [VSS-MANUAL.md](VSS-MANUAL.md) - Полное руководство пользователя
- [VSS-ARCHITECTURE-EXPLAINED.md](VSS-ARCHITECTURE-EXPLAINED.md) - Детальное описание архитектуры
- [VSS-TECH-STACK.md](VSS-TECH-STACK.md) - Технологический стек
- [API-DOCUMENTATION.md](API-DOCUMENTATION.md) - Полная API документация
- [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) - Руководство по развертыванию
- [QUICKSTART.md](QUICKSTART.md) - Быстрый старт

---

**Версия документации:** 1.0  
**Последнее обновление:** 2025-01-XX  
**Поддержка:** VSS Development Team

