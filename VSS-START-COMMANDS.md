# VSS OMNI TELECOM - ВСЕ КОМАНДЫ ЗАПУСКА

**Дата:** 2025-12-03  
**Версия:** 1.0.0  
**Платформа:** Windows / Linux

---

## 🚀 КОМАНДЫ ЗАПУСКА ЧЕРЕЗ DOCKER COMPOSE

### 1️⃣ Production Stack (Рекомендуется)

```bash
# Запуск всего стека
docker-compose -f docker-compose.production.yml up -d

# Запуск с пересборкой
docker-compose -f docker-compose.production.yml up -d --build

# Просмотр логов
docker-compose -f docker-compose.production.yml logs -f

# Проверка статуса
docker-compose -f docker-compose.production.yml ps

# Остановка
docker-compose -f docker-compose.production.yml down

# Полная остановка с удалением volumes
docker-compose -f docker-compose.production.yml down -v
```

---

### 2️⃣ Simple Stack (Упрощенная версия)

```bash
# Запуск
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d

# С пересборкой
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d --build

# Логи
docker-compose -f docker-compose.vss-demiurge-simple.yml logs -f

# Остановка
docker-compose -f docker-compose.vss-demiurge-simple.yml down
```

---

### 3️⃣ Default Stack

```bash
# Запуск
docker-compose up -d

# С пересборкой
docker-compose up -d --build

# Логи
docker-compose logs -f

# Остановка
docker-compose down
```

---

### 4️⃣ Nginx Proxy Manager

```bash
# Запуск
docker-compose -f docker-compose.nginx-proxy-manager.yml up -d

# Остановка
docker-compose -f docker-compose.nginx-proxy-manager.yml down
```

---

## 🖥️ КОМАНДЫ ЗАПУСКА ЧЕРЕЗ POWERSHELL СКРИПТЫ

### 1️⃣ Основной скрипт запуска VSS

```powershell
# Запуск всего стека VSS
.\start-vss.ps1
```

---

### 2️⃣ Запуск Stack

```powershell
# Запуск через start-stack.ps1
.\start-stack.ps1
```

---

### 3️⃣ Docs Portal

```powershell
# Запуск портала документации
.\start-docs-portal.ps1
```

---

### 4️⃣ Nginx Proxy Manager

```powershell
# Запуск Nginx Proxy Manager
.\start-nginx-proxy-manager.ps1
```

---

## 📦 КОМАНДЫ ЗАПУСКА ЧЕРЕЗ NPM

### 1️⃣ Запуск всех сервисов одновременно

```bash
# Запуск всех сервисов (Install Wizard, Demiurge, Admin, OTTB, DCI, POINT, WORKSPACE)
npm run start:all
```

**Включает:**
- Install Wizard (server.js)
- VSS Demiurge (back.js)
- Admin Backend
- OTTB Service
- DCI Service
- POINT Service
- WORKSPACE Service

---

### 2️⃣ Запуск только микросервисов

```bash
# Запуск 4 основных микросервисов (OTTB, DCI, POINT, WORKSPACE)
npm run start:services
```

---

### 3️⃣ Запуск отдельных сервисов

```bash
# Install Wizard
npm run start:install-wizard

# VSS Demiurge Backend
npm run start:vss-demiurge

# Admin Backend
npm run start:admin-backend

# OTTB (Trunk & Slot Management)
npm run start:ottb

# DCI (Data & CI/CD)
npm run start:dci

# POINT (Auth & RBAC)
npm run start:point

# WORKSPACE (UI & WebSocket)
npm run start:workspace
```

---

### 4️⃣ Тестирование и аудит

```bash
# Запуск аудита
npm run audit

# Запуск аудита и старт
npm run audit:start

# Тесты
npm test
```

---

## 🔧 КОМАНДЫ ЗАПУСКА ЧЕРЕЗ ПРЯМОЙ NODE

### Запуск отдельных сервисов напрямую:

```bash
# Install Wizard
node server.js

# VSS Demiurge Backend
node back.js

# Admin Backend
node admin-backend/server.js

# OTTB Service
node services/ottb/index.js

# DCI Service
node services/dci/index.js

# POINT Service
node services/point/index.js

# WORKSPACE Service
node services/workspace/index.js

# Docs Portal
node start-portal.js
```

---

## 🛠️ ВСПОМОГАТЕЛЬНЫЕ СКРИПТЫ

### Проверки и тесты:

```powershell
# Проверка конфликтов портов
.\check-port-conflicts.ps1

# Проверка прямых сервисов
.\check-direct-services.ps1

# Проверка npm API
.\check-npm-api.ps1

# Проверка маршрутов
.\check-routes.ps1

# Тестирование RabbitMQ
.\test-rabbitmq.ps1
.\test-rabbitmq-simple.ps1
.\test-rabbitmq-final.ps1

# Проверка путей сервисов
.\test-service-paths.ps1

# Проверка поддоменов
.\test-subdomains.ps1
```

---

### Исправления и настройка:

```powershell
# Исправление Docker
.\fix-docker.ps1

# Исправление PostgreSQL
.\fix-postgres-database.ps1

# Исправление Redis
.\fix-redis-security.ps1

# Отключение IIS
.\disable-iis-completely.ps1

# Добавление записей в hosts
.\add-hosts-entries.ps1

# Проверка RabbitMQ конфигурации
.\verify-rabbitmq-config.ps1
.\verify-rabbitmq-new-config.ps1

# Проверка маршрутов
.\verify-routes-final.ps1
```

---

## 🐳 КОМАНДЫ УПРАВЛЕНИЯ DOCKER КОНТЕЙНЕРАМИ

### Общие команды:

```bash
# Просмотр всех контейнеров
docker ps -a

# Просмотр логов конкретного контейнера
docker logs -f vss-workspace
docker logs -f vss-ottb
docker logs -f vss-dci
docker logs -f vss-point
docker logs -f vss-postgres
docker logs -f vss-rabbitmq
docker logs -f vss-redis

# Перезапуск контейнера
docker restart vss-workspace

# Остановка контейнера
docker stop vss-workspace

# Запуск контейнера
docker start vss-workspace

# Вход в контейнер
docker exec -it vss-workspace sh
docker exec -it vss-postgres psql -U vss -d vss_db
docker exec -it vss-rabbitmq rabbitmq-diagnostics ping
docker exec -it vss-redis redis-cli
```

---

### Команды для конкретных сервисов:

```bash
# PostgreSQL
docker exec -it vss-postgres psql -U vss -d vss_db

# RabbitMQ
docker exec -it vss-rabbitmq rabbitmqctl status
docker exec -it vss-rabbitmq rabbitmqctl list_queues

# Redis
docker exec -it vss-redis redis-cli
docker exec -it vss-redis redis-cli -a YOUR_PASSWORD ping

# Kamailio
docker exec -it vss-kamailio kamctl ul show

# Asterisk
docker exec -it vss-asterisk asterisk -rx "core show version"
docker exec -it vss-asterisk asterisk -rx "pjsip show endpoints"
```

---

## 🔥 БЫСТРЫЕ КОМАНДЫ ЗАПУСКА

### Вариант 1: Docker Compose (Рекомендуется)

```powershell
# PowerShell - Полный запуск
docker-compose -f docker-compose.production.yml up -d --build

# Проверка статуса
docker-compose -f docker-compose.production.yml ps

# Логи всех сервисов
docker-compose -f docker-compose.production.yml logs -f
```

---

### Вариант 2: PowerShell скрипт

```powershell
# Запуск через скрипт
.\start-vss.ps1

# Или
.\start-stack.ps1
```

---

### Вариант 3: NPM скрипты

```bash
# Установка зависимостей (первый раз)
npm install

# Запуск всех сервисов
npm run start:all

# Или только микросервисы
npm run start:services
```

---

## 🎯 РЕКОМЕНДУЕМАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАПУСКА

### Первый запуск (с нуля):

```bash
# 1. Установить зависимости
npm install

# 2. Создать .env файл
Copy-Item .env.example .env

# 3. Отредактировать .env (изменить пароли!)
notepad .env

# 4. Запустить через Docker Compose
docker-compose -f docker-compose.production.yml up -d --build

# 5. Дождаться инициализации (2-3 минуты)
Start-Sleep -Seconds 120

# 6. Проверить статус
docker-compose -f docker-compose.production.yml ps

# 7. Проверить здоровье сервисов
curl http://localhost:3000/health
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
```

---

### Последующие запуски:

```bash
# Просто запустить
docker-compose -f docker-compose.production.yml up -d

# Или через скрипт
.\start-vss.ps1
```

---

## 🔄 КОМАНДЫ ПЕРЕЗАПУСКА

### Перезапуск всего стека:

```bash
# Остановка и запуск
docker-compose -f docker-compose.production.yml restart

# Или по отдельности
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

---

### Перезапуск отдельных сервисов:

```bash
# Через Docker Compose
docker-compose -f docker-compose.production.yml restart vss-workspace
docker-compose -f docker-compose.production.yml restart vss-ottb
docker-compose -f docker-compose.production.yml restart vss-dci
docker-compose -f docker-compose.production.yml restart vss-point

# Напрямую через Docker
docker restart vss-workspace
docker restart vss-ottb
docker restart vss-dci
docker restart vss-point
```

---

## 🛑 КОМАНДЫ ОСТАНОВКИ

### Остановка всего стека:

```bash
# Остановка контейнеров (volumes сохраняются)
docker-compose -f docker-compose.production.yml down

# Остановка с удалением volumes (ОСТОРОЖНО! Удалит все данные)
docker-compose -f docker-compose.production.yml down -v

# Остановка и удаление образов
docker-compose -f docker-compose.production.yml down --rmi all
```

---

### Остановка отдельных сервисов:

```bash
# Через Docker Compose
docker-compose -f docker-compose.production.yml stop vss-workspace

# Напрямую через Docker
docker stop vss-workspace
docker stop vss-ottb
docker stop vss-dci
docker stop vss-point
```

---

## 📊 КОМАНДЫ МОНИТОРИНГА

### Проверка статуса:

```bash
# Docker Compose
docker-compose -f docker-compose.production.yml ps

# Docker
docker ps

# Healthchecks
curl http://localhost:3000/health
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health

# RabbitMQ
curl http://localhost:15672

# Grafana
curl http://localhost:3001
```

---

### Просмотр логов:

```bash
# Все сервисы
docker-compose -f docker-compose.production.yml logs -f

# Конкретный сервис
docker-compose -f docker-compose.production.yml logs -f vss-workspace
docker-compose -f docker-compose.production.yml logs -f vss-ottb

# Последние 100 строк
docker-compose -f docker-compose.production.yml logs --tail=100 vss-workspace

# Только ошибки
docker-compose -f docker-compose.production.yml logs | grep ERROR
```

---

## 🔍 КОМАНДЫ ДИАГНОСТИКИ

### Проверка подключений:

```bash
# PostgreSQL
docker exec vss-postgres psql -U vss -d vss_db -c "SELECT 1"

# RabbitMQ
docker exec vss-rabbitmq rabbitmq-diagnostics ping

# Redis
docker exec vss-redis redis-cli ping

# Kamailio
docker exec vss-kamailio kamctl ul show

# Asterisk
docker exec vss-asterisk asterisk -rx "core show version"
```

---

### Проверка портов:

```powershell
# PowerShell
Get-NetTCPConnection -LocalPort 3000,5432,5672,6379,8081,8082,8083

# CMD
netstat -ano | findstr "3000 5432 5672 6379 8081 8082 8083"
```

---

## 🏗️ КОМАНДЫ СБОРКИ

### Сборка Docker образов:

```bash
# Сборка всех образов
docker-compose -f docker-compose.production.yml build

# Сборка без кэша
docker-compose -f docker-compose.production.yml build --no-cache

# Сборка конкретного сервиса
docker-compose -f docker-compose.production.yml build vss-workspace
docker-compose -f docker-compose.production.yml build vss-ottb
```

---

### Сборка отдельных сервисов:

```bash
# OTTB
docker build -t vss-ottb:latest -f services/ottb/Dockerfile .

# DCI
docker build -t vss-dci:latest -f services/dci/Dockerfile .

# POINT
docker build -t vss-point:latest -f services/point/Dockerfile .

# WORKSPACE
docker build -t vss-workspace:latest -f services/workspace/Dockerfile .
```

---

## 🔄 КОМАНДЫ ОБНОВЛЕНИЯ

### Обновление образов:

```bash
# Обновить все образы
docker-compose -f docker-compose.production.yml pull

# Пересобрать и перезапустить
docker-compose -f docker-compose.production.yml up -d --build

# Удалить старые образы
docker image prune -a
```

---

## 💾 КОМАНДЫ РЕЗЕРВНОГО КОПИРОВАНИЯ

### PostgreSQL:

```bash
# Создать бэкап
docker exec vss-postgres pg_dump -U vss vss_db > backup_$(date +%Y%m%d).sql

# Восстановить из бэкапа
docker exec -i vss-postgres psql -U vss -d vss_db < backup_20251203.sql
```

---

### Volumes:

```bash
# Создать бэкап volumes
docker run --rm -v vss_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data

# Восстановить volumes
docker run --rm -v vss_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /
```

---

## ⚡ БЫСТРЫЕ КОМАНДЫ (ШПАРГАЛКА)

```bash
# ЗАПУСК
docker-compose -f docker-compose.production.yml up -d

# СТАТУС
docker-compose -f docker-compose.production.yml ps

# ЛОГИ
docker-compose -f docker-compose.production.yml logs -f

# ОСТАНОВКА
docker-compose -f docker-compose.production.yml down

# ПЕРЕЗАПУСК
docker-compose -f docker-compose.production.yml restart

# ПЕРЕСБОРКА
docker-compose -f docker-compose.production.yml up -d --build

# ПРОВЕРКА ЗДОРОВЬЯ
curl http://localhost:3000/health && echo " - WORKSPACE OK"
curl http://localhost:8081/health && echo " - POINT OK"
curl http://localhost:8082/health && echo " - DCI OK"
curl http://localhost:8083/health && echo " - OTTB OK"
```

---

## 🎯 РЕКОМЕНДУЕМАЯ КОМАНДА ЗАПУСКА

### Для первого запуска:

```powershell
# PowerShell (Windows)
docker-compose -f docker-compose.production.yml up -d --build
```

```bash
# Bash (Linux)
docker-compose -f docker-compose.production.yml up -d --build
```

---

### Для обычного запуска:

```bash
# Быстрый запуск
docker-compose -f docker-compose.production.yml up -d
```

---

### Для разработки:

```bash
# Запуск через NPM (без Docker)
npm run start:services
```

---

## 📋 ПОЛНЫЙ ЦИКЛ ЗАПУСКА

### Пошаговая инструкция:

```powershell
# 1. Перейти в директорию проекта
cd C:\Users\Administrator\Documents\vss-omni-telecom

# 2. Создать .env из примера (если еще не создан)
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# 3. Остановить старые контейнеры (если есть)
docker-compose -f docker-compose.production.yml down

# 4. Удалить старые volumes (ОПЦИОНАЛЬНО, удалит данные!)
# docker-compose -f docker-compose.production.yml down -v

# 5. Запустить с пересборкой
docker-compose -f docker-compose.production.yml up -d --build

# 6. Дождаться инициализации
Start-Sleep -Seconds 60

# 7. Проверить статус
docker-compose -f docker-compose.production.yml ps

# 8. Проверить логи
docker-compose -f docker-compose.production.yml logs --tail=50

# 9. Проверить healthchecks
curl http://localhost:3000/health
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health

# 10. Открыть UI
Start-Process "http://localhost:3000"
Start-Process "http://localhost:15672"
Start-Process "http://localhost:3001"
```

---

## 🎨 КРАСИВЫЙ ЗАПУСК (Скрипт)

Создайте файл `quick-start.ps1`:

```powershell
Write-Host "🚀 VSS OMNI TELECOM - БЫСТРЫЙ ЗАПУСК" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Проверка Docker..." -ForegroundColor Yellow
docker ps > $null 2>&1
if ($?) {
    Write-Host "   ✅ Docker работает" -ForegroundColor Green
} else {
    Write-Host "   ❌ Docker не запущен!" -ForegroundColor Red
    exit
}

Write-Host "2. Запуск контейнеров..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml up -d

Write-Host "3. Ожидание инициализации..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "4. Проверка статуса..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml ps

Write-Host "`n✅ VSS OMNI TELECOM запущен!" -ForegroundColor Green
Write-Host "`n🔗 Доступные ссылки:" -ForegroundColor Cyan
Write-Host "   http://localhost:3000      - WORKSPACE" -ForegroundColor White
Write-Host "   http://localhost:15672     - RabbitMQ" -ForegroundColor White
Write-Host "   http://localhost:3001      - Grafana" -ForegroundColor White
Write-Host "   http://localhost:8080      - Guacamole" -ForegroundColor White
```

---

## 📄 СВОДНАЯ ТАБЛИЦА КОМАНД

| Действие | Docker Compose | NPM | PowerShell |
|----------|---------------|-----|------------|
| **Запуск всего** | `docker-compose -f docker-compose.production.yml up -d` | `npm run start:all` | `.\start-vss.ps1` |
| **Только сервисы** | - | `npm run start:services` | - |
| **Статус** | `docker-compose ps` | - | `docker ps` |
| **Логи** | `docker-compose logs -f` | - | `docker logs -f [name]` |
| **Остановка** | `docker-compose down` | - | `docker stop [name]` |
| **Перезапуск** | `docker-compose restart` | - | `docker restart [name]` |

---

**✅ Все команды готовы к использованию!**  
**🚀 Рекомендуемая команда:**  
```bash
docker-compose -f docker-compose.production.yml up -d --build
```

