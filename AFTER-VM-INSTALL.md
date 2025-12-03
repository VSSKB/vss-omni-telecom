# 🚀 После установки Ubuntu на VM

## ✅ Установка завершена! Что дальше?

### 1. Первый вход в систему

VM автоматически перезагрузится. Затем:

```bash
# Войдите в систему
vss-ubuntu login: vss
Password: vss123

# Вы увидите приглашение:
vss@vss-ubuntu:~$
```

### 2. Узнайте IP адрес VM

```bash
# Узнать IP адрес
ip addr show

# Или короче
ip a

# Запомните IP! Например: 192.168.1.100
# Обычно это inet 192.168.x.x под интерфейсом eth0
```

**Запишите IP адрес:** `________________`

---

### 3. Обновите систему (опционально, но рекомендуется)

```bash
# Обновить пакеты
sudo apt update && sudo apt upgrade -y

# Проверить Docker
docker --version
docker compose version
```

---

### 4. На Windows: Скопируйте VSS на VM

Откройте PowerShell на Windows и выполните:

```powershell
# Запустить скрипт копирования
.\copy-vss-to-vm.ps1

# Введите IP адрес VM когда попросит
# Например: 192.168.1.100
```

**Альтернатива (вручную):**
```powershell
$LinuxIP = "192.168.1.100"  # Замените на ваш IP
scp -r C:\Users\Administrator\Documents\vss-omni-telecom vss@${LinuxIP}:~/
```

При первом подключении ответьте **yes** для добавления в known_hosts.

---

### 5. Подключитесь к VM через SSH (с Windows)

```powershell
# SSH подключение
ssh vss@192.168.1.100  # Замените на ваш IP
# Пароль: vss123
```

**Или используйте PowerShell:**
```powershell
Enter-PSSession -HostName 192.168.1.100 -UserName vss
```

---

### 6. На VM: Запустите VSS! 🚀

```bash
# Перейти в папку проекта
cd ~/vss-omni-telecom

# Проверить файлы
ls -la

# Запустить весь стек VSS с FreeSWITCH
docker compose -f docker-compose.vss-demiurge.yml up -d

# Это запустит все сервисы:
# - PostgreSQL
# - Redis
# - RabbitMQ
# - Kamailio
# - Asterisk
# - FreeSWITCH ⭐
# - Guacamole
# - Prometheus & Grafana
# - NGINX
# - Все VSS сервисы
```

---

### 7. Проверка запуска

```bash
# Посмотреть статус всех контейнеров
docker compose -f docker-compose.vss-demiurge.yml ps

# Посмотреть логи
docker compose -f docker-compose.vss-demiurge.yml logs -f

# Выйти из логов: Ctrl+C

# Проверить конкретные сервисы
docker compose -f docker-compose.vss-demiurge.yml logs freeswitch
docker compose -f docker-compose.vss-demiurge.yml logs postgres
```

**Все сервисы должны быть в статусе "Up" или "healthy"!**

---

### 8. Откройте VSS в браузере на Windows

```
http://192.168.1.100      # Замените на IP вашей VM

Логин:  admin
Пароль: admin123
```

**Другие сервисы:**
```
http://192.168.1.100:15672  # RabbitMQ (vss-admin / vss_rabbit_pass)
http://192.168.1.100:3001   # Grafana (admin / vss_grafana_pass)
http://192.168.1.100:9090   # Prometheus
http://192.168.1.100:8080/guacamole  # Guacamole
```

---

### 9. Тест FreeSWITCH

```bash
# Подключиться к FreeSWITCH CLI
docker exec -it vss-freeswitch fs_cli -p ClueCon

# В консоли FreeSWITCH:
fs_cli> status              # Статус системы
fs_cli> sofia status        # SIP профили
fs_cli> show codecs         # Доступные кодеки
fs_cli> /exit               # Выход

# Или без входа в консоль:
docker exec vss-freeswitch fs_cli -p ClueCon -x "status"
```

**Тестовый звонок:**
- Настройте SIP клиент (Zoiper, X-Lite)
- Сервер: `192.168.1.100:5080`
- Логин: `1000`, Пароль: `1234`
- Позвоните на `9196` (Echo Test)

---

## 🔧 Полезные команды на VM

```bash
# Остановить VSS
docker compose -f docker-compose.vss-demiurge.yml down

# Перезапустить сервис
docker compose -f docker-compose.vss-demiurge.yml restart freeswitch

# Использование ресурсов
docker stats

# Очистить все (ОСТОРОЖНО - удалит данные!)
docker compose -f docker-compose.vss-demiurge.yml down -v
```

---

## 🎯 Автозапуск VSS при старте VM

```bash
# Создать systemd service
sudo nano /etc/systemd/system/vss.service

# Содержимое:
[Unit]
Description=VSS OMNI TELECOM
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/vss/vss-omni-telecom
ExecStart=/usr/bin/docker compose -f docker-compose.vss-demiurge.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.vss-demiurge.yml down
User=vss

[Install]
WantedBy=multi-user.target

# Сохранить: Ctrl+O, Enter, Ctrl+X

# Включить автозапуск
sudo systemctl daemon-reload
sudo systemctl enable vss.service
sudo systemctl start vss.service

# Проверить
sudo systemctl status vss.service
```

---

## 📚 Дополнительная документация

- **[VSS-BEGINNER-GUIDE.md](VSS-BEGINNER-GUIDE.md)** - полное руководство
- **[FREESWITCH-QUICK-START.md](FREESWITCH-QUICK-START.md)** - работа с FreeSWITCH
- **[FREESWITCH-CHEATSHEET.md](FREESWITCH-CHEATSHEET.md)** - шпаргалка команд
- **[VSS-LINUX-VM-SETUP.md](VSS-LINUX-VM-SETUP.md)** - детали VM

---

## ❓ Проблемы?

### Контейнеры не запускаются

```bash
# Проверить логи
docker compose -f docker-compose.vss-demiurge.yml logs

# Пересоздать контейнеры
docker compose -f docker-compose.vss-demiurge.yml down
docker compose -f docker-compose.vss-demiurge.yml up -d
```

### Недостаточно памяти

```bash
# Проверить память
free -h

# Остановить ненужные сервисы или увеличить RAM VM
```

### Порт занят

```bash
# Проверить порты
sudo netstat -tulpn | grep LISTEN

# Остановить конфликтующий процесс или изменить порт в docker-compose
```

---

## ✅ Чеклист готовности

- [ ] Ubuntu установлена
- [ ] IP адрес известен: `_____________`
- [ ] VSS скопирован на VM
- [ ] Docker работает
- [ ] VSS запущен
- [ ] Веб-интерфейс доступен
- [ ] Пароль admin изменен
- [ ] FreeSWITCH работает
- [ ] Тестовый звонок выполнен

---

**🎉 Поздравляем! VSS OMNI TELECOM работает на Linux VM!**

**Версия:** 1.0  
**Дата:** 2025-01-XX

