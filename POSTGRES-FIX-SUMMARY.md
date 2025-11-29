# Исправление проблемы PostgreSQL

## Проблема
Ошибка: `FATAL: database "vss" does not exist`

## Причина
Healthcheck PostgreSQL в `docker-compose.vss-demiurge.yml` использовал команду `pg_isready -U vss` без указания базы данных. По умолчанию `pg_isready` пытается подключиться к базе данных с именем пользователя (в данном случае "vss"), которая не существует. Правильная база данных называется `vss_db`.

## Решение

### Изменение в docker-compose.vss-demiurge.yml

**Было:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U vss"]
```

**Стало:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U vss -d vss_db"]
```

## Проверка

После пересоздания контейнера PostgreSQL:
- ✅ Healthcheck использует правильную базу данных
- ✅ Ошибки "database does not exist" больше не появляются
- ✅ Все сервисы подключаются к базе `vss_db` корректно

## База данных

- **Имя базы данных:** `vss_db`
- **Пользователь:** `vss`
- **Пароль:** `vss_postgres_pass` (или из переменной `DB_PASSWORD`)
- **Порт:** `5432`

## Проверка подключения

```powershell
# Проверить доступность базы данных
docker exec vss-postgres psql -U vss -d vss_db -c "SELECT 1;"

# Проверить healthcheck
docker exec vss-postgres pg_isready -U vss -d vss_db

# Проверить список баз данных
docker exec vss-postgres psql -U vss -l
```

## Статус

✅ Проблема решена
✅ Healthcheck исправлен
✅ Контейнер пересоздан с правильной конфигурацией

