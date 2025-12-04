# VSS OMNI TELECOM - Все ссылки и роуты

**Дата:** 2025-12-03  
**Версия:** 1.0.0  
**Статус:** 🚀 Система запущена

---

## 🌐 ВСЕ ДОСТУПНЫЕ ССЫЛКИ

### 🎨 FRONTEND / UI

| Название | URL | Описание |
|----------|-----|----------|
| **Main UI** | http://localhost:3000 | Главный интерфейс VSS |
| **Dashboard** | http://localhost:3000/dashboard | Дашборд с метриками |
| **Admin Panel** | http://localhost:3000/admin | Панель администратора |
| **Health Check** | http://localhost:3000/health | Проверка здоровья WORKSPACE |

---

### 🔐 AUTHENTICATION & RBAC (POINT - Port 8081)

| Endpoint | Method | URL | Описание |
|----------|--------|-----|----------|
| **Health** | GET | http://localhost:8081/health | Проверка здоровья |
| **Login** | POST | http://localhost:8081/api/auth/login | Вход в систему |
| **Refresh Token** | POST | http://localhost:8081/api/auth/refresh | Обновление JWT токена |
| **Logout** | POST | http://localhost:8081/api/auth/logout | Выход из системы |
| **Role Check** | GET | http://localhost:8081/api/point/rolecheck | Проверка прав доступа |
| **Get Roles** | GET | http://localhost:8081/api/roles | Список всех ролей |
| **Update Role** | POST | http://localhost:8081/api/roles/:id | Обновление роли |
| **Get Users** | GET | http://localhost:8081/api/users | Список пользователей |
| **Create User** | POST | http://localhost:8081/api/users | Создание пользователя |
| **Update User** | PATCH | http://localhost:8081/api/users/:id | Обновление пользователя |
| **Delete User** | DELETE | http://localhost:8081/api/users/:id | Удаление пользователя |

**Пример запроса Login:**
```json
POST http://localhost:8081/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

---

### 📊 DATA & CI/CD (DCI - Port 8082)

| Endpoint | Method | URL | Описание |
|----------|--------|-----|----------|
| **Health** | GET | http://localhost:8082/health | Проверка здоровья |
| **Pipelines** | GET | http://localhost:8082/api/dci/pipelines | Список пайплайнов |
| **Run Pipeline** | POST | http://localhost:8082/api/dci/pipeline/:id/run | Запуск пайплайна |
| **Stop Pipeline** | POST | http://localhost:8082/api/dci/pipeline/:id/stop | Остановка пайплайна |
| **Pipeline Status** | GET | http://localhost:8082/api/dci/pipeline/:id/status | Статус пайплайна |
| **DCI Status** | GET | http://localhost:8082/api/dci/status | Статус DCI системы |
| **Logs** | GET | http://localhost:8082/api/dci/logs | Логи пайплайнов |
| **Log Event** | POST | http://localhost:8082/api/dci/log-event | Логирование события |

---

### 📞 TRUNK & SLOT MANAGEMENT (OTTB - Port 8083)

| Endpoint | Method | URL | Описание |
|----------|--------|-----|----------|
| **Health** | GET | http://localhost:8083/health | Проверка здоровья |
| **Get Slots** | GET | http://localhost:8083/api/slots | Список всех слотов |
| **Get Slot** | GET | http://localhost:8083/api/slots/:id | Детали слота |
| **Restart Slot** | POST | http://localhost:8083/api/slots/:id/restart | Перезапуск слота |
| **Reboot Device** | POST | http://localhost:8083/api/slots/:id/reboot-device | Перезагрузка устройства |
| **Execute GACS** | POST | http://localhost:8083/api/slots/:id/gacs | Выполнение GACS скрипта |
| **ADB Command** | POST | http://localhost:8083/api/slots/:id/adb-command | ADB команда |
| **Start Call** | POST | http://localhost:8083/api/call/start | Запуск звонка |
| **End Call** | POST | http://localhost:8083/api/call/end | Завершение звонка |
| **Get Call** | GET | http://localhost:8083/api/call/:id | Статус звонка |
| **Calls Feed** | GET | http://localhost:8083/api/calls/feed | Live feed звонков |
| **Run Campaign** | POST | http://localhost:8083/api/autodialer/run-campaign | Запуск кампании автодозвона |
| **Stop Campaign** | POST | http://localhost:8083/api/autodialer/stop-campaign | Остановка кампании |
| **Get Campaigns** | GET | http://localhost:8083/api/autodialer/campaigns | Список кампаний |
| **Get Leads** | GET | http://localhost:8083/api/autodialer/leads | Список лидов |
| **Run GACS Script** | POST | http://localhost:8083/api/gacs/run-script | Запуск GACS скрипта |
| **GACS Status** | GET | http://localhost:8083/api/gacs/status/:script_id | Статус скрипта |
| **GACS Scripts** | GET | http://localhost:8083/api/gacs/scripts | Список скриптов |
| **Stop GACS** | POST | http://localhost:8083/api/gacs/stop/:script_id | Остановка скрипта |
| **PBX Status** | GET | http://localhost:8083/api/pbx/status | Статус транков |
| **PBX Dial** | POST | http://localhost:8083/api/pbx/dial | Инициация SIP звонка |
| **PBX Route** | POST | http://localhost:8083/api/pbx/route | Обновление маршрута |
| **Get CDR** | GET | http://localhost:8083/api/pbx/cdr/:id | Получить CDR |
| **System Metrics** | GET | http://localhost:8083/api/monitor/system | Системные метрики |
| **USB Status** | GET | http://localhost:8083/api/monitor/usb | Статус USB HUB |
| **Network Metrics** | GET | http://localhost:8083/api/monitor/network | Сетевые метрики |
| **Slot Metrics** | GET | http://localhost:8083/api/monitor/slots/:id | Метрики слота |

**Пример запроса Start Call:**
```json
POST http://localhost:8083/api/call/start
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "number": "+1234567890",
  "slot": "AUTO"
}
```

---

### 🏢 WORKSPACE API (Port 3000)

| Endpoint | Method | URL | Описание |
|----------|--------|-----|----------|
| **Health** | GET | http://localhost:3000/health | Проверка здоровья |
| **Health Ready** | GET | http://localhost:3000/health/ready | Готовность к работе |
| **Health Live** | GET | http://localhost:3000/health/live | Живучесть сервиса |
| **Add CRM Note** | POST | http://localhost:3000/api/crm/note | Добавление заметки |
| **Get CRM Notes** | GET | http://localhost:3000/api/crm/notes/:call_id | Заметки по звонку |
| **Get CRM Leads** | GET | http://localhost:3000/api/crm/leads | Получение лидов |
| **Create Lead** | POST | http://localhost:3000/api/crm/leads | Создание лида |
| **Send Notification** | POST | http://localhost:3000/api/notifier/send | Отправка уведомления |
| **Notification History** | GET | http://localhost:3000/api/notifier/history | История уведомлений |
| **Dashboard** | GET | http://localhost:3000/api/dashboard | Данные дашборда |
| **Dashboard Slots** | GET | http://localhost:3000/api/dashboard/slots | Слоты для дашборда |
| **Dashboard Metrics** | GET | http://localhost:3000/api/dashboard/metrics | Системные метрики |
| **Guacamole Connect** | POST | http://localhost:3000/api/guacamole/connect | Подключение к слоту |
| **Guacamole Disconnect** | POST | http://localhost:3000/api/guacamole/disconnect | Отключение от слота |
| **Guacamole Sessions** | GET | http://localhost:3000/api/guacamole/sessions | Активные сессии |
| **RTMP Publish** | POST | http://localhost:3000/api/rtmp/publish | RTMP stream callback |
| **RTMP Publish Done** | POST | http://localhost:3000/api/rtmp/publish_done | RTMP stream end |
| **Get RTMP Streams** | GET | http://localhost:3000/api/rtmp/streams | Список RTMP потоков |
| **Get RTMP Stream** | GET | http://localhost:3000/api/rtmp/stream/:slot_id | RTMP поток слота |
| **Start RTMP** | POST | http://localhost:3000/api/rtmp/stream/:slot_id/start | Запуск RTMP |
| **Stop RTMP** | POST | http://localhost:3000/api/rtmp/stream/:slot_id/stop | Остановка RTMP |
| **ARCHONTs Centers** | GET | http://localhost:3000/api/archonts/centers | Call-центры |
| **Create Center** | POST | http://localhost:3000/api/archonts/centers | Создание центра |
| **ARCHONTs Templates** | GET | http://localhost:3000/api/archonts/templates | Шаблоны |
| **Assign Resources** | POST | http://localhost:3000/api/archonts/centers/:id/assign | Назначение ресурсов |
| **Security Audit** | POST | http://localhost:3000/api/security/audit | Запись аудита |
| **Get Security Audit** | GET | http://localhost:3000/api/security/audit | Логи аудита |

---

### 🐰 RABBITMQ

| Название | URL | Описание |
|----------|-----|----------|
| **Management UI** | http://localhost:15672 | Веб-интерфейс управления |
| **AMQP Connection** | amqp://localhost:5672 | Подключение AMQP |
| **AMQP with auth** | amqp://vss-admin:PASSWORD@localhost:5672/vss | С аутентификацией |

**Логин:** `vss-admin`  
**Пароль:** Из файла `.env` (RABBITMQ_PASSWORD)  
**Virtual Host:** `/vss`

**Exchanges:**
- `vss.events` (topic) - События системы
- `vss.commands` (topic) - Команды

**Queues:**
- `vss.call.events` - События звонков
- `vss.slot.commands` - Команды слотов
- `vss.autodial.leads` - Лиды автодозвона
- `vss.gacs.commands` - GACS команды

---

### 🗄️ POSTGRESQL

| Параметр | Значение |
|----------|----------|
| **Host** | localhost |
| **Port** | 5432 |
| **Database** | vss_db |
| **User** | vss |
| **Password** | Из `.env` (DB_PASSWORD) |
| **Connection String** | postgresql://vss:PASSWORD@localhost:5432/vss_db |

**Основные таблицы:**
- `users`, `roles` - Пользователи и роли
- `trunks`, `slots` - Транки и слоты
- `calls` - CDR записи
- `campaigns`, `autodialer_leads` - Автодозвон
- `crm_leads` - CRM лиды
- `gacs_scripts` - GACS скрипты
- `rtmp_streams` - RTMP потоки
- `guacamole_sessions_audit` - Аудит Guacamole
- `security_audit_log` - Аудит безопасности

---

### 💾 REDIS

| Параметр | Значение |
|----------|----------|
| **Host** | localhost |
| **Port** | 6379 |
| **Password** | Из `.env` (REDIS_PASSWORD) |
| **Connection** | redis://:PASSWORD@localhost:6379 |

**Использование:**
- Кэширование данных
- Очереди задач
- Session storage
- Real-time данные

---

### 📈 MONITORING

| Сервис | URL | Логин | Описание |
|---------|-----|-------|----------|
| **Grafana** | http://localhost:3001 | admin / (из .env) | Визуализация метрик |
| **Prometheus** | http://localhost:9090 | - | Сбор метрик |

**Метрики endpoints:**
- http://localhost:3000/metrics - WORKSPACE
- http://localhost:8081/metrics - POINT
- http://localhost:8082/metrics - DCI
- http://localhost:8083/metrics - OTTB

---

### 🖥️ REMOTE ACCESS

| Сервис | URL | Описание |
|---------|-----|----------|
| **Guacamole** | http://localhost:8080/guacamole | Web Gateway для удаленного доступа |
| **guacd** | localhost:4822 | Guacamole daemon |

**Поддерживаемые протоколы:**
- RDP (Remote Desktop Protocol)
- VNC (Virtual Network Computing)
- SSH (Secure Shell)
- Telnet

---

### 📹 RTMP STREAMING

| Endpoint | URL | Описание |
|----------|-----|----------|
| **RTMP Server** | rtmp://localhost:1935/live | RTMP сервер |
| **HLS Streams** | http://localhost:8085/hls | HLS потоки |
| **HLS Stream** | http://localhost:8085/hls/{stream_key}.m3u8 | Конкретный поток |

**Пример публикации:**
```bash
ffmpeg -i input.mp4 -c:v libx264 -c:a aac -f flv rtmp://localhost:1935/live/stream_key
```

**Пример просмотра:**
```html
<video controls>
  <source src="http://localhost:8085/hls/stream_key.m3u8" type="application/x-mpegURL">
</video>
```

---

### 📞 SIP SERVICES

| Сервис | Port | Protocol | Описание |
|---------|------|----------|----------|
| **Kamailio** | 5060 | UDP/TCP | SIP Proxy |
| **Asterisk** | 5061 | UDP/TCP | Media Server |
| **Asterisk AMI** | 5038 | TCP | Manager Interface |
| **RTP Range** | 10000-20000 | UDP | Media streams |

**SIP Numbering Plan:**
- `97xxx` (97001-97999) - AUTO слоты
- `98xxx` (98001-98999) - MF слоты
- `99xxx` (99001-99999) - LS слоты
- `9xxx` (9001-9999) - Сервисы

---

### 🔌 WEBSOCKET

| Endpoint | URL | Описание |
|----------|-----|----------|
| **WebSocket** | ws://localhost:3000 | Socket.IO соединение |

**События (Socket.IO):**
- `call.update` - Обновления звонков
- `slot.update` - Обновления слотов
- `pipeline.update` - Обновления пайплайнов
- `system.alert` - Системные оповещения
- `rtmp.stream.start` - Начало RTMP потока
- `rtmp.stream.stop` - Конец RTMP потока

**Пример подключения:**
```javascript
const socket = io('http://localhost:3000');

socket.on('call.update', (data) => {
  console.log('Call update:', data);
});

socket.on('slot.update', (data) => {
  console.log('Slot update:', data);
});
```

---

## 🔑 АУТЕНТИФИКАЦИЯ

Большинство API endpoints требуют JWT токен в заголовке:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

**Получение токена:**
```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**Ответ:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "admin",
  "expires": 3600,
  "permissions": {...}
}
```

---

## 🧪 ТЕСТОВЫЕ ЗАПРОСЫ

### 1. Проверка здоровья всех сервисов:
```bash
curl http://localhost:3000/health
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
```

### 2. Получение списка слотов:
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:8083/api/slots
```

### 3. Запуск звонка:
```bash
curl -X POST http://localhost:8083/api/call/start \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"number": "+1234567890", "slot": "AUTO"}'
```

### 4. Получение дашборда:
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/dashboard
```

### 5. Создание CRM лида:
```bash
curl -X POST http://localhost:3000/api/crm/leads \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com",
    "status": "new"
  }'
```

---

## 📱 РОЛИ И ПРАВА ДОСТУПА

### Admin (Администратор)
- ✅ Полный доступ ко всем endpoints
- ✅ Управление пользователями и ролями
- ✅ Запуск CI/CD пайплайнов
- ✅ Системные настройки

### Operator (Оператор)
- ✅ Управление звонками
- ✅ Работа со слотами
- ✅ CRM функции
- ✅ Подключение через Guacamole
- ❌ Управление пользователями

### Seller (Продавец)
- ✅ Работа с лидами
- ✅ CRM заметки
- ✅ Просмотр истории звонков
- ❌ Управление слотами
- ❌ Инициация звонков

### Supervisor (Супервизор)
- ✅ Мониторинг операций
- ✅ Просмотр отчетов
- ✅ Доступ к логам
- ❌ Изменение настроек

---

## 🚀 БЫСТРЫЙ СТАРТ

### 1. Проверка статуса:
```bash
docker-compose -f docker-compose.production.yml ps
```

### 2. Просмотр логов:
```bash
docker-compose -f docker-compose.production.yml logs -f
```

### 3. Остановка:
```bash
docker-compose -f docker-compose.production.yml down
```

### 4. Перезапуск:
```bash
docker-compose -f docker-compose.production.yml restart
```

---

## 📚 ПОЛЕЗНЫЕ ССЫЛКИ

- **Документация API:** API-DOCUMENTATION.md
- **Архитектура:** VSS-ARCHITECTURE-EXPLAINED.md
- **Руководство:** VSS-MANUAL.md
- **Тестирование:** VSS-TESTING-REPORT.md
- **Анализ:** DEEP-ANALYSIS-REPORT.md

---

**✅ Все роуты и ссылки готовы к использованию!**

**Статус системы:** 🚀 ЗАПУЩЕНА  
**Дата:** 2025-12-03  
**Версия:** 1.0.0


