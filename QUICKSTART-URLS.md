# VSS DEMIURGE - Быстрый доступ к сервисам

## Основные URL

### Frontend (Главная страница)
- **VSS Dashboard:** http://localhost/
- **VSS Dashboard (прямая ссылка):** http://localhost/dashboard

### API Endpoints

- **WORKSPACE API:** http://localhost/api/workspace/
- **OTTB API:** http://localhost/api/ottb/
- **DCI API:** http://localhost/api/dci/
- **POINT API:** http://localhost/api/point/

### Прямой доступ к сервисам (если нужен)

- **WORKSPACE:** http://localhost:3000
- **OTTB API:** http://localhost:8083
- **DCI API:** http://localhost:8082
- **POINT API:** http://localhost:8081

### Guacamole

- **Guacamole Web Interface:** http://localhost/guacamole/
- **Guacamole (прямой доступ):** http://localhost:8080/guacamole

### Мониторинг

- **RabbitMQ Management:** http://localhost:15672
  - Username: `vss-admin`
  - Password: `vss_rabbit_pass` (или из переменной окружения)

- **Grafana:** http://localhost:3001
  - Username: `admin`
  - Password: `vss_grafana_pass` (или из переменной окружения)

- **Prometheus:** http://localhost:9090

## Проверка статуса

```bash
# Проверить статус всех контейнеров
docker-compose -f docker-compose.vss-demiurge.yml ps

# Проверить логи
docker-compose -f docker-compose.vss-demiurge.yml logs -f

# Проверить конкретный сервис
docker-compose -f docker-compose.vss-demiurge.yml logs -f vss-workspace
```

## Запуск системы

```bash
# Запустить все сервисы
docker-compose -f docker-compose.vss-demiurge.yml up -d

# Перезапустить все сервисы
docker-compose -f docker-compose.vss-demiurge.yml restart

# Остановить все сервисы
docker-compose -f docker-compose.vss-demiurge.yml down
```

