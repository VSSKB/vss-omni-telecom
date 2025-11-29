# 🚀 VSS DEMIURGE - Руководство по запуску

## ✅ Текущий статус

### Успешно запущены:
- ✅ **vss-rabbitmq** - Message Bus (порты: 5672, 15672)
- ✅ **vss-postgres** - База данных (порт: 5432)
- ✅ **vss-redis** - Кэш и сессии (порт: 6379)
- ✅ **vss-guacd** - Guacamole daemon

### В процессе запуска:
- 🔄 **vss-workspace** - Перезапускается
- 🔄 **vss-ottb** - Перезапускается
- 🔄 **vss-dci** - Перезапускается
- 🔄 **vss-point** - Перезапускается
- 🔄 **vss-guacamole** - Перезапускается

---

## ⚠️ Проблема с Asterisk

При запуске полной версии (`docker-compose.vss-demiurge.yml`) возникает ошибка:

```
Error: user declined directory sharing C:\Users\Administrator\Documents\vss-omni-telecom\config\sip\asterisk\modules.conf
```

**Причина:** Docker Desktop на Windows требует разрешения на доступ к директориям для монтирования volumes.

**Решение:** Используйте упрощенную версию без Asterisk/Kamailio:

```powershell
docker compose -f docker-compose.vss-demiurge-simple.yml up -d
```

---

## 🔧 Диагностика проблем

### Проверка логов сервисов:

```powershell
# Логи всех сервисов
docker compose -f docker-compose.vss-demiurge-simple.yml logs -f

# Логи конкретного сервиса
docker logs vss-workspace --tail 50
docker logs vss-ottb --tail 50
docker logs vss-dci --tail 50
docker logs vss-point --tail 50
```

### Проверка статуса:

```powershell
# Статус всех контейнеров
docker compose -f docker-compose.vss-demiurge-simple.yml ps

# Детальная информация
docker ps -a --filter "name=vss"
```

### Проверка health checks:

```powershell
# Проверка работоспособности сервисов
curl http://localhost:3000/health
curl http://localhost:8083/health
curl http://localhost:8082/health
curl http://localhost:8081/health
```

---

## 🛠️ Решение проблем

### 1. Сервисы постоянно перезапускаются

**Причина:** Ошибки при подключении к зависимостям (PostgreSQL, RabbitMQ, Redis)

**Решение:**
```powershell
# Проверьте, что базовые сервисы запущены
docker ps --filter "name=vss-rabbitmq"
docker ps --filter "name=vss-postgres"
docker ps --filter "name=vss-redis"

# Перезапустите сервисы после того, как базовые сервисы будут готовы
docker compose -f docker-compose.vss-demiurge-simple.yml restart vss-workspace vss-ottb vss-dci vss-point
```

### 2. Проблемы с подключением к PostgreSQL

**Проверка:**
```powershell
docker exec -it vss-postgres psql -U vss -d vss_db -c "SELECT 1;"
```

**Если не работает:**
```powershell
# Перезапустите PostgreSQL
docker restart vss-postgres

# Подождите 10 секунд и проверьте снова
```

### 3. Проблемы с подключением к RabbitMQ

**Проверка:**
```powershell
# Проверьте через браузер
# http://localhost:15672
# Логин: vss-admin
# Пароль: vss_rabbit_pass
```

**Если не работает:**
```powershell
docker restart vss-rabbitmq
```

### 4. Проблемы с Docker Desktop на Windows

Если возникают проблемы с доступом к директориям:

1. Откройте Docker Desktop
2. Перейдите в Settings → Resources → File Sharing
3. Добавьте `C:\Users\Administrator\Documents\vss-omni-telecom`
4. Нажмите "Apply & Restart"

---

## 📋 Правильная последовательность запуска

### Шаг 1: Остановите все контейнеры

```powershell
docker compose -f docker-compose.vss-demiurge-simple.yml down
```

### Шаг 2: Запустите базовые сервисы

```powershell
docker compose -f docker-compose.vss-demiurge-simple.yml up -d rabbitmq postgres redis
```

### Шаг 3: Подождите 10-15 секунд

```powershell
# Проверьте статус
docker compose -f docker-compose.vss-demiurge-simple.yml ps
```

### Шаг 4: Запустите остальные сервисы

```powershell
docker compose -f docker-compose.vss-demiurge-simple.yml up -d
```

### Шаг 5: Проверьте логи

```powershell
docker compose -f docker-compose.vss-demiurge-simple.yml logs -f
```

---

## 🌐 Проверка доступности сервисов

После успешного запуска проверьте доступность:

| Сервис | URL | Ожидаемый ответ |
|--------|-----|----------------|
| Workspace | http://localhost:3000/health | `{"status":"healthy"}` |
| OTTB | http://localhost:8083/health | `{"status":"healthy"}` |
| DCI | http://localhost:8082/health | `{"status":"healthy"}` |
| POINT | http://localhost:8081/health | `{"status":"healthy"}` |
| RabbitMQ | http://localhost:15672 | Web UI |
| Guacamole | http://localhost:8080/guacamole | Web UI |

---

## 📚 Дополнительная документация

- [Экскурсия по инфраструктуре](VSS-INFRASTRUCTURE-TOUR.md)
- [Статус системы](VSS-STATUS.md)
- [Архитектура](docs/ARCHITECTURE.md)

---

**Дата обновления:** 2025-01-29

