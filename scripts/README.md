# VSS OMNI TELECOM - Скрипты установки и запуска

## Описание

Набор скриптов для автоматической установки, запуска и проверки работоспособности платформы VSS OMNI TELECOM.

## Скрипты

### Linux/Mac

#### `install.sh`
Устанавливает все зависимости платформы:
- Системные пакеты (Python, Node.js, Docker, PostgreSQL client, Redis tools, ADB)
- Node.js зависимости для всех сервисов (OTTB, DCI, POINT, WORKSPACE)
- Python зависимости для MF-HUB
- Создает необходимые директории

**Использование:**
```bash
sudo bash scripts/install.sh
```

#### `startup.sh`
Запускает все сервисы через Docker Compose:
- Проверяет наличие Docker и Docker Compose
- Запускает все контейнеры
- Ожидает готовности PostgreSQL и Redis
- Автоматически инициализирует схему базы данных
- Запускает health-check

**Использование:**
```bash
bash scripts/startup.sh
```

#### `health.sh`
Проверяет работоспособность всех сервисов:
- Проверяет статус контейнеров
- Проверяет доступность баз данных (PostgreSQL, Redis, RabbitMQ)
- Проверяет HTTP endpoints всех сервисов

**Использование:**
```bash
bash scripts/health.sh
```

### Windows PowerShell

#### `install.ps1`
Аналог `install.sh` для Windows:
- Устанавливает Chocolatey (если не установлен)
- Устанавливает зависимости через Chocolatey
- Устанавливает Node.js модули
- Создает необходимые директории

**Использование:**
```powershell
.\scripts\install.ps1
```
*(Запуск от имени администратора)*

#### `startup.ps1`
Аналог `startup.sh` для Windows:
- Проверяет Docker
- Запускает все контейнеры
- Ожидает готовности сервисов
- Запускает health-check

**Использование:**
```powershell
.\scripts\startup.ps1
```

#### `health.ps1`
Аналог `health.sh` для Windows:
- Проверяет контейнеры и сервисы
- Проверяет HTTP endpoints

**Использование:**
```powershell
.\scripts\health.ps1
```

## Автоматическая инициализация

При первом запуске PostgreSQL автоматически:
1. Создает базу данных `vss_db`
2. Выполняет скрипт `database/init/01-init-schema.sql`
3. Создает все таблицы, индексы, триггеры
4. Вставляет дефолтные роли и администратора

**Дефолтный администратор:**
- Username: `admin`
- Password: `admin123`
- **⚠️ ВАЖНО: Измените пароль в production!**

## Порты сервисов

| Сервис | Порт | URL |
|--------|------|-----|
| WORKSPACE | 3000 | http://localhost:3000 |
| OTTB API | 8083 | http://localhost:8083 |
| DCI API | 8082 | http://localhost:8082 |
| POINT API | 8081 | http://localhost:8081 |
| Guacamole | 8080 | http://localhost:8080/guacamole |
| RabbitMQ Management | 15672 | http://localhost:15672 |
| Grafana | 3001 | http://localhost:3001 |
| Prometheus | 9090 | http://localhost:9090 |

## Структура базы данных

База данных автоматически создается со следующими таблицами:
- `users` - пользователи системы
- `roles` - роли и права доступа
- `trunks` - транки (AUTO HUB, MF HUB, LOCAL SCRIPT)
- `slots` - слоты для устройств
- `calls` - история звонков
- `crm_leads` - лиды CRM
- `ci_pipelines` - CI/CD пайплайны
- `events_log` - системные события
- `archont_centers` - облачные call-центры (ARCHONTs)
- `archont_trunks` - транки для ARCHONTs
- `archont_slots` - слоты для ARCHONTs
- `archont_templates` - шаблоны развертывания

## Troubleshooting

### Проблема: Контейнеры не запускаются
**Решение:** Проверьте логи:
```bash
docker-compose -f docker-compose.vss-demiurge.yml logs
```

### Проблема: База данных не инициализируется
**Решение:** Удалите volume и пересоздайте:
```bash
docker-compose -f docker-compose.vss-demiurge.yml down -v
docker-compose -f docker-compose.vss-demiurge.yml up -d postgres
```

### Проблема: Health-check не проходит
**Решение:** Проверьте, что все сервисы запущены:
```bash
docker ps
bash scripts/health.sh
```

## Дополнительная информация

Подробная документация доступна в:
- `README-VSS-DEMIURGE.md` - общая архитектура
- `QUICKSTART.md` - быстрый старт

