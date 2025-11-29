# 🚀 Быстрый старт VSS DEMIURGE из PowerShell

## 📦 Что было создано

Создан удобный PowerShell скрипт **`vss-manager.ps1`** для управления всей инфраструктурой VSS.

---

## ⚡ БЫСТРЫЙ СТАРТ

### 1. Открыть PowerShell в директории проекта

```powershell
cd C:\Users\Administrator\Documents\vss-omni-telecom
```

### 2. Запустить инфраструктуру

```powershell
# Первый запуск (с пересборкой образов)
.\vss-manager.ps1 start -Build

# Обычный запуск
.\vss-manager.ps1 start
```

### 3. Проверить статус

```powershell
.\vss-manager.ps1 status
```

### 4. Смотреть логи

```powershell
# Все логи в реальном времени
.\vss-manager.ps1 logs -Follow

# Логи конкретного сервиса
.\vss-manager.ps1 logs vss-workspace -Follow
```

---

## 🎯 ВСЕ КОМАНДЫ

### Основные команды

```powershell
# Запуск
.\vss-manager.ps1 start              # Запустить все сервисы
.\vss-manager.ps1 start -Build       # Запустить с пересборкой

# Остановка
.\vss-manager.ps1 stop               # Остановить все

# Перезапуск
.\vss-manager.ps1 restart            # Перезапустить все
.\vss-manager.ps1 restart vss-ottb   # Перезапустить один сервис

# Статус
.\vss-manager.ps1 status             # Показать статус всех сервисов

# Логи
.\vss-manager.ps1 logs               # Последние 50 строк
.\vss-manager.ps1 logs -Follow       # Следить в реальном времени
.\vss-manager.ps1 logs -Tail 100     # Последние 100 строк
.\vss-manager.ps1 logs vss-workspace # Логи одного сервиса

# Пересборка
.\vss-manager.ps1 rebuild            # Пересобрать образы с нуля

# Очистка
.\vss-manager.ps1 clean              # Полная очистка (⚠️ потеря данных!)

# Справка
.\vss-manager.ps1 help               # Показать справку
```

---

## 🎛️ ДОСТУПНЫЕ СЕРВИСЫ

| Имя сервиса | Описание | Порт |
|-------------|----------|------|
| `vss-workspace` | UI Backend & CRM | 3000 |
| `vss-ottb` | Telecom Core | 8083 |
| `vss-dci` | Data & CI/CD | 8082 |
| `vss-point` | Auth & RBAC | 8081 |
| `vss-guacamole` | Remote Access | 8080 |
| `guacd` | Guacamole Daemon | 4822 |
| `rabbitmq` | Message Bus | 5672, 15672 |
| `postgres` | Database | 5432 |
| `redis` | Cache | 6379 |

---

## 🌐 ДОСТУП К СЕРВИСАМ

После запуска сервисы будут доступны по адресам:

```
🌐 VSS Workspace:      http://localhost:3000
🐰 RabbitMQ Management: http://localhost:15672
🖥️  Guacamole:         http://localhost:8080/guacamole
🔐 VSS Point API:      http://localhost:8081
💾 VSS DCI API:        http://localhost:8082
📞 VSS OTTB API:       http://localhost:8083
```

### Учетные данные по умолчанию

**RabbitMQ:**
- Логин: `vss-admin`
- Пароль: `vss_rabbit_pass`

**PostgreSQL:**
- Host: `localhost:5432`
- Database: `vss_db`
- User: `vss`
- Password: `vss_postgres_pass`

**Guacamole:**
- Логин: `guacadmin`
- Пароль: `guacadmin` (изменить после первого входа!)

---

## 📋 ТИПИЧНЫЕ СЦЕНАРИИ

### Первый запуск проекта

```powershell
# 1. Перейти в директорию
cd C:\Users\Administrator\Documents\vss-omni-telecom

# 2. Запустить с пересборкой
.\vss-manager.ps1 start -Build

# 3. Подождать 1-2 минуты для инициализации

# 4. Проверить статус
.\vss-manager.ps1 status

# 5. Открыть в браузере
start http://localhost:15672  # RabbitMQ
start http://localhost:3000   # Workspace
```

### Повседневная работа

```powershell
# Утро: запустить инфраструктуру
.\vss-manager.ps1 start

# Проверить что всё работает
.\vss-manager.ps1 status

# Работа...

# Вечер: остановить
.\vss-manager.ps1 stop
```

### Отладка проблем

```powershell
# Смотреть логи всех сервисов
.\vss-manager.ps1 logs -Follow

# Логи конкретного проблемного сервиса
.\vss-manager.ps1 logs vss-workspace -Follow -Tail 100

# Перезапустить проблемный сервис
.\vss-manager.ps1 restart vss-workspace

# Проверить статус
.\vss-manager.ps1 status
```

### После изменения кода

```powershell
# Пересобрать образы и запустить
.\vss-manager.ps1 rebuild
.\vss-manager.ps1 start

# Или в одну команду
.\vss-manager.ps1 stop
.\vss-manager.ps1 start -Build
```

### Полная переустановка

```powershell
# Полная очистка (⚠️ удаляет все данные!)
.\vss-manager.ps1 clean

# Запуск с нуля
.\vss-manager.ps1 start -Build
```

---

## 🔍 МОНИТОРИНГ

### Проверка статуса в реальном времени

```powershell
# В одном окне PowerShell - следить за логами
.\vss-manager.ps1 logs -Follow

# В другом окне - периодически проверять статус
while ($true) { Clear-Host; .\vss-manager.ps1 status; Start-Sleep 5 }
```

### Проверка конкретного сервиса

```powershell
# Статус контейнера
docker ps --filter "name=vss-workspace"

# Логи
docker logs vss-workspace --tail 50 -f

# Выполнить команду внутри контейнера
docker exec -it vss-workspace sh

# Проверить health check
docker inspect vss-postgres --format='{{.State.Health.Status}}'
```

---

## 🐛 TROUBLESHOOTING

### Проблема: Сервисы постоянно перезапускаются

```powershell
# Проверить логи
.\vss-manager.ps1 logs vss-workspace -Tail 100

# Проверить зависимости (RabbitMQ, PostgreSQL)
.\vss-manager.ps1 status

# Дать больше времени на запуск
Start-Sleep 120
.\vss-manager.ps1 status
```

### Проблема: Порт уже занят

```powershell
# Найти процесс на порту 3000
netstat -ano | findstr :3000

# Убить процесс (замените PID на ID процесса)
taskkill /PID <PID> /F

# Перезапустить
.\vss-manager.ps1 restart
```

### Проблема: Docker не отвечает

```powershell
# Перезапустить Docker Desktop
Restart-Service docker

# Или через GUI: Docker Desktop -> Restart
```

### Проблема: Нужно сбросить всё к исходному состоянию

```powershell
# Полная очистка
.\vss-manager.ps1 clean

# Удалить старые образы
docker system prune -af

# Запуск с нуля
.\vss-manager.ps1 start -Build
```

---

## 📊 РАСШИРЕННЫЕ КОМАНДЫ

### Docker Compose напрямую

```powershell
# Если нужен прямой доступ к docker compose
$compose = "docker-compose.vss-demiurge-simple.yml"

# Статус
docker compose -f $compose ps

# Логи
docker compose -f $compose logs -f

# Перезапуск
docker compose -f $compose restart vss-workspace

# Выполнить команду в сервисе
docker compose -f $compose exec vss-workspace sh
```

### Полезные Docker команды

```powershell
# Все VSS контейнеры
docker ps -a --filter "name=vss-"

# Использование ресурсов
docker stats

# Очистка неиспользуемых ресурсов
docker system prune -a

# Volumes
docker volume ls
docker volume inspect vss-omni-telecom_postgres_data

# Networks
docker network ls
docker network inspect vss-omni-telecom_vss-network
```

---

## 🎓 ПОЛЕЗНЫЕ ALIAS'ы

Добавьте в ваш PowerShell профиль (`$PROFILE`):

```powershell
# Открыть профиль
notepad $PROFILE

# Добавить:
function vss { Set-Location "C:\Users\Administrator\Documents\vss-omni-telecom" }
function vss-start { vss; .\vss-manager.ps1 start }
function vss-stop { vss; .\vss-manager.ps1 stop }
function vss-status { vss; .\vss-manager.ps1 status }
function vss-logs { vss; .\vss-manager.ps1 logs -Follow }
function vss-restart { vss; .\vss-manager.ps1 restart }

# Теперь можно использовать:
vss-start
vss-status
vss-logs
```

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

1. **Запустить инфраструктуру:**
   ```powershell
   .\vss-manager.ps1 start -Build
   ```

2. **Подождать готовности (1-2 минуты)**

3. **Открыть веб-интерфейсы:**
   - RabbitMQ: http://localhost:15672
   - Workspace: http://localhost:3000
   - Guacamole: http://localhost:8080/guacamole

4. **Изучить документацию:**
   - `VSS-INFRASTRUCTURE-TOUR.md` - Полная экскурсия
   - `docs/ARCHITECTURE.md` - Архитектура
   - `docs/API-REFERENCE.md` - API

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

- **Архитектура:** `VSS-INFRASTRUCTURE-TOUR.md`
- **Статус и troubleshooting:** `VSS-STATUS-REPORT.md`
- **API документация:** `docs/API-REFERENCE.md`
- **Инструкции по запуску:** `START-VSS.md`

---

**🎉 Готово! Используйте `.\vss-manager.ps1 help` для справки**

*Создано: 28 ноября 2025*

