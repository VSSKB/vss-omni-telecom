# 🐧 VSS на Linux VM - Полная инструкция

**Запуск VSS OMNI TELECOM на виртуальной Linux машине**

---

## 📋 Содержание

1. [Выбор гипервизора](#выбор-гипервизора)
2. [Требования к VM](#требования-к-vm)
3. [Установка Ubuntu на VM](#установка-ubuntu-на-vm)
4. [Установка Docker](#установка-docker)
5. [Установка VSS](#установка-vss)
6. [Настройка сети](#настройка-сети)
7. [Запуск VSS](#запуск-vss)
8. [Доступ с Windows](#доступ-с-windows)

---

## 🖥️ Выбор гипервизора

### Hyper-V (Рекомендуется для Windows Server)

**Преимущества:**
- ✅ Встроен в Windows Server
- ✅ Высокая производительность
- ✅ Простая настройка сети
- ✅ Бесплатный

**Недостатки:**
- ❌ Только для Windows Pro/Enterprise/Server

### VirtualBox

**Преимущества:**
- ✅ Бесплатный
- ✅ Простой интерфейс
- ✅ Кроссплатформенный

**Недостатки:**
- ❌ Ниже производительность чем Hyper-V
- ❌ Может конфликтовать с Hyper-V

### VMware Workstation

**Преимущества:**
- ✅ Отличная производительность
- ✅ Удобный интерфейс
- ✅ Много функций

**Недостатки:**
- ❌ Платный (есть trial)
- ❌ Может конфликтовать с Hyper-V

---

## 💻 Требования к VM

### Минимальные:
- **CPU:** 4 ядра
- **RAM:** 8 GB
- **Диск:** 50 GB
- **Сеть:** Bridged или NAT с пробросом портов

### Рекомендуемые:
- **CPU:** 8 ядер
- **RAM:** 16 GB
- **Диск:** 100 GB SSD
- **Сеть:** Bridged для прямого доступа

---

## 🚀 Вариант 1: Hyper-V (Рекомендуется)

### Шаг 1: Включение Hyper-V

На Windows Server Hyper-V обычно уже включен. Проверьте в PowerShell:

```powershell
# Проверка статуса Hyper-V
Get-WindowsFeature -Name Hyper-V

# Если не установлен, установите:
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

### Шаг 2: Создание виртуальной машины

**Через GUI:**

1. Откройте **Hyper-V Manager** (hyper-v-manager.msc)
2. Правой кнопкой на сервер → **New** → **Virtual Machine**
3. Следуйте мастеру:
   - **Name:** VSS-Ubuntu
   - **Generation:** Generation 2 (для Ubuntu 20.04+)
   - **Memory:** 8192 MB (8 GB), включите Dynamic Memory
   - **Network:** Default Switch или создайте External Switch
   - **Virtual Hard Disk:** 50 GB (Dynamic)
   - **Installation Options:** Укажите путь к Ubuntu ISO

**Через PowerShell:**

```powershell
# Создание VM
New-VM -Name "VSS-Ubuntu" -MemoryStartupBytes 8GB -Generation 2 -NewVHDPath "C:\Hyper-V\VSS-Ubuntu.vhdx" -NewVHDSizeBytes 50GB

# Добавление процессоров
Set-VMProcessor "VSS-Ubuntu" -Count 4

# Добавление сетевого адаптера
Add-VMNetworkAdapter -VMName "VSS-Ubuntu" -SwitchName "Default Switch"

# Добавление DVD с Ubuntu ISO
Add-VMDvdDrive -VMName "VSS-Ubuntu" -Path "C:\ISO\ubuntu-22.04-server-amd64.iso"

# Настройка загрузки
Set-VMFirmware "VSS-Ubuntu" -FirstBootDevice $(Get-VMDvdDrive -VMName "VSS-Ubuntu")

# Запуск VM
Start-VM -Name "VSS-Ubuntu"
```

### Шаг 3: Скачивание Ubuntu

Скачайте Ubuntu Server 22.04 LTS:
- https://ubuntu.com/download/server
- Рекомендуется: ubuntu-22.04-live-server-amd64.iso

### Шаг 4: Установка Ubuntu

1. **Подключитесь к VM:**
   - Hyper-V Manager → Правый клик на VM → Connect

2. **Установка Ubuntu:**
   - Язык: English
   - Keyboard: Russian или English
   - Network: Оставьте DHCP (автоматически)
   - Storage: Use entire disk
   - Profile:
     - **Name:** vss
     - **Server name:** vss-ubuntu
     - **Username:** vss
     - **Password:** (придумайте надежный)
   - SSH: **Включите** "Install OpenSSH server"
   - Featured snaps: Пропустите

3. **Дождитесь установки** (5-10 минут)

4. **Перезагрузите** и войдите с созданными учетными данными

---

## 🐳 Установка Docker на Ubuntu

После входа в Ubuntu VM:

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка зависимостей
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common git

# Добавление репозитория Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Перезагрузка для применения изменений
sudo reboot
```

После перезагрузки проверьте:

```bash
# Проверка Docker
docker --version
docker compose version

# Тестовый запуск
docker run hello-world
```

---

## 📦 Установка VSS на Ubuntu VM

### Вариант A: Через Git (если проект в репозитории)

```bash
# Клонирование репозитория
cd ~
git clone <URL_вашего_репозитория> vss-omni-telecom
cd vss-omni-telecom
```

### Вариант B: Копирование с Windows

**На Windows (PowerShell):**

```powershell
# Узнайте IP адрес VM
# В Hyper-V Manager → VM → Networking → IP Address

# Или подключитесь к VM и выполните:
ip addr show

# Копирование через SCP (требуется WinSCP или встроенный scp)
scp -r C:\Users\Administrator\Documents\vss-omni-telecom vss@<IP_VM>:~/
```

**Или используйте WinSCP:**
1. Скачайте WinSCP: https://winscp.net/
2. Подключитесь к VM по IP
3. Скопируйте папку vss-omni-telecom

**Или через shared folder в Hyper-V:**
1. На Windows создайте папку: `C:\Shared\VSS`
2. Скопируйте туда vss-omni-telecom
3. В Hyper-V: VM Settings → Integration Services → Guest Services (включите)
4. В Ubuntu:
```bash
sudo mkdir /mnt/shared
sudo mount -t cifs //[Windows-IP]/Shared /mnt/shared -o username=[Windows-User]
cp -r /mnt/shared/VSS/vss-omni-telecom ~/
```

---

## 🌐 Настройка сети

### Вариант 1: Bridged Network (Прямой доступ)

**В Hyper-V:**

1. Hyper-V Manager → Virtual Switch Manager
2. New virtual network switch → External
3. Name: "External-Bridge"
4. External network: Выберите физический адаптер
5. Apply

6. VM Settings → Network Adapter → Virtual Switch: "External-Bridge"

**Преимущества:**
- VM получит IP в вашей сети
- Прямой доступ с любого компьютера
- Не нужен проброс портов

### Вариант 2: NAT с пробросом портов

**В Hyper-V (PowerShell):**

```powershell
# Создание NAT switch
New-VMSwitch -Name "NATSwitch" -SwitchType Internal
New-NetIPAddress -IPAddress 192.168.100.1 -PrefixLength 24 -InterfaceAlias "vEthernet (NATSwitch)"
New-NetNat -Name "NATNetwork" -InternalIPInterfaceAddressPrefix 192.168.100.0/24

# Применение к VM
Set-VMNetworkAdapter -VMName "VSS-Ubuntu" -SwitchName "NATSwitch"

# Проброс портов (выполните после запуска VM)
# Узнайте IP VM: подключитесь и выполните `ip addr`
# Например, IP VM: 192.168.100.10

# HTTP (VSS Web UI)
netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=80 connectaddress=192.168.100.10

# RabbitMQ Management
netsh interface portproxy add v4tov4 listenport=15672 listenaddress=0.0.0.0 connectport=15672 connectaddress=192.168.100.10

# Grafana
netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=192.168.100.10

# FreeSWITCH SIP
netsh interface portproxy add v4tov4 listenport=5080 listenaddress=0.0.0.0 connectport=5080 connectaddress=192.168.100.10

# Посмотреть все правила
netsh interface portproxy show all

# Удалить правило (если нужно)
netsh interface portproxy delete v4tov4 listenport=80
```

---

## 🚀 Запуск VSS на Ubuntu VM

### Шаг 1: Переход в папку проекта

```bash
cd ~/vss-omni-telecom
```

### Шаг 2: Создание .env файла (опционально)

```bash
# Скопируйте example если есть
cp .env.example .env

# Или создайте новый
nano .env
```

Добавьте:
```env
DB_PASSWORD=vss_postgres_pass
REDIS_PASSWORD=vss_redis_pass
RABBITMQ_PASSWORD=vss_rabbit_pass
JWT_SECRET=vss_jwt_secret_change_in_production
FREESWITCH_PASSWORD=ClueCon
GRAFANA_PASSWORD=vss_grafana_pass
```

### Шаг 3: Запуск полного стека

```bash
# Запуск всех сервисов в фоне
docker compose -f docker-compose.vss-demiurge.yml up -d

# Или используйте старый синтаксис если новый не работает
docker-compose -f docker-compose.vss-demiurge.yml up -d
```

### Шаг 4: Проверка статуса

```bash
# Проверка статуса контейнеров
docker compose -f docker-compose.vss-demiurge.yml ps

# Или
docker ps

# Проверка логов
docker compose -f docker-compose.vss-demiurge.yml logs -f

# Логи конкретного сервиса
docker compose -f docker-compose.vss-demiurge.yml logs -f freeswitch
```

### Шаг 5: Дождитесь запуска

Первый запуск займет **5-15 минут** (скачивание образов).

Проверьте, что все контейнеры запущены:

```bash
docker compose -f docker-compose.vss-demiurge.yml ps
```

Все сервисы должны быть в статусе **"Up"** или **"healthy"**.

---

## 🌍 Доступ к VSS с Windows

### Узнайте IP адрес VM

**В Ubuntu VM:**

```bash
# Узнать IP адрес
ip addr show

# Или
hostname -I
```

Например: `192.168.1.100`

### Откройте в браузере на Windows

В браузере на вашем Windows Server откройте:

- **VSS Web UI:** http://192.168.1.100
- **RabbitMQ:** http://192.168.1.100:15672
- **Grafana:** http://192.168.1.100:3001
- **Prometheus:** http://192.168.1.100:9090

**Логин/пароль:**
- VSS: `admin` / `admin123`
- RabbitMQ: `vss-admin` / `vss_rabbit_pass`
- Grafana: `admin` / `vss_grafana_pass`

---

## 🔧 Полезные команды

### Управление VM (на Windows)

```powershell
# Список VM
Get-VM

# Запуск VM
Start-VM -Name "VSS-Ubuntu"

# Остановка VM
Stop-VM -Name "VSS-Ubuntu"

# Перезагрузка VM
Restart-VM -Name "VSS-Ubuntu"

# Подключение к консоли
vmconnect localhost "VSS-Ubuntu"
```

### SSH доступ к VM

```powershell
# С Windows через PowerShell
ssh vss@192.168.1.100

# Или используйте PuTTY
```

### Управление Docker на VM

```bash
# Запуск VSS
docker compose -f docker-compose.vss-demiurge.yml up -d

# Остановка VSS
docker compose -f docker-compose.vss-demiurge.yml down

# Перезапуск сервиса
docker compose -f docker-compose.vss-demiurge.yml restart freeswitch

# Логи
docker compose -f docker-compose.vss-demiurge.yml logs -f

# Статус
docker compose -f docker-compose.vss-demiurge.yml ps

# Использование ресурсов
docker stats
```

### Очистка

```bash
# Остановить и удалить все контейнеры и volumes
docker compose -f docker-compose.vss-demiurge.yml down -v

# Очистить неиспользуемые образы
docker system prune -a
```

---

## 🔒 Настройка firewall на Ubuntu

Если хотите ограничить доступ к VM:

```bash
# Установка UFW
sudo apt install -y ufw

# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Разрешить порты VSS
sudo ufw allow 3000/tcp   # VSS Workspace
sudo ufw allow 3001/tcp   # Grafana
sudo ufw allow 5060/udp   # Kamailio SIP
sudo ufw allow 5080/udp   # FreeSWITCH SIP
sudo ufw allow 8021/tcp   # FreeSWITCH ESL
sudo ufw allow 8080/tcp   # Guacamole
sudo ufw allow 9090/tcp   # Prometheus
sudo ufw allow 15672/tcp  # RabbitMQ Management

# Разрешить RTP (для звонков)
sudo ufw allow 10000:32768/udp

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

---

## 🎯 Автозапуск VSS при загрузке VM

```bash
# Создание systemd service
sudo nano /etc/systemd/system/vss.service
```

Содержимое:

```ini
[Unit]
Description=VSS OMNI TELECOM
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/vss/vss-omni-telecom
ExecStart=/usr/bin/docker compose -f docker-compose.vss-demiurge.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.vss-demiurge.yml down
User=vss

[Install]
WantedBy=multi-user.target
```

Активация:

```bash
# Перезагрузка systemd
sudo systemctl daemon-reload

# Включение автозапуска
sudo systemctl enable vss.service

# Запуск сейчас
sudo systemctl start vss.service

# Проверка статуса
sudo systemctl status vss.service
```

---

## 📊 Мониторинг VM

### На Windows (Hyper-V)

```powershell
# CPU и память VM
Get-VM "VSS-Ubuntu" | Select Name, State, CPUUsage, MemoryAssigned

# Детальная информация
Get-VM "VSS-Ubuntu" | Format-List *
```

### На Ubuntu

```bash
# Использование ресурсов
htop  # или top

# Использование диска
df -h

# Docker статистика
docker stats

# Логи системы
journalctl -f
```

---

## ❓ Частые проблемы

### Проблема: VM не получает IP адрес

**Решение:**
```bash
# Перезапуск сети
sudo systemctl restart systemd-networkd

# Или получить IP вручную
sudo dhclient
```

### Проблема: Не могу подключиться по SSH

**Решение:**
```bash
# Проверить статус SSH
sudo systemctl status ssh

# Запустить SSH
sudo systemctl start ssh

# Включить автозапуск
sudo systemctl enable ssh
```

### Проблема: Docker контейнеры не запускаются

**Решение:**
```bash
# Проверить логи
docker compose -f docker-compose.vss-demiurge.yml logs

# Очистить и перезапустить
docker compose -f docker-compose.vss-demiurge.yml down
docker system prune -a
docker compose -f docker-compose.vss-demiurge.yml up -d
```

### Проблема: Мало места на диске

**Решение:**
```bash
# Очистить Docker
docker system prune -a --volumes

# Или увеличить диск VM в Hyper-V Manager
```

---

## 🎉 Готово!

Теперь у вас есть:
- ✅ Linux VM с Ubuntu
- ✅ Docker установлен
- ✅ VSS OMNI TELECOM запущен
- ✅ FreeSWITCH работает
- ✅ Доступ с Windows

### Следующие шаги:

1. Откройте http://[IP-VM] в браузере
2. Войдите: `admin` / `admin123`
3. Смените пароль
4. Прочитайте [VSS-BEGINNER-GUIDE.md](VSS-BEGINNER-GUIDE.md)
5. Настройте первый транк FreeSWITCH
6. Сделайте тестовый звонок на 9196

---

## 📚 Дополнительные ресурсы

- [VSS-BEGINNER-GUIDE.md](VSS-BEGINNER-GUIDE.md) - Полное руководство
- [FREESWITCH-QUICK-START.md](FREESWITCH-QUICK-START.md) - FreeSWITCH справочник
- [VSS-TECH-STACK.md](VSS-TECH-STACK.md) - Технологический стек

---

**Версия:** 1.0  
**Дата:** 2025-01-XX  
**Автор:** VSS Development Team

**Удачи с VSS на Linux VM! 🐧🚀**




