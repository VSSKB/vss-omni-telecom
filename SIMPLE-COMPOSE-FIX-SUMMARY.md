# Исправление проблем docker-compose.vss-demiurge-simple.yml

## Проблемы и решения

### 1. PostgreSQL: database "vss" does not exist

**Проблема:** Healthcheck PostgreSQL использовал `pg_isready -U vss` без указания базы данных.

**Решение:** Изменен healthcheck на `pg_isready -U vss -d vss_db`

**Файл:** `docker-compose.vss-demiurge-simple.yml` (строка 47)

### 2. Nginx: Port 80 недоступен

**Проблема:** Порт 80 занят системным процессом Windows (PID 4).

**Решение:** Изменен порт nginx с `80:80` на `8085:80`

**Файл:** `docker-compose.vss-demiurge-simple.yml` (строка 203)

**Доступ:** http://localhost:8085

### 3. Nginx: upstream "nginx-rtmp" not found

**Проблема:** Конфигурация nginx ссылалась на сервис `nginx-rtmp`, которого нет в simple версии.

**Решение:** Закомментированы секции `/hls/` и `/recordings/` в `config/nginx/nginx-vss.conf`

**Файл:** `config/nginx/nginx-vss.conf` (строки 77-96)

### 4. RabbitMQ: vhost "vss" not found

**Проблема:** В URL используется `/vss`, но RabbitMQ парсит его как `vss` без слеша.

**Решение:** 
- Создан дополнительный vhost `vss` (без слеша)
- Настроены права для пользователя `vss-admin` на оба vhost: `/vss` и `vss`
- Обновлен `definitions.json` для создания обоих vhost при загрузке

**Файлы:**
- `config/rabbitmq/definitions.json` - добавлен vhost "vss"
- Права настроены через `rabbitmqctl`

## Результат

✅ Все сервисы работают корректно:
- vss-postgres - healthy
- vss-nginx - running (порт 8085)
- vss-rabbitmq - healthy (оба vhost доступны)
- vss-workspace - healthy (подключен к RabbitMQ)
- vss-ottb - healthy
- vss-dci - healthy
- vss-point - healthy

✅ RabbitMQ подключения успешны:
- Все сервисы подключаются к vhost `vss`
- Ошибки "vhost not found" больше не появляются

## Доступ к сервисам

- **Frontend:** http://localhost:8085
- **Workspace API:** http://localhost:3000
- **OTTB API:** http://localhost:8083
- **DCI API:** http://localhost:8082
- **POINT API:** http://localhost:8081
- **Guacamole:** http://localhost:8080
- **RabbitMQ Management:** http://localhost:15672
- **PostgreSQL:** localhost:5432

## Примечания

1. Порт 80 зарезервирован Windows, поэтому используется порт 8085
2. В simple версии нет nginx-rtmp, поэтому соответствующие location закомментированы
3. Оба RabbitMQ vhost (`/vss` и `vss`) созданы для совместимости с разными форматами URL

