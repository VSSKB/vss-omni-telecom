# Исправление проблем с Docker образами

## Проблема

При запуске `docker-compose.vss-demiurge.yml` возникают ошибки:
```
kamailio Error pull access denied for kamailio/kamailio, repository does not exist
asterisk Error pull access denied for andrius/asterisk:18-current
nginx-rtmp Error pull access denied for tiangolo/nginx-rtmp
```

## ✅ Решение

### Вариант 1: Использовать упрощенную версию (рекомендуется)

Создана упрощенная версия `docker-compose.vss-demiurge-simple.yml`, которая не включает Kamailio и Asterisk:

```bash
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d
```

**Включает:**
- ✅ RabbitMQ
- ✅ PostgreSQL
- ✅ Redis
- ✅ Core Services (OTTB, DCI, POINT, WORKSPACE)
- ✅ Guacamole
- ✅ Nginx (frontend)

**Не включает:**
- ❌ Kamailio (SIP Registrar/Proxy)
- ❌ Asterisk (SIP Media Server)
- ❌ Nginx-RTMP (для RTMP потоков)

### Вариант 2: Автоматическое переключение

`server.js` автоматически переключается на упрощенную версию, если полная версия недоступна.

### Вариант 3: Исправить образы в полной версии

Я создал Dockerfile для Kamailio и Asterisk. Для их использования:

1. **Соберите образы:**
   ```bash
   # Kamailio
   docker build -f services/kamailio/Dockerfile -t vss-kamailio:latest .
   
   # Asterisk
   docker build -f services/asterisk/Dockerfile -t vss-asterisk:latest .
   ```

2. **Обновите docker-compose.vss-demiurge.yml:**
   Замените `build:` на `image:`:
   ```yaml
   kamailio:
     image: vss-kamailio:latest
   
   asterisk:
     image: vss-asterisk:latest
   ```

3. **Nginx-RTMP уже исправлен:**
   Образ заменен на `alfg/nginx-rtmp:latest`

## Быстрый старт

```bash
# Запустить упрощенную версию
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d

# Проверить статус
docker-compose -f docker-compose.vss-demiurge-simple.yml ps

# Просмотреть логи
docker-compose -f docker-compose.vss-demiurge-simple.yml logs -f
```

## Что дальше?

1. **Для разработки:** Используйте упрощенную версию
2. **Для SIP функциональности:** Соберите образы Kamailio и Asterisk или используйте альтернативные образы из Docker Hub
3. **Для продакшена:** Создайте собственные образы с нужными модулями

---

**Статус:** ✅ Создана упрощенная версия и автоматическое переключение

