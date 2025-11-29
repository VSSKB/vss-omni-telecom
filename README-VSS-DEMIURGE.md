# VSS DEMIURGE - Комплексная телеком-платформа

## 🏗️ Архитектура

VSS DEMIURGE - это распределенная телеком-платформа с event-driven архитектурой на базе RabbitMQ, кастомной интеграцией Apache Guacamole и микросервисной организацией.

### Основные компоненты:

- **RabbitMQ** - Центральная шина сообщений для event-driven коммуникации
- **VSS OTTB** - Управление транками и слотами
- **VSS DCI** - Контроль данных и CI/CD процессы
- **VSS POINT** - Система ролевого доступа (RBAC)
- **VSS Workspace** - Унифицированный пользовательский интерфейс
- **Custom Guacamole** - Веб-доступ к физическим устройствам
- **PostgreSQL** - Основная база данных
- **Redis** - Кэширование и сессии
- **Prometheus + Grafana** - Мониторинг и визуализация

## 🚀 Быстрый старт

### Предварительные требования

- Docker 20.10+
- Docker Compose 2.0+ (или docker-compose 1.29+)
- 8GB+ RAM
- 20GB+ свободного места

### Установка

1. **Клонирование и настройка:**

```bash
# Скопируйте пример конфигурации
cp .env.example .env

# Отредактируйте .env файл с вашими паролями
nano .env
```

2. **Развертывание (Linux/Mac):**

```bash
chmod +x scripts/deploy-vss-demiurge.sh
./scripts/deploy-vss-demiurge.sh
```

3. **Развертывание (Windows PowerShell):**

```powershell
.\scripts\deploy-vss-demiurge.ps1
```

### Доступ к сервисам

После успешного развертывания:

- **VSS Workspace**: http://localhost:3000
- **RabbitMQ Management**: http://localhost:15672 (vss-admin / пароль из .env)
- **VSS OTTB API**: http://localhost:8083
- **VSS DCI API**: http://localhost:8082
- **VSS POINT API**: http://localhost:8081
- **Guacamole**: http://localhost:8080
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin / пароль из .env)

## 📋 Структура проекта

```
vss-omni-telecom/
├── config/
│   ├── rabbitmq/          # Конфигурации RabbitMQ
│   ├── prometheus/        # Конфигурации Prometheus
│   └── grafana/           # Дашборды Grafana
├── services/
│   ├── ottb/              # VSS OTTB Core Service
│   ├── dci/               # VSS DCI Service
│   ├── point/             # VSS POINT Service
│   ├── workspace/         # VSS Workspace
│   └── guacamole/         # Custom Guacamole
├── database/
│   └── init/              # SQL скрипты инициализации
├── scripts/
│   ├── deploy-vss-demiurge.sh    # Скрипт развертывания (Linux/Mac)
│   ├── deploy-vss-demiurge.ps1   # Скрипт развертывания (Windows)
│   └── monitoring/        # Скрипты мониторинга
├── docker-compose.vss-demiurge.yml  # Основной compose файл
└── .env.example           # Пример конфигурации
```

## 🔧 Конфигурация

### Переменные окружения (.env)

```env
# RabbitMQ
RABBITMQ_PASSWORD=your_secure_password

# PostgreSQL
DB_PASSWORD=your_secure_password

# Redis
REDIS_PASSWORD=your_secure_password

# JWT Secret
JWT_SECRET=your_jwt_secret

# Grafana
GRAFANA_PASSWORD=your_secure_password
```

## 📊 Мониторинг

### Prometheus

Метрики собираются автоматически со всех сервисов:
- VSS OTTB: http://localhost:8083/metrics
- VSS DCI: http://localhost:8082/metrics
- VSS POINT: http://localhost:8081/metrics
- VSS Workspace: http://localhost:3000/metrics

### Grafana

Импортируйте готовые дашборды из `config/grafana/dashboards/`:
- RabbitMQ Monitoring
- PostgreSQL Performance
- Service Health Overview

## 🔐 Безопасность

⚠️ **ВАЖНО**: Перед развертыванием в production:

1. Измените все пароли в `.env` файле
2. Настройте SSL/TLS сертификаты
3. Настройте firewall правила
4. Включите аутентификацию для всех сервисов
5. Настройте регулярные бэкапы базы данных

## 🐛 Устранение неполадок

### Проверка статуса сервисов

```bash
docker-compose -f docker-compose.vss-demiurge.yml ps
```

### Просмотр логов

```bash
# Все сервисы
docker-compose -f docker-compose.vss-demiurge.yml logs -f

# Конкретный сервис
docker-compose -f docker-compose.vss-demiurge.yml logs -f vss-ottb
```

### Перезапуск сервиса

```bash
docker-compose -f docker-compose.vss-demiurge.yml restart vss-ottb
```

## 📚 Документация

- [Архитектура системы](docs/architecture.md)
- [API документация](docs/api.md)
- [Руководство администратора](docs/admin-guide.md)
- [Разработка](docs/development.md)

## 🤝 Вклад в проект

1. Создайте feature branch
2. Внесите изменения
3. Создайте Pull Request

## 📄 Лицензия

[Укажите лицензию]

## 👥 Команда

VSS Development Team

