# 🚀 VSS DEMIURGE - Быстрый старт

## Шаг 1: Подготовка окружения

```bash
# Скопируйте пример конфигурации
cp .env.example .env

# Отредактируйте пароли (ОБЯЗАТЕЛЬНО!)
nano .env  # или используйте любой редактор
```

## Шаг 2: Развертывание

### Linux/Mac:
```bash
chmod +x scripts/deploy-vss-demiurge.sh
./scripts/deploy-vss-demiurge.sh
```

### Windows PowerShell:
```powershell
.\scripts\deploy-vss-demiurge.ps1
```

## Шаг 3: Проверка

После развертывания проверьте доступность сервисов:

- ✅ RabbitMQ Management: http://localhost:15672
- ✅ VSS Workspace: http://localhost:3000
- ✅ Grafana: http://localhost:3001

## Шаг 4: Первый вход

**RabbitMQ:**
- Логин: `vss-admin`
- Пароль: из файла `.env` (RABBITMQ_PASSWORD)

**Grafana:**
- Логин: `admin`
- Пароль: из файла `.env` (GRAFANA_PASSWORD)

**База данных (PostgreSQL):**
- Пользователь: `vss`
- Пароль: из файла `.env` (DB_PASSWORD)
- База: `vss`

## Что дальше?

1. Настройте RabbitMQ очереди и exchanges через Management UI
2. Импортируйте дашборды Grafana из `config/grafana/dashboards/`
3. Настройте ваши транки и слоты через VSS OTTB API
4. Интегрируйте Guacamole для доступа к физическим устройствам

## Проблемы?

Смотрите логи:
```bash
docker-compose -f docker-compose.vss-demiurge.yml logs -f
```

Проверьте статус:
```bash
docker-compose -f docker-compose.vss-demiurge.yml ps
```

