# Отчет о проверке роутов nginx-proxy-manager

## Статус проверки

Дата проверки: 2025-11-29

### Результаты проверки

#### ✅ Работающие роуты:
1. **localhost:8084** → VSS Frontend (порт 80)
   - Статус: 200 OK
   - Тип: HTML страница
   - Работает корректно

#### ⚠️ Роуты, требующие настройки:

**Проблема:** Поддомены не резолвятся без записей в hosts файле Windows.

**Роуты, добавленные в nginx-proxy-manager:**
- `workspace.localhost` → порт 3000 (VSS Workspace API)
- `ottb.localhost` → порт 8083 (VSS OTTB API)
- `dci.localhost` → порт 8082 (VSS DCI API)
- `point.localhost` → порт 8081 (VSS POINT API)
- `guacamole.localhost` → порт 8080 (Guacamole)
- `rabbitmq.localhost` → порт 15672 (RabbitMQ Management)
- `grafana.localhost` → порт 3001 (Grafana)
- `prometheus.localhost` → порт 9090 (Prometheus)

### Прямые подключения к сервисам

Проверка прямых подключений к сервисам на localhost:

| Сервис | Порт | Статус | Путь |
|--------|------|--------|------|
| VSS Workspace | 3000 | ✅ OK | `/health` возвращает 200 |
| VSS OTTB | 8083 | ✅ OK | `/health` возвращает 200 |
| VSS DCI | 8082 | ✅ OK | `/health` возвращает 200 |
| VSS POINT | 8081 | ✅ OK | `/health` возвращает 200 |
| Guacamole | 8080 | ✅ OK | `/guacamole` возвращает 200 |
| RabbitMQ | 15672 | ⚠️ Проблема | Соединение закрывается |
| Grafana | 3001 | ❌ Не запущен | Timeout |
| Prometheus | 9090 | ❌ Не запущен | Timeout |

### Решение проблем

#### 1. Добавление записей в hosts файл

Для работы поддоменов необходимо добавить записи в `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 workspace.localhost
127.0.0.1 ottb.localhost
127.0.0.1 dci.localhost
127.0.0.1 point.localhost
127.0.0.1 guacamole.localhost
127.0.0.1 rabbitmq.localhost
127.0.0.1 grafana.localhost
127.0.0.1 prometheus.localhost
```

**Использование скрипта:**
```powershell
# Запустить PowerShell от имени администратора
.\add-hosts-entries.ps1
```

#### 2. Проверка подключения из контейнера

nginx-proxy-manager использует `host.docker.internal` для подключения к хосту. На Windows это должно работать, но если возникают проблемы (502 ошибки), можно:

1. Использовать IP адрес хоста вместо `host.docker.internal`
2. Проверить сетевые настройки Docker

#### 3. Запуск отсутствующих сервисов

Grafana и Prometheus не запущены. Для их запуска:

```powershell
docker-compose -f docker-compose.vss-demiurge.yml up -d grafana prometheus
```

### Доступ к сервисам

После добавления записей в hosts файл, сервисы будут доступны:

- **VSS Frontend:** http://localhost:8084
- **VSS Workspace API:** http://workspace.localhost:8084
- **VSS OTTB API:** http://ottb.localhost:8084
- **VSS DCI API:** http://dci.localhost:8084
- **VSS POINT API:** http://point.localhost:8084
- **Guacamole:** http://guacamole.localhost:8084
- **RabbitMQ Management:** http://rabbitmq.localhost:8084
- **Grafana:** http://grafana.localhost:8084 (после запуска)
- **Prometheus:** http://prometheus.localhost:8084 (после запуска)

### Админ-панель nginx-proxy-manager

- **URL:** http://localhost:8181
- **Email:** deepkb03@gmail.com
- **Password:** PoiuuioP1!

### Следующие шаги

1. ✅ Добавить записи в hosts файл (использовать `add-hosts-entries.ps1`)
2. ✅ Перезапустить браузер после изменения hosts файла
3. ✅ Проверить доступность всех поддоменов
4. ⚠️ Запустить Grafana и Prometheus, если нужны
5. ⚠️ Проверить RabbitMQ Management (возможно, требуется настройка)

