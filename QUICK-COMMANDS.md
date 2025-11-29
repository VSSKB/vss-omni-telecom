# 🚀 VSS DEMIURGE - Быстрые команды PowerShell

## 📋 Основной скрипт управления

```powershell
# Главный скрипт для управления VSS
.\vss-control.ps1 [команда] [сервис]
```

---

## ⚡ ОСНОВНЫЕ КОМАНДЫ

### 🟢 Запуск инфраструктуры

```powershell
# Запустить весь стек
.\vss-control.ps1 start

# Или напрямую через docker compose
docker compose -f docker-compose.vss-demiurge-simple.yml up -d
```

### 🔴 Остановка инфраструктуры

```powershell
# Остановить весь стек
.\vss-control.ps1 stop

# Или напрямую
docker compose -f docker-compose.vss-demiurge-simple.yml down
```

### 🔄 Перезапуск

```powershell
# Перезапустить все
.\vss-control.ps1 restart

# Перезапустить конкретный сервис
.\vss-control.ps1 restart vss-workspace
.\vss-control.ps1 restart vss-ottb
.\vss-control.ps1 restart rabbitmq
```

### 🔨 Пересборка (после изменений кода)

```powershell
# Пересобрать все образы и запустить
.\vss-control.ps1 rebuild

# Или пошагово:
docker compose -f docker-compose.vss-demiurge-simple.yml down
docker compose -f docker-compose.vss-demiurge-simple.yml build --no-cache
docker compose -f docker-compose.vss-demiurge-simple.yml up -d
```

---

## 📊 МОНИТОРИНГ

### Статус сервисов

```powershell
# Красивый статус через скрипт
.\vss-control.ps1 status

# Или стандартный docker compose
docker compose -f docker-compose.vss-demiurge-simple.yml ps

# Только запущенные VSS сервисы
docker ps --filter "name=vss-"
```

### Логи

```powershell
# Все логи (следить в реальном времени)
.\vss-control.ps1 logs

# Логи конкретного сервиса
.\vss-control.ps1 logs vss-workspace
.\vss-control.ps1 logs vss-ottb
.\vss-control.ps1 logs rabbitmq

# Или напрямую через docker
docker compose -f docker-compose.vss-demiurge-simple.yml logs -f
docker logs -f vss-workspace
docker logs -f vss-rabbitmq --tail 100
```

### Проверка здоровья

```powershell
# Проверить health check
docker inspect vss-postgres --format='{{.State.Health.Status}}'
docker inspect vss-redis --format='{{.State.Health.Status}}'
docker inspect vss-rabbitmq --format='{{.State.Health.Status}}'

# Проверить все healthy контейнеры
docker ps --filter "health=healthy"
```

---

## 🌐 ОТКРЫТЬ ВЕБ-ИНТЕРФЕЙСЫ

```powershell
# Интерактивное меню
.\vss-control.ps1 open

# Или напрямую открыть в браузере
start http://localhost:3000          # VSS Workspace
start http://localhost:15672         # RabbitMQ Management
start http://localhost:8080/guacamole # Guacamole
```

---

## 🔧 УПРАВЛЕНИЕ ОТДЕЛЬНЫМИ СЕРВИСАМИ

### Запуск/Остановка конкретного сервиса

```powershell
# Запустить сервис
docker compose -f docker-compose.vss-demiurge-simple.yml start vss-workspace

# Остановить сервис
docker compose -f docker-compose.vss-demiurge-simple.yml stop vss-workspace

# Перезапустить сервис
docker compose -f docker-compose.vss-demiurge-simple.yml restart vss-ottb
```

### Пересоздать конкретный сервис

```powershell
# Остановить, пересобрать, запустить
docker compose -f docker-compose.vss-demiurge-simple.yml up -d --build --force-recreate vss-workspace
```

---

## 🐛 ОТЛАДКА

### Войти в контейнер

```powershell
# Bash в контейнере (если есть)
docker exec -it vss-workspace sh
docker exec -it vss-postgres bash

# Выполнить команду в контейнере
docker exec vss-postgres psql -U vss -d vss_db -c "SELECT * FROM users LIMIT 5;"
docker exec vss-rabbitmq rabbitmqctl list_queues
docker exec vss-redis redis-cli PING
```

### Проверка портов

```powershell
# Проверить, какие порты слушает контейнер
docker port vss-workspace
docker port vss-rabbitmq

# Проверить, занят ли порт в системе
netstat -an | findstr :3000
netstat -an | findstr :5672
```

### Проверка сети

```powershell
# Список Docker сетей
docker network ls

# Инспекция сети VSS
docker network inspect vss-omni-telecom_vss-network

# Проверить IP контейнеров
docker inspect vss-workspace --format='{{.NetworkSettings.Networks.vss_network.IPAddress}}'
```

---

## 🗑️ ОЧИСТКА

### Удалить все VSS контейнеры

```powershell
# Через скрипт (с подтверждением)
.\vss-control.ps1 clean

# Или напрямую
docker compose -f docker-compose.vss-demiurge-simple.yml down -v
```

### Удалить неиспользуемые образы

```powershell
# Удалить dangling images
docker image prune

# Удалить все неиспользуемые образы
docker image prune -a

# Полная очистка Docker (⚠️ ОСТОРОЖНО!)
docker system prune -a --volumes
```

---

## 📦 РАБОТА С VOLUMES

### Список volumes

```powershell
# Все volumes проекта
docker volume ls --filter "label=com.docker.compose.project=vss-omni-telecom"

# Инспекция volume
docker volume inspect vss-omni-telecom_postgres_data
```

### Бэкап данных

```powershell
# Бэкап PostgreSQL
docker exec vss-postgres pg_dump -U vss vss_db > backup_$(Get-Date -Format "yyyy-MM-dd").sql

# Бэкап Redis
docker exec vss-redis redis-cli SAVE
docker cp vss-redis:/data/dump.rdb ./redis_backup_$(Get-Date -Format "yyyy-MM-dd").rdb
```

---

## 🚀 ПОЛЕЗНЫЕ АЛИАСЫ

Добавьте в ваш PowerShell Profile (`$PROFILE`):

```powershell
# VSS алиасы
function vss-start { .\vss-control.ps1 start }
function vss-stop { .\vss-control.ps1 stop }
function vss-restart { param($s) .\vss-control.ps1 restart $s }
function vss-status { .\vss-control.ps1 status }
function vss-logs { param($s) .\vss-control.ps1 logs $s }
function vss-rebuild { .\vss-control.ps1 rebuild }

# Быстрый доступ к логам
function vss-logs-workspace { docker logs -f vss-workspace }
function vss-logs-ottb { docker logs -f vss-ottb }
function vss-logs-rabbitmq { docker logs -f vss-rabbitmq }

# Открыть интерфейсы
function vss-open-workspace { start http://localhost:3000 }
function vss-open-rabbitmq { start http://localhost:15672 }
function vss-open-guacamole { start http://localhost:8080/guacamole }

# Быстрый exec
function vss-exec-workspace { docker exec -it vss-workspace sh }
function vss-exec-postgres { docker exec -it vss-postgres psql -U vss -d vss_db }
function vss-exec-redis { docker exec -it vss-redis redis-cli }
```

Применить алиасы:

```powershell
# Открыть профиль
notepad $PROFILE

# Вставить алиасы выше, сохранить и перезагрузить
. $PROFILE

# Теперь можно использовать короткие команды
vss-start
vss-status
vss-logs workspace
```

---

## 📊 МОНИТОРИНГ В РЕАЛЬНОМ ВРЕМЕНИ

### Следить за ресурсами

```powershell
# Использование CPU/RAM контейнерами
docker stats --filter "name=vss-"

# Топ процессов в контейнере
docker top vss-workspace
```

### Следить за событиями

```powershell
# Все Docker события
docker events --filter "type=container" --filter "label=com.docker.compose.project=vss-omni-telecom"
```

---

## 🔐 БЕЗОПАСНОСТЬ

### Проверить открытые порты

```powershell
# Все открытые порты VSS контейнеров
docker ps --filter "name=vss-" --format "table {{.Names}}\t{{.Ports}}"
```

### Смена паролей

```powershell
# PostgreSQL
docker exec -it vss-postgres psql -U vss -d vss_db -c "ALTER USER vss WITH PASSWORD 'новый_пароль';"

# RabbitMQ
docker exec vss-rabbitmq rabbitmqctl change_password vss-admin новый_пароль
```

---

## 📚 СПРАВКА

```powershell
# Помощь по скрипту
.\vss-control.ps1 help

# Docker compose справка
docker compose --help
docker compose -f docker-compose.vss-demiurge-simple.yml --help
```

---

## 🎯 ТИПИЧНЫЕ СЦЕНАРИИ

### Сценарий 1: Первый запуск

```powershell
# Клонировали проект, запускаем первый раз
cd C:\Users\Administrator\Documents\vss-omni-telecom
.\vss-control.ps1 rebuild
Start-Sleep -Seconds 120  # Ждем 2 минуты
.\vss-control.ps1 status
.\vss-control.ps1 open
```

### Сценарий 2: Изменили код микросервиса

```powershell
# Изменили services/workspace/index.js
.\vss-control.ps1 stop
.\vss-control.ps1 rebuild  # Пересобрать все
# ИЛИ пересобрать только workspace:
docker compose -f docker-compose.vss-demiurge-simple.yml up -d --build vss-workspace
.\vss-control.ps1 logs vss-workspace
```

### Сценарий 3: Проблемы с RabbitMQ

```powershell
# RabbitMQ не становится healthy
docker logs vss-rabbitmq --tail 50
docker restart vss-rabbitmq
Start-Sleep -Seconds 30
docker inspect vss-rabbitmq --format='{{.State.Health.Status}}'
```

### Сценарий 4: Полная переустановка

```powershell
# Удалить все и начать заново
.\vss-control.ps1 clean  # yes для подтверждения
docker system prune -f
.\vss-control.ps1 rebuild
```

---

## 🌟 ПРОДВИНУТЫЕ КОМАНДЫ

### Масштабирование сервисов (если нужно несколько инстансов)

```powershell
# Запустить 3 инстанса workspace (требуется load balancer)
docker compose -f docker-compose.vss-demiurge-simple.yml up -d --scale vss-workspace=3
```

### Обновление образов

```powershell
# Проверить обновления
docker compose -f docker-compose.vss-demiurge-simple.yml pull

# Применить обновления
docker compose -f docker-compose.vss-demiurge-simple.yml up -d
```

### Экспорт/Импорт конфигурации

```powershell
# Экспорт конфигурации
docker compose -f docker-compose.vss-demiurge-simple.yml config > vss-config-backup.yml

# Проверить конфигурацию
docker compose -f docker-compose.vss-demiurge-simple.yml config --resolve-image-digests
```

---

**🎉 Готово! Используйте `.\vss-control.ps1 help` для быстрой справки.**

*Обновлено: 28 ноября 2025*

