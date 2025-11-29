# Инструкция по запуску VSS DEMIURGE

## Проблема: Сервисы недоступны

Если все сервисы показывают "недоступно", выполните следующие шаги:

## 1. Остановите все контейнеры

```powershell
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
```

## 2. Пересоберите образы с исправленными зависимостями

```powershell
docker-compose -f docker-compose.vss-demiurge.yml build --no-cache
```

## 3. Запустите все сервисы

```powershell
docker-compose -f docker-compose.vss-demiurge.yml up -d
```

## 4. Проверьте статус

```powershell
docker-compose -f docker-compose.vss-demiurge.yml ps
```

## 5. Проверьте логи, если что-то не работает

```powershell
# Все логи
docker-compose -f docker-compose.vss-demiurge.yml logs

# Конкретный сервис
docker-compose -f docker-compose.vss-demiurge.yml logs vss-workspace
docker-compose -f docker-compose.vss-demiurge.yml logs vss-ottb
```

## 6. Доступ к сервисам

После успешного запуска все сервисы будут доступны через Nginx на порту 80:

- **Главная страница (Dashboard):** http://localhost/
- **API Workspace:** http://localhost/api/workspace/
- **API OTTB:** http://localhost/api/ottb/
- **API DCI:** http://localhost/api/dci/
- **API POINT:** http://localhost/api/point/
- **Guacamole:** http://localhost/guacamole/

### Прямой доступ (если нужен)

- **Workspace:** http://localhost:3000
- **OTTB:** http://localhost:8083
- **DCI:** http://localhost:8082
- **POINT:** http://localhost:8081
- **Guacamole:** http://localhost:8080/guacamole
- **RabbitMQ:** http://localhost:15672
- **Grafana:** http://localhost:3001
- **Prometheus:** http://localhost:9090

## Исправленные проблемы

1. ✅ Добавлен `uuid` в зависимости `services/ottb/package.json`
2. ✅ Добавлен `uuid` в зависимости `services/dci/package.json`
3. ✅ Добавлен Nginx для frontend и проксирования API
4. ✅ Исправлен Guacamole (используется официальный образ)
5. ✅ Все сервисы теперь доступны через единый порт 80

## Если проблемы остаются

1. Проверьте, что порты не заняты другими приложениями
2. Проверьте логи контейнеров на наличие ошибок
3. Убедитесь, что Docker Desktop запущен
4. Попробуйте перезапустить Docker Desktop

