# Исправление проблемы безопасности Redis

## Дата: 2025-11-29

## Проблема

Redis выдавал предупреждения о возможной атаке безопасности:
```
Possible SECURITY ATTACK detected. It looks like somebody is sending POST or Host: commands to Redis.
This is likely due to an attacker attempting to use Cross Protocol Scripting to compromise your Redis instance.
Connection from 172.19.0.1:38210 aborted.
```

## Причина

1. **Порт 6379 был открыт наружу** - Redis был доступен извне через `0.0.0.0:6379`
2. **Отсутствие защиты** - `protected-mode` был отключен
3. **Отсутствие пароля** - пароль не был установлен
4. **HTTP-запросы вместо Redis протокола** - кто-то пытался подключиться к Redis через HTTP (POST/Host команды)

## Решение

### 1. Закрытие порта наружу
**Файл**: `docker-compose.vss-demiurge-simple.yml`

Закомментирован проброс порта 6379 наружу:
```yaml
# Port not exposed externally - only accessible within Docker network
# ports:
#   - "6379:6379"
```

Теперь Redis доступен только внутри Docker сети `vss-network`.

### 2. Включение protected-mode
**Файл**: `config/redis/redis.conf`

Изменено:
```conf
# Было:
protected-mode no

# Стало:
protected-mode yes
```

### 3. Установка пароля
**Файл**: `config/redis/redis.conf`

Раскомментирован и установлен пароль:
```conf
# Было:
# requirepass vss_redis_pass  # Uncomment and set password in production

# Стало:
requirepass vss_redis_pass
```

### 4. Обновление healthcheck
**Файл**: `docker-compose.vss-demiurge-simple.yml`

Обновлен healthcheck для использования пароля:
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-vss_redis_pass}", "ping"]
```

## Результат

✅ **Порт больше не открыт наружу** - Redis доступен только внутри Docker сети
✅ **Protected-mode включен** - дополнительная защита от несанкционированного доступа
✅ **Пароль установлен** - требуется аутентификация для подключения
✅ **Предупреждения исчезли** - больше нет сообщений о SECURITY ATTACK в логах

## Подключение сервисов

Сервисы продолжают подключаться к Redis через Docker сеть:
- URL: `redis://:vss_redis_pass@redis:6379`
- Доступно только внутри сети `vss-network`
- Не требует открытия порта наружу

## Проверка

Для проверки безопасности используйте скрипт:
```powershell
powershell -ExecutionPolicy Bypass -File fix-redis-security.ps1
```

Или проверьте вручную:
```bash
# Проверить, что порт не открыт наружу
docker ps --filter "name=vss-redis" --format "{{.Ports}}"

# Проверить подключение с паролем
docker exec vss-redis redis-cli -a vss_redis_pass ping

# Проверить логи на наличие предупреждений
docker logs vss-redis --tail 50 | grep -i "SECURITY"
```

## Файлы изменены

1. `docker-compose.vss-demiurge-simple.yml` - закрыт порт 6379 наружу, обновлен healthcheck
2. `config/redis/redis.conf` - включен protected-mode, установлен пароль

## Новые файлы

1. `fix-redis-security.ps1` - скрипт для проверки безопасности Redis
2. `REDIS-SECURITY-FIX-SUMMARY.md` - данный отчет

## Рекомендации

1. ✅ **Не открывайте порт Redis наружу** - используйте только внутреннюю Docker сеть
2. ✅ **Всегда используйте пароль** - даже в development окружении
3. ✅ **Включите protected-mode** - дополнительная защита
4. ✅ **Мониторьте логи** - следите за предупреждениями безопасности
5. ✅ **Используйте firewall** - дополнительная защита на уровне хоста

## Итог

Проблема безопасности Redis решена. Redis теперь:
- Доступен только внутри Docker сети
- Защищен паролем
- Имеет включенный protected-mode
- Не выдает предупреждения о безопасности

Все сервисы продолжают работать нормально, подключаясь к Redis через внутреннюю сеть Docker.

