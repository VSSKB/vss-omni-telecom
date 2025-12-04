# KAMAILIO - Консольные утилиты управления

**Дата:** 2025-12-03  
**Версия Kamailio:** 5.6+  
**Платформа:** Docker / Linux

---

## 🛠️ ОСНОВНЫЕ КОНСОЛЬНЫЕ УТИЛИТЫ KAMAILIO

### 1️⃣ `kamctl` - Главная утилита управления (⭐ РЕКОМЕНДУЕТСЯ)

**Описание:** Основной инструмент для управления Kamailio  
**Использование:** Управление пользователями, мониторинг, диагностика

### 2️⃣ `kamcmd` - Утилита команд RPC

**Описание:** Отправка команд через RPC интерфейс  
**Использование:** Мониторинг в реальном времени, статистика

### 3️⃣ `kamdbctl` - Управление базой данных

**Описание:** Создание и управление БД Kamailio  
**Использование:** Инициализация таблиц, миграции

---

## 🎯 KAMCTL - ОСНОВНАЯ УТИЛИТА (РЕКОМЕНДУЕТСЯ)

### 📋 Базовые команды:

```bash
# Войти в контейнер Kamailio
docker exec -it vss-kamailio bash

# Или выполнить команду напрямую
docker exec vss-kamailio kamctl [команда]
```

---

### 👥 Управление пользователями SIP:

```bash
# Добавить нового SIP пользователя
docker exec vss-kamailio kamctl add <username> <password>
docker exec vss-kamailio kamctl add 97001 secretpass123

# Удалить пользователя
docker exec vss-kamailio kamctl rm <username>
docker exec vss-kamailio kamctl rm 97001

# Изменить пароль
docker exec vss-kamailio kamctl passwd <username> <new_password>
docker exec vss-kamailio kamctl passwd 97001 newpass456

# Показать всех пользователей
docker exec vss-kamailio kamctl db show subscriber

# Показать информацию о пользователе
docker exec vss-kamailio kamctl db show subscriber | grep 97001
```

---

### 📞 Мониторинг регистраций (Location Table):

```bash
# Показать все зарегистрированные устройства
docker exec vss-kamailio kamctl ul show

# Показать детали конкретного пользователя
docker exec vss-kamailio kamctl ul show <username>
docker exec vss-kamailio kamctl ul show 97001

# Количество зарегистрированных устройств
docker exec vss-kamailio kamctl ul showdb

# Удалить регистрацию пользователя
docker exec vss-kamailio kamctl ul rm <username>
```

---

### 📊 Статистика и мониторинг:

```bash
# Общая статистика Kamailio
docker exec vss-kamailio kamctl stats

# Статистика по модулям
docker exec vss-kamailio kamctl fifo get_statistics all

# Количество активных диалогов (звонков)
docker exec vss-kamailio kamctl fifo profile_get_size calls

# Статистика SIP транзакций
docker exec vss-kamailio kamctl fifo get_statistics tm:

# Статистика регистраций
docker exec vss-kamailio kamctl fifo get_statistics usrloc:
```

---

### 🔍 Диагностика и отладка:

```bash
# Проверка конфигурации (без запуска)
docker exec vss-kamailio kamailio -c

# Ping Kamailio (проверка работоспособности)
docker exec vss-kamailio kamctl ping

# Версия Kamailio
docker exec vss-kamailio kamailio -v

# Проверка доступности базы данных
docker exec vss-kamailio kamctl db show version

# Просмотр активных процессов
docker exec vss-kamailio kamctl ps
```

---

### 🔥 Управление сервисом:

```bash
# Перезагрузка конфигурации (без перезапуска)
docker exec vss-kamailio kamctl fifo reload

# Остановка Kamailio
docker exec vss-kamailio kamctl stop

# Restart через Docker
docker restart vss-kamailio
```

---

## ⚡ KAMCMD - RPC КОМАНДЫ (Для мониторинга в реальном времени)

### 📊 Мониторинг:

```bash
# Проверка статуса ядра
docker exec vss-kamailio kamcmd core.echo "test"
docker exec vss-kamailio kamcmd core.version
docker exec vss-kamailio kamcmd core.uptime

# Список всех RPC команд
docker exec vss-kamailio kamcmd help

# Статистика памяти
docker exec vss-kamailio kamcmd pkg.stats
docker exec vss-kamailio kamcmd shm.stats

# Информация о процессах
docker exec vss-kamailio kamcmd core.psx
docker exec vss-kamailio kamcmd core.info
```

---

### 📞 Управление звонками:

```bash
# Показать активные диалоги (звонки)
docker exec vss-kamailio kamcmd dlg.list

# Количество активных диалогов
docker exec vss-kamailio kamcmd dlg.stats_active

# Завершить диалог
docker exec vss-kamailio kamcmd dlg.end_dlg <callid> <from_tag> <to_tag>

# Профили диалогов
docker exec vss-kamailio kamcmd dlg.profile_list
```

---

### 🌐 Dispatcher (балансировка):

```bash
# Показать список destination
docker exec vss-kamailio kamcmd dispatcher.list

# Перезагрузить dispatcher
docker exec vss-kamailio kamcmd dispatcher.reload

# Установить статус destination
docker exec vss-kamailio kamcmd dispatcher.set_state <state> <group> <address>
```

---

## 💾 KAMDBCTL - Управление базой данных

### Инициализация БД:

```bash
# Создать все таблицы Kamailio
docker exec vss-kamailio kamdbctl create

# Создать конкретные таблицы
docker exec vss-kamailio kamdbctl create subscriber
docker exec vss-kamailio kamdbctl create location
docker exec vss-kamailio kamdbctl create dialog

# Удалить таблицы
docker exec vss-kamailio kamdbctl drop
```

---

## 🎯 РЕКОМЕНДУЕМЫЕ УТИЛИТЫ И КОМАНДЫ

### ⭐ ТОП-10 САМЫХ ПОЛЕЗНЫХ КОМАНД:

```bash
# 1. Проверка зарегистрированных устройств (ВАЖНО!)
docker exec vss-kamailio kamctl ul show

# 2. Добавление SIP пользователя
docker exec vss-kamailio kamctl add 97001 mypassword

# 3. Мониторинг активных звонков
docker exec vss-kamailio kamcmd dlg.list

# 4. Статистика Kamailio
docker exec vss-kamailio kamctl stats

# 5. Ping (проверка работы)
docker exec vss-kamailio kamctl ping

# 6. Просмотр логов
docker logs -f vss-kamailio

# 7. Перезагрузка конфигурации
docker exec vss-kamailio kamctl fifo reload

# 8. Проверка конфигурации
docker exec vss-kamailio kamailio -c

# 9. Список всех SIP пользователей
docker exec vss-kamailio kamctl db show subscriber

# 10. Версия и статус
docker exec vss-kamailio kamcmd core.version
```

---

## 🖥️ ИНТЕРАКТИВНЫЕ УТИЛИТЫ

### SIREMIS - Web UI для Kamailio

**Описание:** Веб-интерфейс для управления Kamailio  
**URL:** http://YOUR_IP/siremis  
**Установка:**

```bash
# Установка Siremis (если не установлен)
docker exec -it vss-kamailio bash
cd /var/www/html
wget https://github.com/asipto/siremis/archive/master.zip
unzip master.zip
# Следуйте инструкциям установки
```

---

### SNGREP - Анализатор SIP трафика (⭐ ОЧЕНЬ ПОЛЕЗНО!)

**Описание:** TUI (Text UI) для просмотра SIP сообщений в реальном времени  
**Установка в контейнер:**

```bash
# Войти в контейнер
docker exec -it vss-kamailio bash

# Установить sngrep
apk add --no-cache sngrep

# Запуск
sngrep
```

**Использование sngrep:**
```bash
# Просмотр всех SIP сообщений
docker exec -it vss-kamailio sngrep

# Фильтр по номеру
docker exec -it vss-kamailio sngrep port 5060

# Сохранение в pcap
docker exec vss-kamailio sngrep -O /tmp/sip.pcap
```

---

## 📊 МОНИТОРИНГ И ОТЛАДКА

### Просмотр логов:

```bash
# Логи Kamailio (реального времени)
docker logs -f vss-kamailio

# Последние 100 строк
docker logs --tail=100 vss-kamailio

# Фильтр ошибок
docker logs vss-kamailio 2>&1 | grep ERROR

# Фильтр по номеру
docker logs vss-kamailio 2>&1 | grep "97001"
```

---

### Анализ трафика:

```bash
# tcpdump внутри контейнера
docker exec vss-kamailio apk add tcpdump
docker exec vss-kamailio tcpdump -i any -n port 5060 -w /tmp/sip.pcap

# ngrep для SIP
docker exec vss-kamailio apk add ngrep
docker exec vss-kamailio ngrep -W byline -d any port 5060
```

---

## 🔧 УПРАВЛЕНИЕ КОНФИГУРАЦИЕЙ

### Редактирование конфигурации:

```bash
# Войти в контейнер
docker exec -it vss-kamailio sh

# Редактировать kamailio.cfg
vi /etc/kamailio/kamailio.cfg

# Или на хосте (рекомендуется)
notepad config/sip/kamailio/kamailio.cfg

# Проверка синтаксиса после изменений
docker exec vss-kamailio kamailio -c

# Перезагрузка конфигурации
docker restart vss-kamailio
```

---

## 🎨 ГРАФИЧЕСКИЕ УТИЛИТЫ (Опционально)

### 1. Homer (SIP Capture)

**Описание:** Система захвата и анализа SIP трафика  
**GitHub:** https://github.com/sipcapture/homer

**Установка:**
```bash
# Добавить в docker-compose.yml
homer:
  image: sipcapture/homer-webapp:latest
  ports:
    - "9080:80"
  environment:
    - DB_HOST=postgres
    - DB_USER=homer
    - DB_PASS=homerpass
```

---

### 2. Kazoo (Call Center Platform)

**Описание:** Полнофункциональная платформа call-центра  
**URL:** https://www.2600hz.com/

---

### 3. FusionPBX (Alternative PBX)

**Описание:** Веб-интерфейс для управления FreeSWITCH/Kamailio  
**URL:** https://www.fusionpbx.com/

---

## 📋 ПОЛЕЗНЫЕ КОМАНДЫ ДЛЯ VSS OMNI TELECOM

### Проверка слотов (6xxx, 7xxx, 8xxx):

```bash
# Показать все зарегистрированные слоты
docker exec vss-kamailio kamctl ul show | grep -E "97[0-9]{3}|98[0-9]{3}|99[0-9]{3}"

# Проверить конкретный слот
docker exec vss-kamailio kamctl ul show 97001
docker exec vss-kamailio kamctl ul show 98001
docker exec vss-kamailio kamctl ul show 99001
```

---

### Добавление слотов в Kamailio:

```bash
# AUTO слоты (97xxx)
for i in {1..10}; do
  docker exec vss-kamailio kamctl add "9700$i" "slot_password_$i"
done

# MF слоты (98xxx)
for i in {1..10}; do
  docker exec vss-kamailio kamctl add "9800$i" "slot_password_$i"
done

# LS слоты (99xxx)
for i in {1..10}; do
  docker exec vss-kamailio kamctl add "9900$i" "slot_password_$i"
done
```

---

### Мониторинг звонков:

```bash
# Активные диалоги
docker exec vss-kamailio kamcmd dlg.list

# Статистика звонков
docker exec vss-kamailio kamcmd dlg.stats_active

# История звонков (через БД)
docker exec vss-kamailio kamctl db show acc
```

---

## 🔍 ДИАГНОСТИКА И ОТЛАДКА

### Проблемы с регистрацией:

```bash
# 1. Проверить слушает ли Kamailio на порту 5060
docker exec vss-kamailio netstat -tuln | grep 5060

# 2. Проверить регистрации
docker exec vss-kamailio kamctl ul show

# 3. Просмотр логов регистрации
docker logs vss-kamailio 2>&1 | grep REGISTER

# 4. Тест подключения
docker exec vss-kamailio kamctl ping
```

---

### Проблемы со звонками:

```bash
# 1. Проверить активные диалоги
docker exec vss-kamailio kamcmd dlg.list

# 2. Просмотр SIP трафика (если установлен sngrep)
docker exec -it vss-kamailio sngrep

# 3. Логи звонков
docker logs vss-kamailio 2>&1 | grep INVITE

# 4. Статистика транзакций
docker exec vss-kamailio kamctl fifo get_statistics tm:
```

---

### Проблемы с производительностью:

```bash
# 1. Статистика памяти
docker exec vss-kamailio kamcmd pkg.stats
docker exec vss-kamailio kamcmd shm.stats

# 2. Статистика процессов
docker exec vss-kamailio kamcmd core.psx

# 3. Uptime
docker exec vss-kamailio kamcmd core.uptime

# 4. Статистика обработки сообщений
docker exec vss-kamailio kamctl fifo get_statistics core:
```

---

## 💡 РЕКОМЕНДУЕМАЯ УТИЛИТА: KAMCTL + SNGREP

### Почему kamctl + sngrep?

✅ **kamctl** - для управления и базовой диагностики  
✅ **sngrep** - для визуального анализа SIP трафика  

### Установка sngrep в контейнер:

```bash
# 1. Войти в контейнер
docker exec -it vss-kamailio sh

# 2. Установить sngrep
apk update
apk add sngrep

# 3. Запустить
sngrep
```

### Использование sngrep:

**Интерфейс:**
- `F1` - Помощь
- `F2` - Сохранить в PCAP
- `F3` - Поиск
- `F4` - Расширенный вид
- `F10` - Выход
- `Enter` - Детали сообщения
- `Esc` - Назад

**Фильтры:**
```
# Фильтр по номеру
sngrep 97001

# Фильтр по методу
sngrep INVITE

# Фильтр по IP
sngrep host 192.168.1.100
```

---

## 📖 СПРАВОЧНИК КОМАНД KAMCTL

### Синтаксис:
```bash
kamctl [опции] <команда> [параметры]
```

### Категории команд:

| Категория | Команды | Описание |
|-----------|---------|----------|
| **User Management** | add, rm, passwd, showdb | Управление пользователями |
| **Location (ul)** | ul show, ul rm, ul add | Управление регистрациями |
| **Monitoring** | ping, stats, ps | Мониторинг системы |
| **Database** | db show, db exec | Работа с БД |
| **FIFO** | fifo [command] | RPC команды |
| **Aliases** | alias show, alias add | Управление алиасами |
| **Domains** | domain add, domain show | Управление доменами |

---

### Полный список команд kamctl:

```bash
# Получить полный список
docker exec vss-kamailio kamctl help

# Справка по конкретной команде
docker exec vss-kamailio kamctl help ul
docker exec vss-kamailio kamctl help add
```

---

## 🎯 ПРАКТИЧЕСКИЕ ПРИМЕРЫ

### Пример 1: Регистрация нового AUTO слота (97001)

```bash
# 1. Добавить пользователя
docker exec vss-kamailio kamctl add 97001 slot97001pass

# 2. Проверить добавление
docker exec vss-kamailio kamctl db show subscriber | grep 97001

# 3. Дождаться регистрации устройства
# (устройство должно зарегистрироваться с этими учетными данными)

# 4. Проверить регистрацию
docker exec vss-kamailio kamctl ul show 97001
```

---

### Пример 2: Мониторинг активного звонка

```bash
# 1. Показать активные звонки
docker exec vss-kamailio kamcmd dlg.list

# 2. Запустить sngrep для визуализации
docker exec -it vss-kamailio sngrep

# 3. В sngrep найти нужный звонок (по номеру)
# Нажмите F3 и введите номер телефона

# 4. Просмотр деталей (Enter на сообщении)
```

---

### Пример 3: Проверка статистики за день

```bash
# 1. Все звонки за сегодня (через БД)
docker exec vss-postgres psql -U vss -d vss_db -c "SELECT * FROM acc WHERE time::date = CURRENT_DATE"

# 2. Статистика регистраций
docker exec vss-kamailio kamctl stats | grep usrloc

# 3. Статистика транзакций
docker exec vss-kamailio kamctl stats | grep tm:
```

---

## 🔧 ДОПОЛНИТЕЛЬНЫЕ ИНСТРУМЕНТЫ

### SIPp (SIP тестирование)

**Описание:** Генератор SIP нагрузки и тестирования  
**Установка:**

```bash
docker run -it --rm --network host ctaloi/sipp \
  -sn uac -r 10 -l 100 -d 60000 -s 97001 localhost:5060
```

---

### Wireshark / tshark (Анализ пакетов)

```bash
# Захват SIP трафика на хосте
sudo tcpdump -i any -n port 5060 -w sip.pcap

# Анализ в Wireshark
# Открыть sip.pcap в Wireshark с фильтром: sip
```

---

## 📊 МОНИТОРИНГ ПРОИЗВОДИТЕЛЬНОСТИ

### Метрики Kamailio:

```bash
# CPU и память контейнера
docker stats vss-kamailio

# Детальная статистика Kamailio
docker exec vss-kamailio kamcmd core.info

# Shared memory
docker exec vss-kamailio kamcmd shm.stats

# Package memory
docker exec vss-kamailio kamcmd pkg.stats
```

---

## 🎓 РЕКОМЕНДУЕМЫЙ WORKFLOW

### Ежедневная работа:

```bash
# 1. Утро - проверка статуса
docker exec vss-kamailio kamctl ping
docker exec vss-kamailio kamctl ul show

# 2. В течение дня - мониторинг звонков
docker exec vss-kamailio kamcmd dlg.stats_active

# 3. При проблемах - sngrep
docker exec -it vss-kamailio sngrep

# 4. Вечер - статистика
docker exec vss-kamailio kamctl stats
docker logs --since 24h vss-kamailio | grep ERROR
```

---

## 📚 ПОЛЕЗНЫЕ РЕСУРСЫ

- **Kamailio Wiki:** https://www.kamailio.org/wiki/
- **kamctl Reference:** https://www.kamailio.org/docs/tools/kamctl.html
- **kamcmd Reference:** https://www.kamailio.org/docs/tools/kamcmd.html
- **SIP RFC:** https://www.rfc-editor.org/rfc/rfc3261

---

## ✅ МОЯ РЕКОМЕНДАЦИЯ

### 🏆 Лучшая комбинация для VSS OMNI TELECOM:

1. **`kamctl`** - для ежедневного управления пользователями и регистрациями
2. **`sngrep`** - для визуальной отладки SIP звонков
3. **`kamcmd dlg.list`** - для мониторинга активных звонков
4. **`docker logs`** - для просмотра логов и ошибок

### Базовый набор команд:

```bash
# Проверка системы
docker exec vss-kamailio kamctl ping

# Регистрации
docker exec vss-kamailio kamctl ul show

# Активные звонки
docker exec vss-kamailio kamcmd dlg.list

# Логи
docker logs -f vss-kamailio

# Отладка SIP (если установлен sngrep)
docker exec -it vss-kamailio sngrep
```

---

**✅ Руководство по консольным утилитам Kamailio готово!**  
**⭐ Рекомендую: kamctl + sngrep для полного контроля!**

