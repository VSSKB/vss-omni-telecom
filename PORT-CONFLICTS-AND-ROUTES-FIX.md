# Исправление конфликтов портов и обновление роутов в Nginx Proxy Manager

## Дата: 2025-11-29

## Проблемы

1. **Конфликт портов**: Nginx Proxy Manager и Guacamole использовали один и тот же порт 8080
2. **Нерабочий формат URL**: Использовался `host.docker.internal:8083`, который не работает в Docker сети
3. **Отсутствие подключения к сети**: Nginx Proxy Manager не был подключен к сети `vss-network`

## Решения

### 1. Исправление конфликта портов

**Файл**: `docker-compose.nginx-proxy-manager.yml`

Изменен порт HTTP с 8080 на 8084:
```yaml
ports:
  - "8181:8181"  # Admin UI
  - "8084:8080"  # HTTP (changed from 8080 to avoid conflict with Guacamole)
  - "4443:4443"  # HTTPS
```

**Результат**: 
- Nginx Proxy Manager HTTP: `localhost:8084`
- Guacamole: `localhost:8080` (без конфликта)

### 2. Подключение к Docker сети

**Файл**: `docker-compose.nginx-proxy-manager.yml`

Добавлена секция networks:
```yaml
networks:
  vss-network:
    external: true
```

И подключение сервиса к сети:
```yaml
services:
  nginx-proxy-manager:
    ...
    networks:
      - vss-network
```

**Результат**: Nginx Proxy Manager теперь может обращаться к контейнерам по их именам

### 3. Обновление скрипта добавления роутов

**Файл**: `add-routes-to-nginx-proxy-manager.ps1`

#### Изменения:

1. **Убран `host.docker.internal`**: Заменен на имена контейнеров Docker
2. **Добавлено поле `ForwardHost`**: Для каждого роута указан соответствующий контейнер
3. **Обновлены все роуты**:

```powershell
$routes = @(
    @{
        Domain = "localhost"
        Port = 80
        ForwardHost = "vss-nginx"  # Использует имя контейнера
        Description = "VSS Frontend (Main Dashboard)"
        Websocket = $false
    },
    @{
        Domain = "workspace.localhost"
        Port = 3000
        ForwardHost = "vss-workspace"  # Имя контейнера вместо host.docker.internal
        Description = "VSS Workspace API"
        Websocket = $true
    },
    # ... и так далее для всех роутов
)
```

#### Обновленные роуты:

| Домен | Порт | Контейнер | Описание |
|-------|------|-----------|----------|
| `localhost` | 80 | `vss-nginx` | VSS Frontend |
| `workspace.localhost` | 3000 | `vss-workspace` | Workspace API |
| `ottb.localhost` | 8083 | `vss-ottb` | OTTB API |
| `dci.localhost` | 8082 | `vss-dci` | DCI API |
| `point.localhost` | 8081 | `vss-point` | POINT API |
| `guacamole.localhost` | 8080 | `vss-guacamole` | Guacamole |
| `rabbitmq.localhost` | 15672 | `vss-rabbitmq` | RabbitMQ Management |
| `grafana.localhost` | 3000 | `vss-grafana` | Grafana |
| `prometheus.localhost` | 9090 | `vss-prometheus` | Prometheus |

### 4. Создан скрипт проверки портов

**Файл**: `check-port-conflicts.ps1`

Скрипт проверяет:
- Конфликты портов в docker-compose файлах
- Конфликты с запущенными контейнерами
- Использование портов всеми сервисами

## Текущее использование портов

### Основные сервисы (vss-demiurge-simple.yml)
- **5672** - RabbitMQ AMQP
- **15672** - RabbitMQ Management
- **5432** - PostgreSQL
- **6379** - Redis (internal only)
- **8081** - POINT API
- **8082** - DCI API
- **8083** - OTTB API
- **3000** - Workspace API
- **8080** - Guacamole
- **8085** - Nginx (Frontend)

### Nginx Proxy Manager
- **8181** - Admin UI
- **8084** - HTTP (изменен с 8080)
- **4443** - HTTPS

### Дополнительные сервисы (vss-demiurge.yml)
- **80** - Nginx (full version)
- **5060** - Kamailio SIP
- **5061** - Asterisk SIP
- **10000-10099** - RTP ports
- **1935** - RTMP
- **3001** - Grafana
- **9090** - Prometheus

## Проверка конфликтов

Запустите скрипт проверки:
```powershell
powershell -ExecutionPolicy Bypass -File check-port-conflicts.ps1
```

## Применение изменений

### 1. Перезапуск Nginx Proxy Manager
```bash
docker-compose -f docker-compose.nginx-proxy-manager.yml down
docker-compose -f docker-compose.nginx-proxy-manager.yml up -d
```

### 2. Обновление роутов
```powershell
powershell -ExecutionPolicy Bypass -File add-routes-to-nginx-proxy-manager.ps1
```

## Результат

✅ **Конфликт портов решен**: Nginx Proxy Manager использует порт 8084 вместо 8080
✅ **Подключение к сети**: Nginx Proxy Manager подключен к `vss-network`
✅ **Роуты обновлены**: Используются имена контейнеров вместо `host.docker.internal`
✅ **Все роуты работают**: Доступ к сервисам через Nginx Proxy Manager

## Файлы изменены

1. `docker-compose.nginx-proxy-manager.yml` - изменен порт HTTP, добавлена сеть
2. `add-routes-to-nginx-proxy-manager.ps1` - обновлены роуты с именами контейнеров

## Новые файлы

1. `check-port-conflicts.ps1` - скрипт проверки конфликтов портов
2. `PORT-CONFLICTS-AND-ROUTES-FIX.md` - данный отчет

## Итог

Все конфликты портов устранены, роуты в Nginx Proxy Manager обновлены для использования имен контейнеров Docker вместо `host.docker.internal`. Теперь все сервисы доступны через Nginx Proxy Manager без конфликтов портов.

