# Исправление ошибки сборки Kamailio

## Проблема

При запуске `docker-compose.vss-demiurge.yml` возникает ошибка сборки образа Kamailio:
```
failed to solve: process "/bin/sh -c apt-get update && apt-get install -y kamailio..." did not complete successfully: exit code: 100
```

## Решение

### Вариант 1: Использование готового образа (реализовано)

В `docker-compose.vss-demiurge.yml` теперь используется готовый образ:
```yaml
kamailio:
  image: kamailio/kamailio-deb:5.7.0-bullseye
```

### Вариант 2: Автоматическое переключение на упрощенную версию

Если сборка Kamailio/Asterisk не удается, система автоматически переключается на `docker-compose.vss-demiurge-simple.yml` (без Kamailio и Asterisk).

### Вариант 3: Исправленный Dockerfile (для ручной сборки)

Если нужно собрать образ вручную, используйте исправленный Dockerfile с правильными репозиториями:

```dockerfile
FROM debian:bullseye-slim

# Добавление репозитория Kamailio
RUN apt-get update && apt-get install -y \
    gnupg2 \
    curl \
    ca-certificates \
    && echo "deb http://deb.kamailio.org/kamailio57 bullseye main" > /etc/apt/sources.list.d/kamailio.list \
    && curl -o /tmp/kamailio.gpg http://deb.kamailio.org/kamailiodebkey.gpg \
    && apt-key add /tmp/kamailio.gpg \
    && rm /tmp/kamailio.gpg \
    && apt-get update && apt-get install -y \
    kamailio \
    kamailio-mysql-modules \
    kamailio-postgres-modules \
    kamailio-tls-modules \
    kamailio-utils-modules \
    kamailio-xml-modules \
    kamailio-presence-modules \
    kamailio-json-modules \
    && rm -rf /var/lib/apt/lists/*

COPY config/sip/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg

EXPOSE 5060/udp 5060/tcp

CMD ["kamailio", "-f", "/etc/kamailio/kamailio.cfg", "-DD", "-E"]
```

## Рекомендации

1. **Для быстрого старта:** Используйте упрощенную версию (`docker-compose.vss-demiurge-simple.yml`)
2. **Для полной функциональности:** Используйте готовые образы Kamailio и Asterisk
3. **Для кастомизации:** Соберите образы вручную с исправленными Dockerfile

## Принудительное использование упрощенной версии

Установите переменную окружения:
```bash
export VSS_USE_SIMPLE=true
# или в Windows PowerShell
$env:VSS_USE_SIMPLE="true"
```

---

**Версия:** 1.0  
**Дата:** 2025-01-XX

