# VSS OMNI TELECOM - Все логины и пароли

**Дата:** 2025-12-03  
**Версия:** 1.0.0  
**⚠️ ВАЖНО:** Измените все пароли перед использованием в production!

---

## 🌐 Определение вашего IP адреса

### PowerShell:
```powershell
# Получить IP адрес
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\.254\."} | Select-Object -First 1).IPAddress
```

### CMD:
```cmd
ipconfig | findstr IPv4
```

**Замените `YOUR_SERVER_IP` в ссылках ниже на полученный IP адрес**

---

## 🔐 УЧЕТНЫЕ ДАННЫЕ ДЛЯ ВСЕХ СЕРВИСОВ

### 1. 🐰 RABBITMQ MANAGEMENT UI

**URL:** http://YOUR_SERVER_IP:15672  
**URL (локально):** http://localhost:15672

```
Username: vss
Password: VssRabbitPass223
```

**Альтернативные учетные данные:**
```
Username: vss-admin
Password: vss_rabbit_pass (из .env файла)
```

**Virtual Host:** `/vss`

**Что доступно:**
- ✅ Просмотр очередей и exchanges
- ✅ Мониторинг сообщений
- ✅ Управление пользователями
- ✅ Статистика и метрики

---

### 2. 🖥️ GUACAMOLE (VSS DEMIURGE Remote Access Gateway)

**URL:** http://YOUR_SERVER_IP:8080/guacamole  
**URL (локально):** http://localhost:8080/guacamole

```
Username: guacadmin
Password: guacadmin
```

**⚠️ ВАЖНО:** Измените пароль после первого входа!

**Что доступно:**
- ✅ Удаленный доступ к слотам
- ✅ RDP подключения
- ✅ VNC подключения
- ✅ SSH подключения

---

### 3. 📊 GRAFANA MONITORING

**URL:** http://YOUR_SERVER_IP:3001  
**URL (локально):** http://localhost:3001

```
Username: admin
Password: vss_grafana_pass (из .env файла)
```

**По умолчанию (если .env не настроен):**
```
Username: admin
Password: admin
```

**Что доступно:**
- ✅ Дашборды мониторинга
- ✅ Метрики всех сервисов
- ✅ Графики производительности
- ✅ Алерты и уведомления

---

### 4. 🗄️ POSTGRESQL DATABASE

**Host:** YOUR_SERVER_IP:5432  
**Host (локально):** localhost:5432

```
Username: vss
Password: Sup3rS3cur3Password (из docker-compose.production.yml)
Database: vss_db
```

**Connection String:**
```
postgresql://vss:Sup3rS3cur3Password@YOUR_SERVER_IP:5432/vss_db
```

**Инструменты для подключения:**
- pgAdmin
- DBeaver
- TablePlus
- psql CLI

---

### 5. 💾 REDIS

**Host:** YOUR_SERVER_IP:6379  
**Host (локально):** localhost:6379

```
Password: vss_redis_pass (из .env файла)
```

**Connection String:**
```
redis://:vss_redis_pass@YOUR_SERVER_IP:6379
```

**Инструменты:**
- Redis Commander
- RedisInsight
- redis-cli

---

### 6. 🎨 VSS WORKSPACE (Main UI)

**URL:** http://YOUR_SERVER_IP:3000  
**URL (локально):** http://localhost:3000

```
Username: admin
Password: admin123
```

**Логин через API:**
```bash
curl -X POST http://YOUR_SERVER_IP:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

---

### 7. 📈 PROMETHEUS

**URL:** http://YOUR_SERVER_IP:9090  
**URL (локально):** http://localhost:9090

```
Логин не требуется (открытый доступ)
```

**Что доступно:**
- ✅ Метрики всех сервисов
- ✅ PromQL запросы
- ✅ Targets monitoring
- ✅ Alerts

---

## 🔗 ВСЕ ССЫЛКИ С БЕЛЫМ IP

Замените `YOUR_SERVER_IP` на ваш IP адрес (например, `192.168.1.100` или внешний IP)

### 🎨 Пользовательские интерфейсы:
```
http://YOUR_SERVER_IP:3000          - VSS WORKSPACE (Main UI)
http://YOUR_SERVER_IP:15672         - RabbitMQ Management
http://YOUR_SERVER_IP:3001          - Grafana Monitoring
http://YOUR_SERVER_IP:8080/guacamole - Guacamole Remote Access
http://YOUR_SERVER_IP:9090          - Prometheus Metrics
```

### 🔧 API Endpoints:
```
http://YOUR_SERVER_IP:3000/api      - WORKSPACE API
http://YOUR_SERVER_IP:8081/api      - POINT (Auth & RBAC)
http://YOUR_SERVER_IP:8082/api      - DCI (Data & CI/CD)
http://YOUR_SERVER_IP:8083/api      - OTTB (Slots & Trunks)
```

### ⚡ Health Checks:
```
http://YOUR_SERVER_IP:3000/health   - WORKSPACE
http://YOUR_SERVER_IP:8081/health   - POINT
http://YOUR_SERVER_IP:8082/health   - DCI
http://YOUR_SERVER_IP:8083/health   - OTTB
```

### 📊 Monitoring:
```
http://YOUR_SERVER_IP:3001          - Grafana
http://YOUR_SERVER_IP:9090          - Prometheus
http://YOUR_SERVER_IP:3000/metrics  - WORKSPACE Metrics
http://YOUR_SERVER_IP:8083/metrics  - OTTB Metrics
```

---

## 🚀 БЫСТРЫЕ КОМАНДЫ

### Узнать свой IP адрес:
```powershell
# PowerShell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notmatch "^127\."}).IPAddress

# CMD
ipconfig | findstr IPv4
```

### Проверка доступности сервисов:
```powershell
# Замените IP на ваш
$IP = "192.168.1.100"

curl "http://${IP}:3000/health"
curl "http://${IP}:8081/health"
curl "http://${IP}:8082/health"
curl "http://${IP}:8083/health"
```

---

## 📋 СВОДНАЯ ТАБЛИЦА ЛОГИНОВ

| Сервис | URL | Username | Password | Примечание |
|--------|-----|----------|----------|------------|
| **RabbitMQ** | http://IP:15672 | vss | VssRabbitPass223 | ⚠️ Изменить! |
| **Guacamole** | http://IP:8080/guacamole | guacadmin | guacadmin | ⚠️ Изменить! |
| **Grafana** | http://IP:3001 | admin | vss_grafana_pass | Из .env |
| **VSS UI** | http://IP:3000 | admin | admin123 | ⚠️ Изменить! |
| **PostgreSQL** | IP:5432 | vss | Sup3rS3cur3Password | ⚠️ Изменить! |
| **Redis** | IP:6379 | - | vss_redis_pass | Из .env |
| **Prometheus** | http://IP:9090 | - | - | Без логина |

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ ПО БЕЗОПАСНОСТИ

1. **🔴 ОБЯЗАТЕЛЬНО измените все пароли по умолчанию!**
2. **🔴 Особенно важно изменить:**
   - Guacamole: guacadmin / guacadmin
   - VSS Admin: admin / admin123
   - PostgreSQL: пароль БД
3. **🟡 Используйте сильные пароли (16+ символов)**
4. **🟡 Настройте firewall для ограничения доступа**
5. **🟡 Используйте SSL/TLS для production**

---

## 🎯 ПРИМЕР ИСПОЛЬЗОВАНИЯ С БЕЛЫМ IP

Если ваш сервер имеет IP `192.168.1.100`, используйте:

### Guacamole:
```
URL:      http://192.168.1.100:8080/guacamole
Username: guacadmin
Password: guacadmin
```

### RabbitMQ:
```
URL:      http://192.168.1.100:15672
Username: vss
Password: VssRabbitPass223
```

### API запросы:
```bash
# Логин
curl -X POST http://192.168.1.100:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Получить слоты
curl -H "Authorization: Bearer TOKEN" \
  http://192.168.1.100:8083/api/slots

# Dashboard
curl -H "Authorization: Bearer TOKEN" \
  http://192.168.1.100:3000/api/dashboard
```

---

**✅ Все учетные данные готовы!**  
**⚠️ НЕ ЗАБУДЬТЕ ИЗМЕНИТЬ ПАРОЛИ ПО УМОЛЧАНИЮ!**

