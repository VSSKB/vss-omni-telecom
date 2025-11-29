# VSS OTTB Database Migrations

## Обзор

Эта директория содержит миграции базы данных для системы VSS OTTB.

## Структура миграций

- `001_v2_role_system.sql` - Система ролей и прав доступа (RBAC)
- `002_f_flow_system.sql` - Полная система F-Flow потоков (F-01 до F-14)

## Применение миграций

### Автоматическое применение (рекомендуется)

Миграции применяются автоматически при первом запуске PostgreSQL контейнера через `docker-compose`.

### Ручное применение

Если нужно применить миграции вручную:

```bash
# Подключиться к контейнеру PostgreSQL
docker exec -it vss-postgres psql -U vss -d vss_db

# Или применить миграцию напрямую
docker exec -i vss-postgres psql -U vss -d vss_db < database/migrations/002_f_flow_system.sql
```

### Проверка статуса миграций

```sql
-- Проверить существование таблиц F-Flow
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'f_flow%' 
  OR table_name LIKE 'gacs%' 
  OR table_name LIKE 'autodialer%' 
  OR table_name LIKE 'cdr%' 
  OR table_name LIKE 'call_recordings%'
ORDER BY table_name;
```

## Описание миграций

### 002_f_flow_system.sql

Эта миграция создаёт полную систему для поддержки всех F-Flow потоков:

#### Таблицы:

1. **f_flow_events** - Трекинг всех F-Flow событий (F-01 до F-14)
2. **gacs_scripts** - GACS скрипты (F-02)
3. **autodialer_leads** - Лиды для автодозвона (F-01)
4. **cdr_records** - CDR записи из SIP Trunk (F-13)
5. **call_recordings** - Записи звонков (F-14)
6. **rtmp_streams** - RTMP потоки (F-04)
7. **slot_status_history** - История статусов слотов (F-05)
8. **drp_operations** - DRP операции (F-06)
9. **notifications** - Уведомления и алерты (F-07)
10. **chat_messages** - Сообщения чата (F-09)
11. **sip_registrations** - SIP регистрации (F-09)
12. **campaigns** - Кампании автодозвона (F-11)

#### Индексы:

Все таблицы имеют оптимизированные индексы для быстрого поиска по:
- `slot_id`
- `call_id`
- `status`
- `created_at`
- `flow_number` (для f_flow_events)

## Откат миграций

⚠️ **Внимание:** Откат миграций не рекомендуется в production окружении.

Для отката миграции `002_f_flow_system.sql`:

```sql
-- Удалить все таблицы F-Flow системы
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS sip_registrations CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS drp_operations CASCADE;
DROP TABLE IF EXISTS slot_status_history CASCADE;
DROP TABLE IF EXISTS rtmp_streams CASCADE;
DROP TABLE IF EXISTS call_recordings CASCADE;
DROP TABLE IF EXISTS cdr_records CASCADE;
DROP TABLE IF EXISTS autodialer_leads CASCADE;
DROP TABLE IF EXISTS gacs_scripts CASCADE;
DROP TABLE IF EXISTS f_flow_events CASCADE;
```

## Версионирование

Миграции должны быть идемпотентными (можно применять несколько раз без ошибок).

Используйте `CREATE TABLE IF NOT EXISTS` и `CREATE INDEX IF NOT EXISTS` для обеспечения идемпотентности.

## Следующие шаги

После применения миграций:

1. Проверьте, что все таблицы созданы
2. Убедитесь, что индексы созданы
3. Проверьте работу сервисов OTTB, DCI, WORKSPACE
4. Проверьте подключение к RabbitMQ и публикацию F-Flow событий

---

**Версия:** 1.0  
**Дата:** 2025-01-XX

