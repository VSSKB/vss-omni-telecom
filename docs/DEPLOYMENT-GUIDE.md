# VSS DEMIURGE - Руководство по развертыванию

## Содержание

1. [Требования](#требования)
2. [Подготовка окружения](#подготовка-окружения)
3. [Развертывание](#развертывание)
4. [Проверка](#проверка)
5. [Обслуживание](#обслуживание)

## Требования

### Минимальные требования

- **OS:** Ubuntu 22.04 LTS / CentOS 8+ / Windows Server 2019+
- **CPU:** 4 cores
- **RAM:** 8 GB
- **Disk:** 50 GB свободного места
- **Network:** Статический IP адрес

### Программное обеспечение

- Docker 24.0+
- Docker Compose 2.0+
- Git 2.30+
- Python 3.9+ (для мониторинга)

## Подготовка окружения

### 1. Установка Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER
```

### 2. Клонирование репозитория

```bash
git clone https://github.com/vss/vss-omni-telecom.git
cd vss-omni-telecom
```

### 3. Настройка переменных окружения

```bash
cp .env.production.example .env.production
nano .env.production
```

**Важно:** Измените все пароли и секретные ключи!

## Развертывание

### Вариант 1: Docker Compose (рекомендуется для начала)

```bash
# Запустить все сервисы
make deploy

# Или вручную
docker-compose -f docker-compose.production.yml up -d
```

### Вариант 2: Kubernetes

```bash
# Создать namespace
kubectl create namespace vss-production

# Создать secrets
kubectl create secret generic vss-secrets \
  --from-file=.env.production \
  -n vss-production

# Применить манифесты
kubectl apply -f k8s/ -n vss-production
```

### Вариант 3: Systemd (bare metal)

```bash
# Скопировать service файлы
sudo cp systemd/*.service /etc/systemd/system/

# Включить и запустить
sudo systemctl daemon-reload
sudo systemctl enable vss-core
sudo systemctl start vss-core
```

## Проверка

### 1. Проверка статуса сервисов

```bash
# Docker Compose
make status

# Kubernetes
kubectl get pods -n vss-production

# Systemd
sudo systemctl status vss-core
```

### 2. Health checks

```bash
# Проверить здоровье системы
make health

# Проверить конкретные сервисы
curl http://localhost:3000/health
curl http://localhost:8083/health
curl http://localhost:8082/health
```

### 3. Проверка логов

```bash
# Все сервисы
make logs

# Конкретный сервис
docker-compose -f docker-compose.production.yml logs -f api
```

## Обслуживание

### Резервное копирование

```bash
# Создать бэкап
make backup

# Восстановить из бэкапа
docker exec -i vss_postgres psql -U vss vss_db < backup_20240115.sql
```

### Миграции базы данных

```bash
# Выполнить миграции
make migrate
```

### Мониторинг

```bash
# Запустить мониторинг
make monitor
```

### Обновление системы

```bash
# Обновить и перезапустить
make update
```

## Troubleshooting

### Проблема: Сервисы не запускаются

```bash
# Проверить логи
docker-compose -f docker-compose.production.yml logs

# Проверить порты
netstat -tulpn | grep -E '3000|8081|8082|8083'
```

### Проблема: База данных недоступна

```bash
# Проверить подключение
docker exec vss_postgres psql -U vss -d vss_db -c "SELECT 1"

# Проверить логи PostgreSQL
docker logs vss_postgres
```

### Проблема: RabbitMQ недоступен

```bash
# Проверить статус
docker exec vss_rabbitmq rabbitmq-diagnostics ping

# Проверить логи
docker logs vss_rabbitmq
```

## Безопасность

### Рекомендации

1. **Измените все пароли** в `.env.production`
2. **Настройте SSL сертификаты** для HTTPS
3. **Ограничьте доступ** к портам через firewall
4. **Регулярно обновляйте** систему и зависимости
5. **Мониторьте логи** на предмет подозрительной активности

### Firewall правила

```bash
# Разрешить только необходимые порты
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Масштабирование

### Горизонтальное масштабирование

```bash
# Увеличить количество реплик API
docker-compose -f docker-compose.production.yml up -d --scale api=3
```

### Вертикальное масштабирование

Отредактируйте `docker-compose.production.yml` и увеличьте ресурсы:

```yaml
resources:
  limits:
    cpu: "1000m"
    memory: "1Gi"
```

## Поддержка

Для получения помощи:
- Документация: `docs/`
- Логи: `/var/log/vss/`
- Мониторинг: `scripts/monitor.py`

