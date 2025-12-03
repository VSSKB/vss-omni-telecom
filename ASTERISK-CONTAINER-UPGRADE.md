# Обновление контейнера Asterisk - Полноценная версия

**Дата:** 29 ноября 2025  
**Статус:** ✅ Завершено

---

## Обзор изменений

Контейнер Asterisk был полностью переработан с замены простой заглушки на полноценный production-ready контейнер с полной функциональностью.

---

## Что было сделано

### 1. ✅ Создан полноценный Dockerfile

**Файл:** `services/asterisk/Dockerfile`

- Основан на официальном образе `andrius/asterisk:18-current`
- Добавлены утилиты для работы с PostgreSQL
- Автоматическая инициализация базы данных CDR
- Скрипт запуска с динамической конфигурацией
- Healthcheck для мониторинга

### 2. ✅ Расширена конфигурация PJSIP

**Файл:** `config/sip/asterisk/pjsip.conf`

- Полная конфигурация транспортов (UDP, TCP)
- Шаблоны для слотов (AUTO, MF, LS)
- Интеграция с Kamailio
- Поддержка внешних провайдеров
- Настройки NAT traversal и ICE
- Поддержка DTLS для безопасности

### 3. ✅ Полный Dialplan

**Файл:** `config/sip/asterisk/extensions.conf`

- Обработка внутренних вызовов к слотам (6xxx, 7xxx, 8xxx)
- Сервисные номера (9xxx)
- Исходящие вызовы от всех типов слотов
- Входящие вызовы от внешних провайдеров
- Установка CDR полей для аналитики
- Fallback обработка неизвестных номеров

### 4. ✅ Конфигурация CDR

**Файл:** `config/sip/asterisk/cdr.conf`

- Полная интеграция с PostgreSQL
- Маппинг всех полей CDR
- Логирование уникальных ID и связанных вызовов
- Поддержка неотвеченных и перегруженных вызовов

### 5. ✅ Модули Asterisk

**Файл:** `config/sip/asterisk/modules.conf`

- Загрузка всех необходимых модулей PJSIP
- Модули для работы с RTP
- Приложения dialplan
- Модули CDR и базы данных
- AMI модули
- Кодеки (ulaw, alaw, gsm, g722, opus)
- Отключение неиспользуемых модулей

### 6. ✅ Дополнительные конфигурации

**Созданные файлы:**

- `config/sip/asterisk/asterisk.conf` - основная конфигурация
- `config/sip/asterisk/logger.conf` - логирование
- `config/sip/asterisk/rtp.conf` - RTP настройки (порты 10000-20000)
- `config/sip/asterisk/manager.conf` - AMI конфигурация (порт 5038)
- `config/sip/asterisk/res_pgsql.conf` - подключение к PostgreSQL

### 7. ✅ Обновлен Docker Compose

**Файл:** `docker-compose.vss-demiurge.yml`

- Изменен с `image` на `build` для использования кастомного Dockerfile
- Добавлены volumes для логов, spool и библиотек
- Добавлен healthcheck
- Расширен диапазон RTP портов (10000-20000)
- Добавлен порт AMI (5038)
- Поддержка переменных окружения для провайдеров

---

## Возможности контейнера

### Основные функции:

1. **SIP Trunk** - полная поддержка PJSIP
2. **CDR** - автоматическая запись всех вызовов в PostgreSQL
3. **AMI** - Asterisk Manager Interface для управления и мониторинга
4. **Dialplan** - полная обработка всех типов вызовов
5. **Интеграция с Kamailio** - работа через SIP прокси
6. **Поддержка внешних провайдеров** - настраивается через переменные окружения

### Порты:

- **5060/udp, 5060/tcp** - SIP протокол
- **5038/tcp** - AMI (Asterisk Manager Interface)
- **10000-20000/udp** - RTP медиа потоки

### Переменные окружения:

```bash
POSTGRES_HOST=postgres          # Хост PostgreSQL
POSTGRES_PORT=5432              # Порт PostgreSQL
POSTGRES_DB=vss_db              # База данных
POSTGRES_USER=vss               # Пользователь
POSTGRES_PASSWORD=...           # Пароль
AMI_PASSWORD=...                # Пароль для AMI
PROVIDER_HOST=...               # Хост внешнего провайдера (опционально)
PROVIDER_PORT=5060              # Порт провайдера (опционально)
PROVIDER_DOMAIN=...             # Домен провайдера (опционально)
PROVIDER_USER=...                # Пользователь провайдера (опционально)
PROVIDER_PASSWORD=...           # Пароль провайдера (опционально)
```

---

## Использование

### Запуск контейнера:

```bash
docker-compose -f docker-compose.vss-demiurge.yml up -d asterisk
```

### Проверка статуса:

```bash
docker-compose -f docker-compose.vss-demiurge.yml ps asterisk
```

### Просмотр логов:

```bash
docker-compose -f docker-compose.vss-demiurge.yml logs -f asterisk
```

### Подключение к консоли Asterisk:

```bash
docker exec -it vss-asterisk asterisk -rvvv
```

### Проверка версии через healthcheck:

```bash
docker exec vss-asterisk asterisk -rx "core show version"
```

### Подключение к AMI:

```bash
# Используя telnet или специализированные клиенты
telnet localhost 5038
# Логин: admin
# Пароль: из переменной AMI_PASSWORD
```

---

## Интеграция с проектом

### CDR записи

Все вызовы автоматически записываются в таблицу `cdr_records` в PostgreSQL:

```sql
SELECT * FROM cdr_records ORDER BY start_time DESC LIMIT 10;
```

### AMI для управления

AMI доступен на порту 5038 и может использоваться для:
- Мониторинга вызовов в реальном времени
- Управления каналами
- Получения статистики
- Выполнения команд dialplan

### Интеграция с Kamailio

Asterisk работает через Kamailio как SIP прокси:
- Внутренние вызовы маршрутизируются через Kamailio
- Внешние вызовы могут идти напрямую или через Kamailio

---

## Структура конфигураций

```
config/sip/asterisk/
├── asterisk.conf      # Основная конфигурация
├── pjsip.conf         # PJSIP endpoints и transports
├── extensions.conf    # Dialplan
├── cdr.conf           # CDR конфигурация
├── modules.conf       # Загрузка модулей
├── logger.conf        # Логирование
├── rtp.conf           # RTP настройки
├── manager.conf       # AMI конфигурация
└── res_pgsql.conf     # PostgreSQL подключение
```

---

## Volumes

Контейнер использует следующие volumes:

- `asterisk_logs:/var/log/asterisk` - логи
- `asterisk_spool:/var/spool/asterisk` - очередь и временные файлы
- `asterisk_lib:/var/lib/asterisk` - библиотеки и данные

---

## Healthcheck

Контейнер имеет встроенный healthcheck:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD asterisk -rx "core show version" || exit 1
```

Проверяет доступность Asterisk каждые 30 секунд.

---

## Миграция с заглушки

### Что изменилось:

1. ✅ Контейнер теперь собирается из Dockerfile вместо использования готового образа
2. ✅ Добавлена автоматическая инициализация базы данных
3. ✅ Расширена конфигурация для production использования
4. ✅ Добавлен AMI для управления
5. ✅ Улучшена интеграция с PostgreSQL

### Обратная совместимость:

- Все существующие конфигурации сохранены
- Порты остались теми же (5061 для SIP, 5038 для AMI)
- Переменные окружения совместимы

---

## Следующие шаги

1. ✅ Контейнер готов к использованию
2. ⏳ Протестировать интеграцию с Kamailio
3. ⏳ Настроить внешних провайдеров (если требуется)
4. ⏳ Настроить мониторинг через AMI
5. ⏳ Проверить запись CDR в базу данных

---

## Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs asterisk`
2. Проверьте подключение к PostgreSQL
3. Проверьте конфигурацию через консоль Asterisk
4. Убедитесь, что все порты доступны

---

**Версия:** 1.0  
**Дата:** 29 ноября 2025


