# 🖥️ VSS на Linux VM - Полное руководство по развертыванию

**Запуск VSS OMNI TELECOM в Linux виртуальной машине на Windows Server**

---

## 📋 Содержание

1. [Выбор решения для виртуализации](#выбор-решения)
2. [Вариант 1: Hyper-V (Рекомендуется для Windows Server)](#вариант-1-hyper-v)
3. [Вариант 2: VirtualBox](#вариант-2-virtualbox)
4. [Вариант 3: VMware](#вариант-3-vmware)
5. [Установка Docker в VM](#установка-docker-в-vm)
6. [Развертывание VSS](#развертывание-vss)
7. [Доступ к VSS из Windows](#доступ-к-vss-из-windows)

---

## 🎯 Выбор решения

### Рекомендации:

| Решение | Плюсы | Минусы | Рекомендация |
|---------|-------|--------|--------------|
| **Hyper-V** | ✅ Встроен в Windows Server<br>✅ Отличная производительность<br>✅ Официальная поддержка Microsoft | ⚠️ Требует включения в BIOS | ⭐⭐⭐⭐⭐ **Лучший выбор** |
| **VirtualBox** | ✅ Бесплатный<br>✅ Простой интерфейс<br>✅ Кроссплатформенный | ⚠️ Медленнее Hyper-V<br>⚠️ Конфликт с Hyper-V | ⭐⭐⭐⭐ Хорошо |
| **VMware** | ✅ Профессиональное решение<br>✅ Отличная производительность | ⚠️ Платный (есть бесплатная версия Player) | ⭐⭐⭐⭐ Хорошо |

---

## 🚀 Вариант 1: Hyper-V (Рекомендуется)

### Шаг 1: Проверка и включение Hyper-V

#### Проверьте, установлен ли Hyper-V:

```powershell
# Проверка статуса Hyper-V
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All

# Или проще:
Get-Command New-VM
```

#### Если Hyper-V не установлен, установите:

```powershell
# Установка Hyper-V (требуется перезагрузка)
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All

# Или через Server Manager:
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

После установки **перезагрузите сервер**.

---

### Шаг 2: Скачивание Ubuntu Server ISO

```powershell
# Создайте папку для ISO
New-Item -Path "C:\ISO" -ItemType Directory -Force

# Скачайте Ubuntu Server 22.04 LTS (рекомендуется)
# Вручную с сайта: https://ubuntu.com/download/server
# Или через PowerShell:
$url = "https://releases.ubuntu.com/22.04/ubuntu-22.04.3-live-server-amd64.iso"
$output = "C:\ISO\ubuntu-22.04-server.iso"

Write-Host "Скачивание Ubuntu Server 22.04 LTS..." -ForegroundColor Green
Invoke-WebRequest -Uri $url -OutFile $output

Write-Host "✅ Скачивание завершено!" -ForegroundColor Green
```

---

### Шаг 3: Создание виртуальной машины в Hyper-V

```powershell
# Параметры VM
$VMName = "VSS-Linux-VM"
$VMPath = "C:\VMs"
$ISOPath = "C:\ISO\ubuntu-22.04-server.iso"

# Создайте папку для VM
New-Item -Path $VMPath -ItemType Directory -Force

# Создайте виртуальную машину
New-VM -Name $VMName `
    -MemoryStartupBytes 8GB `
    -Generation 2 `
    -NewVHDPath "$VMPath\$VMName\$VMName.vhdx" `
    -NewVHDSizeBytes 100GB `
    -Path $VMPath `
    -SwitchName "Default Switch"

# Настройте процессор (4 ядра)
Set-VMProcessor -VMName $VMName -Count 4

# Настройте динамическую память
Set-VMMemory -VMName $VMName -DynamicMemoryEnabled $true -MinimumBytes 4GB -MaximumBytes 16GB

# Добавьте ISO для установки
Add-VMDvdDrive -VMName $VMName -Path $ISOPath

# Настройте загрузку с DVD
$dvd = Get-VMDvdDrive -VMName $VMName
Set-VMFirmware -VMName $VMName -FirstBootDevice $dvd

# Запустите VM
Start-VM -Name $VMName

# Откройте консоль VM
vmconnect.exe localhost $VMName
```

---

### Шаг 4: Установка Ubuntu Server

После запуска VM следуйте инструкциям установщика Ubuntu:

1. **Язык:** English (рекомендуется для совместимости)
2. **Keyboard:** Russian или English
3. **Type of install:** Ubuntu Server (минимальная установка)
4. **Network:** Оставьте DHCP (автоматическая настройка)
5. **Proxy:** Пропустите (если не используете)
6. **Mirror:** Оставьте по умолчанию
7. **Storage:** Use entire disk (весь диск)
8. **Profile setup:**
   - **Your name:** vss-admin
   - **Server name:** vss-server
   - **Username:** vssadmin
   - **Password:** (придумайте надежный пароль)
9. **SSH:** ✅ **Установите OpenSSH server** (важно!)
10. **Snaps:** Можно пропустить
11. Дождитесь завершения установки
12. **Reboot** - перезагрузите VM

После перезагрузки войдите с созданным пользователем.

---

### Шаг 5: Настройка сети VM

#### Узнайте IP адрес VM:

```bash
# В консоли VM (после входа)
ip addr show

# Или
hostname -I
```

Запишите IP адрес (например: `172.x.x.x` или `192.168.x.x`)

#### Настройте статический IP (опционально):

```bash
# Отредактируйте netplan конфигурацию
sudo nano /etc/netplan/00-installer-config.yaml
```

Пример конфигурации:

```yaml
network:
  ethernets:
    eth0:
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
  version: 2
```

Примените изменения:

```bash
sudo netplan apply
```

---

## 📦 Установка Docker в VM

### Автоматическая установка (рекомендуется):

```bash
# Обновите систему
sudo apt update && sudo apt upgrade -y

# Установите необходимые пакеты
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common git

# Добавьте официальный GPG ключ Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Добавьте репозиторий Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установите Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Добавьте пользователя в группу docker
sudo usermod -aG docker $USER

# Перезапустите сессию (или перелогиньтесь)
newgrp docker

# Проверьте установку
docker --version
docker compose version
```

### Проверка работы Docker:

```bash
# Запустите тестовый контейнер
docker run hello-world

# Если видите "Hello from Docker!" - всё работает! ✅
```

---

## 🚀 Развертывание VSS

### Шаг 1: Копирование проекта в VM

#### Вариант A: Через Git (если есть репозиторий):

```bash
# Клонируйте репозиторий
git clone <URL_вашего_репозитория> vss-omni-telecom
cd vss-omni-telecom
```

#### Вариант B: Копирование с Windows хоста через SCP:

**На Windows (PowerShell):**

```powershell
# Установите WinSCP или используйте встроенный SCP в PowerShell Core
# Путь к вашему проекту
$projectPath = "C:\Users\Administrator\Documents\vss-omni-telecom"
$vmIP = "192.168.x.x"  # Замените на IP вашей VM
$vmUser = "vssadmin"

# Создайте архив проекта
Compress-Archive -Path $projectPath -DestinationPath "C:\Temp\vss-project.zip"

# Скопируйте через SCP (требуется OpenSSH Client)
scp C:\Temp\vss-project.zip ${vmUser}@${vmIP}:~/
```

**На VM (Linux):**

```bash
# Распакуйте проект
unzip ~/vss-project.zip -d ~/
mv ~/vss-omni-telecom ~/vss
cd ~/vss
```

#### Вариант C: Через общую папку Hyper-V:

```bash
# На Windows создайте общую папку и настройте Enhanced Session Mode
# Затем в VM можете монтировать общую папку
```

---

### Шаг 2: Запуск VSS

```bash
# Перейдите в папку проекта
cd ~/vss-omni-telecom

# Дайте права на выполнение скриптов (если есть)
chmod +x setup.sh

# Запустите полный стек VSS
docker compose -f docker-compose.vss-demiurge.yml up -d

# Дождитесь запуска (первый раз может занять 5-10 минут)
# Наблюдайте за процессом:
docker compose -f docker-compose.vss-demiurge.yml logs -f
```

---

### Шаг 3: Проверка запуска

```bash
# Проверьте статус всех контейнеров
docker compose -f docker-compose.vss-demiurge.yml ps

# Все сервисы должны быть "Up" или "healthy"

# Проверьте FreeSWITCH
docker exec vss-freeswitch fs_cli -p ClueCon -x "status"

# Проверьте доступность веб-интерфейса
curl http://localhost
```

---

## 🌐 Доступ к VSS из Windows

### Вариант 1: Прямой доступ по IP

Откройте в браузере на Windows хосте:

```
http://192.168.x.x        - VSS Web UI
http://192.168.x.x:15672  - RabbitMQ Management
http://192.168.x.x:3001   - Grafana
http://192.168.x.x:9090   - Prometheus
```

### Вариант 2: Port Forwarding через Hyper-V

**На Windows (PowerShell):**

```powershell
# Пробросьте порты с VM на хост
$vmIP = "192.168.x.x"  # IP вашей VM

# Основные порты VSS
netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=80 connectaddress=$vmIP
netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=$vmIP
netsh interface portproxy add v4tov4 listenport=15672 listenaddress=0.0.0.0 connectport=15672 connectaddress=$vmIP

# Проверьте правила
netsh interface portproxy show all

# Откройте порты в Firewall
New-NetFirewallRule -DisplayName "VSS-HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "VSS-Grafana" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
New-NetFirewallRule -DisplayName "VSS-RabbitMQ" -Direction Inbound -Protocol TCP -LocalPort 15672 -Action Allow
```

Теперь можете открыть:
```
http://localhost         - VSS Web UI
http://localhost:3001    - Grafana
http://localhost:15672   - RabbitMQ
```

---

## 🔧 Полезные команды

### Управление VM (Hyper-V):

```powershell
# Запустить VM
Start-VM -Name "VSS-Linux-VM"

# Остановить VM
Stop-VM -Name "VSS-Linux-VM"

# Подключиться к VM
vmconnect.exe localhost "VSS-Linux-VM"

# Создать снимок (checkpoint)
Checkpoint-VM -Name "VSS-Linux-VM" -SnapshotName "Before-VSS-Install"

# Восстановить снимок
Restore-VMSnapshot -Name "Before-VSS-Install" -VMName "VSS-Linux-VM" -Confirm:$false
```

### SSH подключение к VM:

```powershell
# С Windows хоста
ssh vssadmin@192.168.x.x

# Или через PuTTY
```

### Управление VSS в VM:

```bash
# Статус всех сервисов
docker compose -f docker-compose.vss-demiurge.yml ps

# Логи
docker compose -f docker-compose.vss-demiurge.yml logs -f

# Остановка
docker compose -f docker-compose.vss-demiurge.yml down

# Запуск
docker compose -f docker-compose.vss-demiurge.yml up -d

# Перезапуск конкретного сервиса
docker compose -f docker-compose.vss-demiurge.yml restart freeswitch

# FreeSWITCH консоль
docker exec -it vss-freeswitch fs_cli -p ClueCon
```

---

## 📊 Рекомендуемые характеристики VM

### Минимальные:
- **CPU:** 4 ядра
- **RAM:** 8 GB
- **Диск:** 50 GB
- **Сеть:** Bridged или NAT с портфорвардингом

### Рекомендуемые:
- **CPU:** 8 ядер
- **RAM:** 16 GB
- **Диск:** 100 GB SSD
- **Сеть:** Bridged для прямого доступа

### Для Production:
- **CPU:** 16+ ядер
- **RAM:** 32 GB
- **Диск:** 200+ GB SSD
- **Сеть:** Dedicated NIC

---

## 🔒 Безопасность

### В VM:

```bash
# Настройте UFW (Uncomplicated Firewall)
sudo ufw enable

# Разрешите SSH
sudo ufw allow ssh

# Разрешите порты VSS
sudo ufw allow 80/tcp
sudo ufw allow 3000:3001/tcp
sudo ufw allow 5060/udp
sudo ufw allow 5080/udp
sudo ufw allow 8080/tcp
sudo ufw allow 15672/tcp

# Проверьте статус
sudo ufw status
```

### Смените пароли:

```bash
# В VSS после первого входа смените:
# - admin / admin123 → новый пароль
# - Все пароли в .env файле
```

---

## ✅ Быстрый старт (итоговый чеклист)

1. ☐ Включите Hyper-V на Windows Server
2. ☐ Скачайте Ubuntu Server 22.04 ISO
3. ☐ Создайте VM с минимум 8GB RAM и 4 CPU
4. ☐ Установите Ubuntu Server
5. ☐ Установите Docker в VM
6. ☐ Скопируйте проект VSS в VM
7. ☐ Запустите `docker compose -f docker-compose.vss-demiurge.yml up -d`
8. ☐ Настройте доступ с Windows хоста
9. ☐ Откройте http://VM-IP в браузере
10. ☐ Войдите с admin/admin123
11. ☐ Смените все пароли!

---

## 🎯 Альтернатива: Готовый скрипт установки

Создайте файл `vm-setup.sh` в VM:

```bash
#!/bin/bash

echo "🚀 Автоматическая установка VSS OMNI TELECOM"

# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo apt install -y docker-compose-plugin

# Клонирование проекта (если есть Git URL)
# git clone <URL> ~/vss-omni-telecom

# Или распаковка архива
# unzip ~/vss-project.zip -d ~/

cd ~/vss-omni-telecom

# Запуск VSS
docker compose -f docker-compose.vss-demiurge.yml up -d

echo "✅ VSS запущен!"
echo "🌐 Откройте в браузере: http://$(hostname -I | awk '{print $1}')"
echo "👤 Логин: admin / Пароль: admin123"
```

Запустите:

```bash
chmod +x vm-setup.sh
./vm-setup.sh
```

---

## 💡 Советы и рекомендации

1. **Снимки VM:** Делайте снимки перед важными изменениями
2. **Резервное копирование:** Настройте автоматический backup VM
3. **Мониторинг:** Используйте Grafana для мониторинга ресурсов VM
4. **Сеть:** Используйте Bridged адаптер для лучшей производительности
5. **Обновления:** Регулярно обновляйте Ubuntu и Docker

---

## ❓ Частые проблемы

### VM не запускается:
```powershell
# Проверьте Hyper-V
Get-VM | Select Name, State
Get-VMIntegrationService -VMName "VSS-Linux-VM"
```

### Нет доступа к VM с Windows:
```bash
# В VM проверьте IP
ip addr show

# Проверьте firewall
sudo ufw status
```

### Docker не запускается:
```bash
# Проверьте статус Docker
sudo systemctl status docker

# Перезапустите Docker
sudo systemctl restart docker
```

---

## 📚 Дополнительные ресурсы

- [Ubuntu Server Guide](https://ubuntu.com/server/docs)
- [Hyper-V Documentation](https://docs.microsoft.com/virtualization/hyper-v-on-windows/)
- [Docker Documentation](https://docs.docker.com/)
- [VSS-BEGINNER-GUIDE.md](VSS-BEGINNER-GUIDE.md) - Руководство для новичков
- [FREESWITCH-QUICK-START.md](FREESWITCH-QUICK-START.md) - FreeSWITCH справочник

---

**Версия:** 1.0  
**Дата:** 2025-01-XX  
**Автор:** VSS Development Team  

**Удачи с развертыванием! 🚀**





