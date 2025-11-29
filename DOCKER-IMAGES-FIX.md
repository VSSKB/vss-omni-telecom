# Исправление проблем с Docker образами

## Проблема

При запуске `docker-compose.vss-demiurge.yml` возникают ошибки:
```
kamailio Error pull access denied for kamailio/kamailio, repository does not exist
asterisk Error pull access denied for andrius/asterisk:18-current
nginx-rtmp Error pull access denied for tiangolo/nginx-rtmp
```

## Решение

### Вариант 1: Использовать упрощенную версию (рекомендуется для быстрого старта)

Используйте `docker-compose.vss-demiurge-simple.yml`, которая не включает Kamailio и Asterisk:

```bash
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d
```

Эта версия включает только:
- RabbitMQ
- PostgreSQL
- Redis
- Core Services (OTTB, DCI, POINT, WORKSPACE)
- Guacamole
- Nginx (frontend)

### Вариант 2: Исправить образы в полной версии

Я создал Dockerfile для Kamailio и Asterisk. Для их использования:

1. **Соберите образы вручную:**
   ```bash
   # Kamailio
   docker build -f services/kamailio/Dockerfile -t vss-kamailio:latest .
   
   # Asterisk
   docker build -f services/asterisk/Dockerfile -t vss-asterisk:latest .
   ```

2. **Обновите docker-compose.vss-demiurge.yml:**
   Замените `build:` на `image:` с вашими собранными образами:
   ```yaml
   kamailio:
     image: vss-kamailio:latest
     # ...
   
   asterisk:
     image: vss-asterisk:latest
     # ...
   ```

3. **Исправьте nginx-rtmp:**
   Образ `tiangolo/nginx-rtmp` заменен на `alfg/nginx-rtmp:latest` в docker-compose.

### Вариант 3: Использовать альтернативные образы

**Kamailio:**
```yaml
kamailio:
  image: kamailio/kamailio-deb:5.7.0-bullseye
  # или
  image: kamailio/kamailio:latest
```

**Asterisk:**
```yaml
asterisk:
  image: andrius/asterisk:18-current
  # или
  image: andrius/asterisk:latest
  # или официальный образ
  image: asterisk/asterisk:18-current
```

**Nginx-RTMP:**
```yaml
nginx-rtmp:
  image: alfg/nginx-rtmp:latest
  # или
  image: tiangolo/nginx-rtmp:latest
```

## Быстрый старт без SIP

Если вам не нужна SIP функциональность сразу, используйте упрощенную версию:

```bash
# Запустить упрощенную версию
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d

# Проверить статус
docker-compose -f docker-compose.vss-demiurge-simple.yml ps

# Просмотреть логи
docker-compose -f docker-compose.vss-demiurge-simple.yml logs -f
```

## Автоматическое переключение

`server.js` автоматически переключается на упрощенную версию, если полная версия недоступна.

## Проверка доступности образов

Проверьте, какие образы доступны:

```bash
# Kamailio
docker search kamailio

# Asterisk
docker search asterisk

# Nginx-RTMP
docker search nginx-rtmp
```

## Рекомендации

1. **Для разработки:** Используйте `docker-compose.vss-demiurge-simple.yml`
2. **Для продакшена:** Соберите собственные образы Kamailio и Asterisk с нужными модулями
3. **Для тестирования SIP:** Используйте готовые образы из Docker Hub после проверки их доступности

---

**Статус:** ✅ Создана упрощенная версия docker-compose без Kamailio и Asterisk

