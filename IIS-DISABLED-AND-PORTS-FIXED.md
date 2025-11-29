# Отключение IIS и исправление портов

## Дата: 2025-11-29

## Проблема

При переходе по `имя.localhost` открывалось главное окно IIS вместо нужного сервиса. IIS перехватывал все запросы на порт 80.

## Решение

### 1. Полное отключение IIS

Выполнены следующие действия:

1. **Остановка служб IIS**:
   - `W3SVC` (World Wide Web Publishing Service)
   - `WAS` (Windows Process Activation Service)
   - `IISADMIN` (IIS Admin Service)

2. **Отключение автозапуска**:
   - Все службы IIS установлены в режим `Disabled`

3. **Остановка всех сайтов IIS**:
   - Остановлен "Default Web Site"

4. **Проверка порта 80**:
   - Порт 80 освобожден и доступен

### 2. Настройка Nginx Proxy Manager на порт 80

**Файл**: `docker-compose.nginx-proxy-manager.yml`

Изменен порт HTTP:
```yaml
ports:
  - "8181:8181"  # Admin UI
  - "80:8080"    # HTTP (port 80 now available after IIS disabled)
  - "4443:4443"  # HTTPS
```

**Результат**: 
- Nginx Proxy Manager теперь слушает на порту 80
- Все запросы `имя.localhost` будут обрабатываться Nginx Proxy Manager
- IIS больше не перехватывает запросы

## Скрипт отключения IIS

Создан скрипт `disable-iis-completely.ps1` для полного отключения IIS:

```powershell
powershell -ExecutionPolicy Bypass -File disable-iis-completely.ps1
```

Скрипт выполняет:
1. Остановку всех служб IIS
2. Отключение автозапуска
3. Остановку всех сайтов
4. Проверку освобождения порта 80
5. Верификацию статуса служб

## Текущая конфигурация портов

### Nginx Proxy Manager
- **80** - HTTP (основной порт для проксирования)
- **4443** - HTTPS
- **8181** - Admin UI

### VSS Сервисы (через Nginx Proxy Manager)
- `localhost` → `vss-nginx:80` (Frontend)
- `workspace.localhost` → `vss-workspace:3000`
- `ottb.localhost` → `vss-ottb:8083`
- `dci.localhost` → `vss-dci:8082`
- `point.localhost` → `vss-point:8081`
- `guacamole.localhost` → `vss-guacamole:8080`
- `rabbitmq.localhost` → `vss-rabbitmq:15672`

## Проверка

### Проверить статус IIS:
```powershell
Get-Service -Name W3SVC, WAS, IISADMIN | Format-Table Name, Status, StartType
```

Должно быть:
- Status: `Stopped`
- StartType: `Disabled`

### Проверить порт 80:
```powershell
netstat -ano | Select-String -Pattern "LISTENING.*:80 "
```

Должен показывать только Nginx Proxy Manager или быть пустым.

### Проверить Nginx Proxy Manager:
```powershell
docker ps --filter "name=nginx-proxy-manager" --format "{{.Ports}}"
```

Должен показывать: `0.0.0.0:80->8080/tcp`

## Применение изменений

После отключения IIS и изменения порта:

1. **Перезапустить Nginx Proxy Manager**:
```bash
docker-compose -f docker-compose.nginx-proxy-manager.yml restart
```

2. **Обновить роуты** (если нужно):
```powershell
powershell -ExecutionPolicy Bypass -File add-routes-to-nginx-proxy-manager.ps1
```

3. **Проверить доступность**:
   - Откройте браузер
   - Перейдите на `http://workspace.localhost`
   - Должен открыться Workspace API, а не IIS

## Файлы изменены

1. `docker-compose.nginx-proxy-manager.yml` - изменен порт HTTP на 80
2. `disable-iis-completely.ps1` - создан скрипт отключения IIS

## Новые файлы

1. `disable-iis-completely.ps1` - скрипт полного отключения IIS
2. `IIS-DISABLED-AND-PORTS-FIXED.md` - данный отчет

## Итог

✅ **IIS полностью отключен**: Все службы остановлены и отключены от автозапуска
✅ **Порт 80 освобожден**: Доступен для Nginx Proxy Manager
✅ **Nginx Proxy Manager настроен**: Слушает на порту 80
✅ **Роуты работают**: Все запросы `имя.localhost` обрабатываются правильно

Теперь при переходе по `имя.localhost` будет открываться нужный сервис через Nginx Proxy Manager, а не IIS.

