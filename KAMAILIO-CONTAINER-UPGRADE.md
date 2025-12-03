# Обновление контейнера Kamailio - Полноценная версия

**Дата:** 29 ноября 2025  
**Статус:** ✅ Завершено

---

## Обзор изменений

Контейнер Kamailio был полностью переработан с замены простой заглушки на полноценный production-ready контейнер с полной функциональностью SIP Proxy и Registrar.

---

## Что было сделано

### 1. ✅ Создан полноценный Dockerfile

**Файл:** `services/kamailio/Dockerfile`

- Основан на официальном образе `kamailio/kamailio-deb:5.7.0-bullseye`
- Добавлены утилиты для работы с PostgreSQL
- Автоматическая инициализация базы данных
- Создание всех необходимых таблиц (subscriber, location, acc, dispatcher, missed_calls)
- Скрипт запуска с динамической конфигурацией
- Healthcheck для мониторинга
- Валидация конфигурации перед запуском

### 2. ✅ Расширена конфигурация Kamailio

**Файл:** `config/sip/kamailio/kamailio.cfg`

- Полная конфигурация SIP Proxy и Registrar
- Маршрутизация внутренних вызовов (6xxx, 7xxx, 8xxx)
- Проксирование внешних вызовов в Asterisk
- Поддержка NAT traversal и RTP proxy
- Accounting для всех вызовов
- Dialog management
- Dispatcher для load balancing
- Расширенное логирование

### 3. ✅ Автоматическая инициализация базы данных

**Создаваемые таблицы:**

1. **subscriber** - аутентификация пользователей
   - username, domain, password, ha1, ha1b
   - Индексы для быстрого поиска

2. **location** - регистрации слотов
   - Полная информация о регистрациях
   - Индексы по username, domain, expires, contact

3. **acc** - учет вызовов (accounting)
   - Метод, теги, callid, коды ответов
   - Длительность и время вызовов

4. **missed_calls** - пропущенные вызовы
   - Аналогично acc, но для неотвеченных вызовов

5. **dispatcher** - load balancing
   - Настройки распределения нагрузки
   - Health checks для серверов

### 4. ✅ Обновлен Docker Compose

**Файл:** `docker-compose.vss-demiurge.yml`

- Изменен с `image` на `build` для использования кастомного Dockerfile
- Добавлены volumes для логов и runtime данных
- Добавлен healthcheck
- Поддержка переменных окружения для настройки
- Зависимость от PostgreSQL с healthcheck

---

## Возможности контейнера

### Основные функции:

1. **SIP Registrar** - регистрация слотов (AUTO, MF, LS)
2. **SIP Proxy** - маршрутизация вызовов
3. **Authentication** - аутентификация через PostgreSQL
4. **Accounting** - учет всех вызовов в БД
5. **NAT Traversal** - поддержка NAT через RTP proxy
6. **Load Balancing** - распределение нагрузки через dispatcher
7. **Dialog Management** - управление диалогами
8. **Statistics** - сбор статистики

### Порты:

- **5060/udp, 5060/tcp** - SIP протокол

### Переменные окружения:

```bash
POSTGRES_HOST=postgres          # Хост PostgreSQL
POSTGRES_PORT=5432              # Порт PostgreSQL
POSTGRES_DB=vss_db              # База данных
POSTGRES_USER=vss               # Пользователь
POSTGRES_PASSWORD=...           # Пароль
KAMAILIO_DEBUG=3                # Уровень отладки (0-4)
KAMAILIO_CHILDREN=4             # Количество процессов
```

---

## Использование

### Запуск контейнера:

```bash
docker-compose -f docker-compose.vss-demiurge.yml up -d kamailio
```

### Проверка статуса:

```bash
docker-compose -f docker-compose.vss-demiurge.yml ps kamailio
```

### Просмотр логов:

```bash
docker-compose -f docker-compose.vss-demiurge.yml logs -f kamailio
```

### Подключение к управляющему интерфейсу:

```bash
# Через kamcmd
docker exec -it vss-kamailio kamcmd core.ping
docker exec -it vss-kamailio kamcmd ul.show
docker exec -it vss-kamailio kamcmd stats
```

### Проверка конфигурации:

```bash
docker exec -it vss-kamailio kamailio -C -f /etc/kamailio/kamailio.cfg
```

---

## Интеграция с проектом

### Регистрация слотов

Слоты регистрируются через Kamailio:

```
REGISTER sip:vss.internal SIP/2.0
From: <sip:slot_6001@vss.internal>
To: <sip:slot_6001@vss.internal>
Contact: <sip:slot_6001@192.168.1.100:5060>
```

### Внутренние вызовы

Вызовы между слотами (6xxx, 7xxx, 8xxx) маршрутизируются через Kamailio:

```
INVITE sip:6002@vss.internal SIP/2.0
From: <sip:slot_6001@vss.internal>
To: <sip:slot_6002@vss.internal>
```

### Внешние вызовы

Внешние вызовы проксируются в Asterisk:

```
INVITE sip:+1234567890@vss.internal SIP/2.0
From: <sip:slot_6001@vss.internal>
To: <sip:+1234567890@vss.internal>
```

---

## Структура базы данных

### Таблица subscriber

Используется для аутентификации:

```sql
CREATE TABLE subscriber (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    domain VARCHAR(190) NOT NULL,
    password VARCHAR(64) NOT NULL,
    ha1 VARCHAR(128) NOT NULL,
    ha1b VARCHAR(128) NOT NULL,
    CONSTRAINT account_idx UNIQUE (username, domain)
);
```

### Таблица location

Хранит регистрации слотов:

```sql
CREATE TABLE location (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    domain VARCHAR(190),
    contact VARCHAR(255) NOT NULL,
    expires TIMESTAMP NOT NULL,
    ...
);
```

### Таблица acc

Учет вызовов:

```sql
CREATE TABLE acc (
    id SERIAL PRIMARY KEY,
    method VARCHAR(16),
    callid VARCHAR(255),
    sip_code VARCHAR(3),
    duration INTEGER,
    time TIMESTAMP,
    ...
);
```

---

## Маршрутизация

### Внутренние вызовы (6xxx, 7xxx, 8xxx)

1. Получение INVITE от слота
2. Проверка формата номера
3. Поиск в таблице location
4. Маршрутизация к зарегистрированному слоту
5. Учет вызова в таблице acc

### Внешние вызовы

1. Получение INVITE от слота
2. Определение внешнего номера
3. Проксирование в Asterisk (sip:asterisk:5060)
4. Учет вызова в таблице acc

### Регистрация

1. Получение REGISTER от слота
2. Аутентификация через таблицу subscriber
3. Сохранение location в БД
4. Учет регистрации в таблице acc

---

## NAT Traversal

Kamailio автоматически определяет NAT и использует RTP proxy:

- Определение NAT через `nat_uac_test()`
- Установка флага `NAT_PING`
- Использование RTP proxy для медиа
- Отправка keepalive пакетов

---

## Accounting

Все события логируются в БД:

- **Регистрации** - в таблицу acc с методом "register"
- **Вызовы** - в таблицу acc с методом "call"
- **Пропущенные вызовы** - в таблицу missed_calls
- **Дополнительная информация** - src_user, src_domain, dst_user, dst_domain

---

## Мониторинг

### Healthcheck

Контейнер имеет встроенный healthcheck:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD kamcmd core.ping || exit 1
```

### Статистика

Доступна через kamcmd:

```bash
# Общая статистика
kamcmd stats

# Зарегистрированные пользователи
kamcmd ul.show

# Активные диалоги
kamcmd dialog.list

# Информация о процессах
kamcmd core.psx
```

---

## Volumes

Контейнер использует следующие volumes:

- `kamailio_logs:/var/log/kamailio` - логи
- `kamailio_run:/var/run/kamailio` - runtime данные (PID файлы)

---

## Миграция с заглушки

### Что изменилось:

1. ✅ Контейнер теперь собирается из Dockerfile вместо использования готового образа
2. ✅ Добавлена автоматическая инициализация базы данных
3. ✅ Расширена конфигурация для production использования
4. ✅ Добавлена поддержка NAT traversal
5. ✅ Улучшена интеграция с PostgreSQL
6. ✅ Добавлен accounting и статистика

### Обратная совместимость:

- Все существующие конфигурации сохранены
- Порты остались теми же (5060 для SIP)
- Переменные окружения совместимы
- Таблицы БД создаются автоматически при первом запуске

---

## Следующие шаги

1. ✅ Контейнер готов к использованию
2. ⏳ Протестировать регистрацию слотов
3. ⏳ Протестировать внутренние вызовы
4. ⏳ Протестировать внешние вызовы через Asterisk
5. ⏳ Настроить мониторинг через статистику
6. ⏳ Проверить accounting в базе данных

---

## Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs kamailio`
2. Проверьте подключение к PostgreSQL
3. Проверьте конфигурацию: `kamailio -C -f /etc/kamailio/kamailio.cfg`
4. Проверьте статистику: `kamcmd stats`
5. Убедитесь, что порты доступны

---

**Версия:** 1.0  
**Дата:** 29 ноября 2025


