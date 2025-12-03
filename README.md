# VSS OMNI TELECOM

**Virtual System Stack - Комплексная телекоммуникационная платформа для управления гетерогенными коммуникационными слотами**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/vss/vss-omni-telecom)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)

---

## 📚 НОВИНКА: Портал документации

**🎉 Теперь доступен специальный портал для просмотра всей документации проекта!**

```powershell
# Быстрый запуск портала
.\start-docs-portal.ps1

# Или через Docker Compose
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d vss-docs
```

**Откройте в браузере:** [http://localhost:3100](http://localhost:3100)

**Возможности портала:**
- 📚 72+ документов в одном месте
- 🔍 Полнотекстовый поиск
- 📂 Категоризация по темам
- 💡 Подсветка синтаксиса кода
- 🎨 Современный интерфейс

📖 **Подробнее:** [DOCS-PORTAL-INFO.md](DOCS-PORTAL-INFO.md) | [QUICK-START-DOCS-PORTAL.md](QUICK-START-DOCS-PORTAL.md)

---

## 📋 Содержание

- [Описание проекта](#описание-проекта)
- [Основные возможности](#основные-возможности)
- [Архитектура](#архитектура)
- [Быстрый старт](#быстрый-старт)
- [Установка и развертывание](#установка-и-развертывание)
- [Конфигурация](#конфигурация)
- [API документация](#api-документация)
- [Роли и права доступа](#роли-и-права-доступа)
- [Мониторинг и логирование](#мониторинг-и-логирование)
- [Устранение неполадок](#устранение-неполадок)
- [Разработка](#разработка)
- [Безопасность](#безопасность)
- [Лицензия](#лицензия)

---

## 🎯 Описание проекта

VSS OMNI TELECOM - это комплексная платформа для управления гетерогенными коммуникационными слотами в реальном времени с полной SIP-маршрутизацией, автоматизацией и контролем на всех уровнях.

### Основные компоненты

- **VSS OTTB** (Omni Telecom Trunk Builder) - Управление транками, слотами и автодозвоном
- **VSS DCI** (Distributed Control Infrastructure) - Управление данными, CI/CD и логированием
- **VSS POINT** - Безопасность, аутентификация и RBAC
- **VSS WORKSPACE** - Единое рабочее пространство и CRM интеграция
- **Kamailio + Asterisk** - SIP PBX и маршрутизация
- **Apache Guacamole** - Web Gateway для удаленного доступа
- **RabbitMQ** - Центральная шина сообщений
- **PostgreSQL** - Основная база данных
- **Redis** - Кэширование и очереди

---

## ✨ Основные возможности

### Телефония и SIP
- ✅ Полная SIP маршрутизация через Kamailio
- ✅ Обработка медиа через Asterisk
- ✅ Поддержка различных типов слотов (AUTO, MF, LS)
- ✅ Внутренняя SIP нумерация (6xxx, 7xxx, 8xxx)
- ✅ Запись звонков и CDR
- ✅ Интеграция с внешними провайдерами

### Управление слотами
- ✅ Мониторинг статусов слотов в реальном времени
- ✅ Управление транками и устройствами
- ✅ ADB команды и GUI автоматизация (GACS)
- ✅ Hardware DRP (Device Recovery Protocol)
- ✅ Удаленный доступ через Guacamole

### Автодозвон
- ✅ Автоматические кампании звонков
- ✅ Очереди лидов через RabbitMQ
- ✅ Распределенная обработка через DCI
- ✅ Статистика и отчеты

### CRM функционал
- ✅ Управление лидами и клиентами
- ✅ Заметки по звонкам
- ✅ История коммуникаций
- ✅ Интеграция с рабочими процессами

### Безопасность
- ✅ JWT аутентификация
- ✅ RBAC (Role-Based Access Control)
- ✅ Аудит всех операций
- ✅ Изоляция контейнеров

### Мониторинг
- ✅ Prometheus метрики
- ✅ Grafana дашборды
- ✅ Real-time обновления через WebSocket
- ✅ Логирование событий

---

## 🏗️ Архитектура

### Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────┐
│                   VSS DEMIURGE PLATFORM                  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │    OTTB     │  │    DCI      │  │    WORKSPACE    │  │
│  │  Core       │  │  Data & CI  │  │  UI & CRM       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              POINT (RBAC & Auth)                   │ │
│  └────────────────────────────────────────────────────┘ │
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

### Потоки данных (F-Flow)

- **F-01**: Autodial Lead Queue - Доставка лидов для автодозвона
- **F-02**: GACS Script Execution - Выполнение GUI автоматизации
- **F-03**: SIP Outbound Call - Исходящий звонок
- **F-04**: RTMP Video/Audio Push - Передача видео с устройства
- **F-05**: Slot Status Sync - Обновление статуса слота
- **F-06**: Hardware DRP - Аппаратный контроль
- **F-09**: SIP Registration - Регистрация слотов в SIP
- **F-10**: SIP Media RTP - Медиа поток звонка
- **F-13**: CDR Collection - Сбор CDR записей
- **F-14**: SIP Call Recording - Запись звонков

Подробнее: [VSS-ARCHITECTURE-EXPLAINED.md](VSS-ARCHITECTURE-EXPLAINED.md)

---

## 🚀 Быстрый старт

### Предварительные требования

- **ОС**: Linux (Ubuntu 20.04+), Windows 10/11, macOS 10.15+
- **Docker**: 20.10+
- **Docker Compose**: 2.0+ (или 1.29+)
- **RAM**: 8GB+ (рекомендуется 16GB+)
- **CPU**: 4 ядра+ (рекомендуется 8 ядер+)
- **Диск**: 20GB+ свободного места (рекомендуется 50GB+ SSD)

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/vss/vss-omni-telecom.git
cd vss-omni-telecom

# Создать файл .env из примера
cp .env.example .env

# Отредактировать переменные окружения
nano .env  # Обязательно измените пароли!
```

### Запуск

#### Linux/Mac:
```bash
chmod +x scripts/deploy-vss-demiurge.sh
./scripts/deploy-vss-demiurge.sh
```

#### Windows PowerShell:
```powershell
.\scripts\deploy-vss-demiurge.ps1
```

#### Или через Docker Compose:
```bash
docker-compose -f docker-compose.vss-demiurge.yml up -d --build
```

### Проверка статуса

```bash
# Проверить статус всех сервисов
docker-compose -f docker-compose.vss-demiurge.yml ps

# Проверить логи
docker-compose -f docker-compose.vss-demiurge.yml logs -f

# Проверить здоровье сервисов
curl http://localhost:3000/health
curl http://localhost:8083/health
curl http://localhost:8082/health
curl http://localhost:8081/health
```

### Первый вход

**RabbitMQ Management:**
- URL: http://localhost:15672
- Логин: `vss-admin`
- Пароль: из файла `.env` (RABBITMQ_PASSWORD)

**Grafana:**
- URL: http://localhost:3001
- Логин: `admin`
- Пароль: из файла `.env` (GRAFANA_PASSWORD)

**PostgreSQL:**
- Хост: `localhost:5432`
- Пользователь: `vss`
- Пароль: из файла `.env` (DB_PASSWORD)
- База данных: `vss_db`

Подробнее: [QUICKSTART.md](QUICKSTART.md)

---

## 📦 Установка и развертывание

### Локальная разработка

```bash
# Установить зависимости
npm install

# Запустить все сервисы локально
npm run start:all

# Или запустить отдельные сервисы
npm run start:install-wizard
npm run start:vss-demiurge
npm run start:admin-backend
npm run start:ottb
npm run start:dci
npm run start:point
npm run start:workspace
```

### Production развертывание

```bash
# Использовать production конфигурацию
docker-compose -f docker-compose.production.yml up -d

# Применить миграции БД
./scripts/migrate.sh

# Проверить статус
docker-compose -f docker-compose.production.yml ps
```

Подробнее: [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md), [README-PRODUCTION.md](README-PRODUCTION.md)

---

## ⚙️ Конфигурация

### Переменные окружения (.env)

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

### Конфигурационные файлы

- `config/sip/kamailio/` - Конфигурация Kamailio
- `config/sip/asterisk/` - Конфигурация Asterisk
- `config/rabbitmq/` - Конфигурация RabbitMQ
- `config/nginx/` - Конфигурация NGINX
- `config/prometheus/` - Конфигурация Prometheus
- `config/grafana/` - Конфигурация Grafana
- `config/redis/` - Конфигурация Redis

### SIP нумерация

- `6xxx` (6001-6999) - AUTO слоты
- `7xxx` (7001-7999) - MF слоты
- `8xxx` (8001-8999) - LS слоты
- `9xxx` (9001-9999) - Сервисы

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

#### Звонки (OTTB)
- `POST /api/call/start` - Запуск звонка
- `POST /api/call/end` - Завершение звонка
- `GET /api/call/:id` - Статус звонка
- `GET /api/calls/feed` - Live feed всех звонков

#### Автодозвон (OTTB)
- `POST /api/autodialer/run-campaign` - Запуск кампании
- `POST /api/autodialer/stop-campaign` - Остановка кампании

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
- ✅ Полный доступ ко всем функциям
- ✅ Управление пользователями и ролями
- ✅ Управление транками и ARCHONTs
- ✅ Системные настройки и мониторинг
- ✅ Запуск CI/CD пайплайнов

### Оператор (operator)
- ✅ Работа со слотами и звонками
- ✅ Инициация и завершение звонков
- ✅ Работа с CRM (лиды, заметки)
- ✅ Подключение к назначенным слотам через Guacamole
- ❌ Управление пользователями
- ❌ Системные настройки

### Продавец (seller)
- ✅ Управление лидами и клиентами
- ✅ Создание и обновление заметок
- ✅ Просмотр истории звонков
- ❌ Управление слотами
- ❌ Инициация звонков напрямую

### Супервизор (supervisor)
- ✅ Мониторинг всех операций
- ✅ Просмотр отчетов и статистики
- ✅ Просмотр логов системы
- ❌ Изменение настроек
- ❌ Управление пользователями

Подробнее: [VSS-ARCHITECTURE-EXPLAINED.md](VSS-ARCHITECTURE-EXPLAINED.md#роли-пользователей-и-их-права)

---

## 📊 Мониторинг и логирование

### Prometheus метрики

```bash
# Метрики сервисов
curl http://localhost:3000/metrics
curl http://localhost:8083/metrics
curl http://localhost:8082/metrics
curl http://localhost:8081/metrics
```

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

Подключение через Socket.IO к `http://localhost:3000`:

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
│   ├── sip/              # SIP конфигурации
│   ├── rabbitmq/         # RabbitMQ конфигурации
│   ├── nginx/            # NGINX конфигурации
│   ├── prometheus/       # Prometheus конфигурации
│   └── grafana/          # Grafana конфигурации
├── database/             # База данных
│   ├── init/             # SQL скрипты инициализации
│   └── migrations/       # Миграции БД
├── scripts/              # Скрипты автоматизации
├── frontend/             # Frontend приложения
├── admin-frontend/       # Админ панель
└── docker-compose.*.yml  # Docker Compose файлы
```

### Технологический стек

- **Backend**: Node.js 18+, Express, Socket.IO
- **Базы данных**: PostgreSQL 15, Redis 7, SQLite3
- **Message Queue**: RabbitMQ 3.12
- **SIP**: Kamailio, Asterisk 18
- **Remote Access**: Apache Guacamole 1.5.3
- **Monitoring**: Prometheus, Grafana
- **Containerization**: Docker, Docker Compose

Подробнее: [VSS-TECH-STACK.md](VSS-TECH-STACK.md)

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

### Тестирование

```bash
# Запустить тесты
npm test

# Запустить аудит
npm run audit
```

Подробнее: [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md)

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

Подробнее: [VSS-MANUAL.md](VSS-MANUAL.md) (раздел "Безопасность")

---

## 📚 Дополнительная документация

- [VSS-DOCUMENTATION-INDEX.md](VSS-DOCUMENTATION-INDEX.md) - Индекс всей документации
- [VSS-MANUAL.md](VSS-MANUAL.md) - Полное руководство пользователя
- [VSS-ARCHITECTURE-EXPLAINED.md](VSS-ARCHITECTURE-EXPLAINED.md) - Детальное описание архитектуры
- [VSS-TECH-STACK.md](VSS-TECH-STACK.md) - Технологический стек
- [API-DOCUMENTATION.md](API-DOCUMENTATION.md) - Полная API документация
- [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) - Руководство по развертыванию
- [QUICKSTART.md](QUICKSTART.md) - Быстрый старт
- [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md) - Локальная разработка

---

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add some amazing feature'`)
4. Запушьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

## 📝 Лицензия

Этот проект лицензирован под ISC License.

---

## 👨‍💻 Авторы

VSS Development Team

---

## 📞 Поддержка

Если у вас возникли вопросы или проблемы:

1. Проверьте [документацию](VSS-DOCUMENTATION-INDEX.md)
2. Изучите [руководство по устранению неполадок](VSS-MANUAL.md)
3. Создайте Issue в репозитории

---

## 🎉 Благодарности

- Команде разработчиков VSS
- Всем контрибьюторам проекта
- Сообществу открытого исходного кода

---

**Версия:** 1.0.0  
**Последнее обновление:** 2025-01-XX  
**Статус:** Production Ready

