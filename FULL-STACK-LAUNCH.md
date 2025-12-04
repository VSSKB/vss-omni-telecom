# 🚀 VSS OMNI TELECOM - Полный запуск стека

## ✅ Текущая конфигурация

### Docker Контейнеры:
- **PostgreSQL** - База данных (port 5432)
- **Redis** - Кэш и очереди (port 6379)
- **RabbitMQ** - Брокер сообщений (ports 5672, 15672)

### Node.js Сервисы:
- **Install Wizard** - Мастер установки (port 3000)
- **VSS Demiurge** - Основная панель (port 8181)
- **Admin Backend** - Панель администратора (port 8095)
- **Workspace** - Рабочее пространство (port 3001)
- **Point API** - API точек доступа (port 8086)
- **DCI API** - API интеграций (port 8084)
- **OTTB API** - API OTTB (port 8085)

### Nginx:
- **Gateway** - Reverse proxy (port 80)

---

## 🚀 Быстрый запуск

### 1️⃣ Запуск Docker контейнеров

```powershell
# PostgreSQL
docker run -d \
  --name vss-postgres \
  -e POSTGRES_USER=vss_admin \
  -e POSTGRES_PASSWORD=vss_secure_pass_2024 \
  -e POSTGRES_DB=vss_db \
  -p 5432:5432 \
  -v vss_postgres_data:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:15-alpine

# Redis
docker run -d \
  --name vss-redis \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7-alpine

# RabbitMQ
docker run -d \
  --name vss-rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=vss-admin \
  -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass \
  --restart unless-stopped \
  rabbitmq:3-management-alpine
```

### 2️⃣ Запуск VSS сервисов

```powershell
npm run start:all
```

### 3️⃣ Запуск Nginx

```batch
nginx-control.bat start
```

---

## 🌐 Доступ к интерфейсам

### Основные URL:

| Интерфейс | URL |
|-----------|-----|
| **Главная страница** | http://79.137.207.215/ |
| **VSS Dashboard** | http://79.137.207.215:3000/vss-dashboard.html |
| **OTTB Dashboard** | http://79.137.207.215:3000/vss-ottb-dashboard.html |
| **VSS Demiurge** | http://79.137.207.215:8181/ |
| **RabbitMQ Management** | http://79.137.207.215:15672/ |

### Через Nginx Gateway (порт 80):

| Сервис | URL через Nginx |
|--------|----------------|
| Install Wizard | http://79.137.207.215/ |
| VSS Demiurge | http://79.137.207.215/demiurge/ |
| Admin Backend | http://79.137.207.215/admin/ |
| Workspace | http://79.137.207.215/workspace/ |

---

## 🔐 Учётные данные

### VSS Интерфейсы:
```
Username: admin
Password: admin123
```

### PostgreSQL:
```
Host: localhost
Port: 5432
Database: vss_db
Username: vss_admin
Password: vss_secure_pass_2024
```

### RabbitMQ:
```
Management UI: http://79.137.207.215:15672/
Username: vss-admin
Password: vss_rabbit_pass
```

### Redis:
```
Host: localhost
Port: 6379
No password
```

---

## 🛠️ Управление

### Проверка статуса всех сервисов:

```powershell
# Docker контейнеры
docker ps

# Nginx
nginx-control.bat status

# Проверка портов
Test-NetConnection -ComputerName localhost -Port 5432  # PostgreSQL
Test-NetConnection -ComputerName localhost -Port 6379  # Redis
Test-NetConnection -ComputerName localhost -Port 5672  # RabbitMQ
Test-NetConnection -ComputerName localhost -Port 3000  # Install Wizard
Test-NetConnection -ComputerName localhost -Port 8181  # VSS Demiurge
```

### Остановка всех сервисов:

```powershell
# Остановить Node.js
taskkill /F /IM node.exe

# Остановить Nginx
nginx-control.bat stop

# Остановить Docker контейнеры
docker stop vss-postgres vss-redis vss-rabbitmq
```

### Полная перезагрузка стека:

```powershell
# 1. Остановить всё
taskkill /F /IM node.exe
nginx-control.bat stop
docker stop vss-postgres vss-redis vss-rabbitmq

# 2. Запустить Docker контейнеры
docker start vss-postgres vss-redis vss-rabbitmq

# Подождать 10 секунд
Start-Sleep -Seconds 10

# 3. Запустить VSS сервисы
npm run start:all

# 4. Запустить Nginx
nginx-control.bat start
```

---

## 📊 Мониторинг

### Логи Docker контейнеров:

```powershell
docker logs vss-postgres -f
docker logs vss-redis -f
docker logs vss-rabbitmq -f
```

### Логи Nginx:

```powershell
Get-Content C:\nginx\logs\access.log -Wait -Tail 20
Get-Content C:\nginx\logs\error.log -Wait -Tail 20
```

### Проверка подключения к PostgreSQL:

```powershell
docker exec -it vss-postgres psql -U vss_admin -d vss_db -c "\dt"
```

---

## 🔧 Решение проблем

### Проблема 1: Сервисы не могут подключиться к PostgreSQL

**Симптомы:**
```
[DB] ❌ Connection failed
[DB] Retries left: X/5
```

**Решение:**
1. Проверьте, что PostgreSQL запущен:
   ```powershell
   docker ps | findstr postgres
   ```

2. Проверьте порт:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 5432
   ```

3. Проверьте логи:
   ```powershell
   docker logs vss-postgres
   ```

4. Перезапустите контейнер:
   ```powershell
   docker restart vss-postgres
   ```

### Проблема 2: Порт уже занят

**Симптомы:**
```
Error: listen EADDRINUSE: address already in use :::5432
```

**Решение:**
```powershell
# Найти процесс на порту
Get-NetTCPConnection -LocalPort 5432 | Select-Object OwningProcess
Get-Process -Id [PID]

# Остановить процесс
Stop-Process -Id [PID] -Force
```

### Проблема 3: Docker не в Linux режиме

**Симптомы:**
```
no matching manifest for windows/amd64
```

**Решение:**
```powershell
# Переключить Docker в Linux режим
& "$env:ProgramFiles\Docker\Docker\DockerCli.exe" -SwitchLinuxEngine

# Подождать 30 секунд
Start-Sleep -Seconds 30

# Проверить
docker info --format "{{.OSType}}"
```

### Проблема 4: Nginx не запускается

**Решение:**
```batch
# Проверить конфигурацию
cd C:\nginx
nginx.exe -t

# Проверить логи
type C:\nginx\logs\error.log

# Убить все процессы nginx
taskkill /F /IM nginx.exe

# Запустить заново
nginx-control.bat start
```

---

## 📋 Чек-лист перед запуском

- [ ] Docker Desktop установлен и запущен
- [ ] Docker в Linux режиме (`docker info --format "{{.OSType}}"` = `linux`)
- [ ] Node.js установлен (версия 18+)
- [ ] Nginx установлен в `C:\nginx`
- [ ] Порты 80, 3000, 5432, 6379, 5672, 8181 свободны
- [ ] Файл `.env` настроен с правильными credentials
- [ ] `npm install` выполнен в корне проекта

---

## 🎯 Автоматизация

### Создание скрипта полного запуска:

Создайте файл `start-full-stack.bat`:

```batch
@echo off
echo Starting VSS Full Stack...
echo.

echo Starting Docker containers...
docker start vss-postgres vss-redis vss-rabbitmq
timeout /t 15 /nobreak

echo Starting VSS services...
start powershell -Command "cd C:\Users\Administrator\Documents\vss-omni-telecom; npm run start:all"
timeout /t 20 /nobreak

echo Starting Nginx...
call nginx-control.bat start

echo.
echo Done! Opening browsers...
start http://79.137.207.215/
start http://79.137.207.215:3000/vss-dashboard.html

echo.
echo VSS Stack is ready!
pause
```

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте все сервисы по чек-листу
2. Просмотрите логи (Docker, Nginx, Node.js)
3. Убедитесь, что все порты доступны
4. Проверьте firewall settings
5. Перезапустите проблемный сервис

**Документация:**
- `NGINX-SETUP.md` - Настройка Nginx
- `FIXES-COMPLETED-REPORT.md` - Выполненные исправления
- `ENV-SETUP-GUIDE.md` - Настройка окружения

---

**Версия**: 1.0  
**Дата**: 2025-12-04  
**Статус**: ✅ Полностью рабочий

