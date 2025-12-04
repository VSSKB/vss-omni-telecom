# 🐧 Запуск VSS на Linux VM

**Полное руководство по развертыванию VSS OMNI TELECOM на Linux виртуальной машине**

---

## 📋 Что вам понадобится

- Windows Server с Hyper-V / VirtualBox / VMware
- Ubuntu 22.04 LTS ISO образ (скачать: https://ubuntu.com/download/server)
- 8GB+ RAM для VM
- 50GB+ дискового пространства
- Интернет подключение

---

## Вариант 1: Hyper-V (Рекомендуется для Windows Server)

### Шаг 1: Создание VM в Hyper-V

```powershell
# 1. Откройте Hyper-V Manager
Start-Process virtmgmt.msc

# 2. Или создайте VM через PowerShell:
$VMName = "VSS-Ubuntu"
$VMPath = "C:\VMs"
$ISOPath = "C:\ISO\ubuntu-22.04-server-amd64.iso"

New-VM -Name $VMName -MemoryStartupBytes 8GB -Generation 2 -NewVHDPath "$VMPath\$VMName.vhdx" -NewVHDSizeBytes 50GB -Path $VMPath

Set-VMProcessor -VMName $VMName -Count 4
Add-VMDvdDrive -VMName $VMName -Path $ISOPath
Start-VM -Name $VMName
```

### Шаг 2: Установка Ubuntu

1. Подключитесь к VM через Hyper-V Manager → Connect
2. Следуйте инструкциям установщика Ubuntu:
   - Language: English
   - Keyboard: English (US)
   - Network: Auto (DHCP)
   - Storage: Use entire disk
   - Profile:
     - Your name: VSS Admin
     - Server name: vss-ubuntu
     - Username: **vss**
     - Password: **[придумайте надежный пароль]**
   - SSH: ✅ Install OpenSSH server
3. Дождитесь завершения установки и перезагрузки

### Шаг 3: Настройка сети

После установки войдите в VM и настройте статический IP (опционально):

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Замените содержимое на:

```yaml
network:
  ethernets:
    eth0:
      addresses:
        - 192.168.1.100/24  # Выберите свободный IP в вашей сети
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

## Вариант 2: VirtualBox

### Создание VM:

1. Откройте VirtualBox
2. New → Create Virtual Machine:
   - Name: VSS-Ubuntu
   - Type: Linux
   - Version: Ubuntu (64-bit)
   - Memory: 8192 MB
   - Create virtual hard disk (50 GB, VDI, Dynamically allocated)
3. Settings → System → Processor: 4 CPUs
4. Settings → Storage → Add ISO образ Ubuntu
5. Settings → Network → Adapter 1: Bridged Adapter
6. Start → Установите Ubuntu (см. Шаг 2 выше)

---

## Вариант 3: VMware Workstation

### Создание VM:

1. File → New Virtual Machine
2. Typical → Installer disc image (ISO): Выберите Ubuntu ISO
3. Full name: VSS Admin, Username: vss, Password: [ваш пароль]
4. Virtual machine name: VSS-Ubuntu
5. Disk size: 50 GB, Store as single file
6. Customize Hardware:
   - Memory: 8 GB
   - Processors: 4 cores
   - Network: Bridged
7. Finish → Дождитесь автоматической установки

---

## 🔧 Настройка Ubuntu VM

### После первого входа выполните:

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y curl wget git nano net-tools openssh-server

# Проверка IP адреса
ip addr show

# Запомните IP адрес (например, 192.168.1.100)
```

---

## 🐳 Установка Docker на Ubuntu VM

Выполните следующие команды на Ubuntu VM:

```bash
# Удаление старых версий Docker (если есть)
sudo apt remove docker docker-engine docker.io containerd runc

# Установка зависимостей
sudo apt update
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Добавление официального GPG ключа Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавление репозитория Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Применение изменений (выход и вход)
newgrp docker

# Проверка установки
docker --version
docker compose version
```

---

## 📦 Копирование VSS на Linux VM

### Со стороны Windows Server:

```powershell
# Запустите скрипт копирования
.\copy-vss-to-vm.ps1

# Или вручную:
$LinuxIP = "192.168.1.100"  # IP вашей Ubuntu VM
$LinuxUser = "vss"

# Копирование проекта
scp -r C:\Users\Administrator\Documents\vss-omni-telecom ${LinuxUser}@${LinuxIP}:~/

# Если scp не работает, используйте WinSCP или FileZilla
```

### Альтернатива - клонирование через Git:

На Ubuntu VM:

```bash
cd ~
git clone https://github.com/your-repo/vss-omni-telecom.git
cd vss-omni-telecom
```

---

## 🚀 Запуск VSS на Linux VM

### Подключитесь к VM через SSH:

Из Windows PowerShell:

```powershell
ssh vss@192.168.1.100  # Замените на IP вашей VM
```

### На Ubuntu VM выполните:

```bash
# Перейдите в папку проекта
cd ~/vss-omni-telecom

# Проверьте наличие файлов
ls -la

# Запустите полный стек VSS с FreeSWITCH
docker compose -f docker-compose.vss-demiurge.yml up -d

# Дождитесь запуска (первый раз 5-10 минут)
# Проверьте статус
docker compose -f docker-compose.vss-demiurge.yml ps

# Посмотрите логи
docker compose -f docker-compose.vss-demiurge.yml logs -f
```

---

## 🌐 Доступ к VSS из Windows

После успешного запуска, откройте в браузере на Windows:

| Сервис | URL | Логин | Пароль |
|--------|-----|-------|---------|
| **VSS Dashboard** | http://192.168.1.100 | admin | admin123 |
| **RabbitMQ** | http://192.168.1.100:15672 | vss-admin | vss_rabbit_pass |
| **Grafana** | http://192.168.1.100:3001 | admin | vss_grafana_pass |
| **Prometheus** | http://192.168.1.100:9090 | - | - |
| **Guacamole** | http://192.168.1.100:8080/guacamole | guacadmin | guacadmin |

**Замените 192.168.1.100 на IP вашей VM!**

---

## ✅ Проверка работы

### На Ubuntu VM:

```bash
# Проверить все контейнеры
docker ps

# Проверить FreeSWITCH
docker exec -it vss-freeswitch fs_cli -p ClueCon -x "status"

# Проверить логи
docker compose logs freeswitch
docker compose logs asterisk
docker compose logs vss-workspace
```

### Тестовый SIP звонок:

1. Настройте SIP клиент на Windows:
   - Сервер: **192.168.1.100**
   - Порт: **5080**
   - Логин: **1000**
   - Пароль: **1234**

2. Позвоните на тестовые номера:
   - **9196** - Echo Test (FreeSWITCH)
   - **9195** - Hold Music

---

## 🔧 Полезные команды

### Управление VM:

```powershell
# Hyper-V
Get-VM                              # Список VM
Start-VM -Name "VSS-Ubuntu"         # Запустить VM
Stop-VM -Name "VSS-Ubuntu"          # Остановить VM
Restart-VM -Name "VSS-Ubuntu"       # Перезапустить VM
```

### Управление VSS на Linux:

```bash
# Запуск
docker compose -f docker-compose.vss-demiurge.yml up -d

# Остановка
docker compose -f docker-compose.vss-demiurge.yml down

# Перезапуск
docker compose -f docker-compose.vss-demiurge.yml restart

# Логи
docker compose -f docker-compose.vss-demiurge.yml logs -f

# Статус
docker compose -f docker-compose.vss-demiurge.yml ps

# Использование ресурсов
docker stats
```

---

## 📊 Мониторинг ресурсов VM

### На Ubuntu VM:

```bash
# CPU и память
htop

# Дисковое пространство
df -h

# Сетевая активность
ifconfig
netstat -tulpn

# Docker ресурсы
docker stats
```

---

## 🔒 Безопасность

### Рекомендации:

1. **Смените все пароли по умолчанию!**
2. **Настройте firewall:**
   ```bash
   sudo ufw enable
   sudo ufw allow ssh
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 5060/udp
   sudo ufw allow 5080/udp
   sudo ufw allow 5081/tcp
   sudo ufw allow 8021/tcp
   sudo ufw allow 15672/tcp
   sudo ufw allow 3001/tcp
   ```

3. **Обновляйте систему:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Настройте автоматические обновления безопасности:**
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

---

## 🚨 Устранение проблем

### VM не запускается:
- Проверьте, включена ли виртуализация в BIOS
- Убедитесь, что роль Hyper-V установлена в Windows Server

### Нет доступа по SSH:
```bash
# На Ubuntu VM проверьте SSH
sudo systemctl status ssh
sudo systemctl restart ssh
```

### Docker контейнеры не запускаются:
```bash
# Проверьте логи
docker compose logs

# Проверьте ресурсы
free -h
df -h
```

### Нет доступа из Windows:
- Проверьте IP адрес VM: `ip addr show`
- Проверьте firewall: `sudo ufw status`
- Ping VM из Windows: `ping 192.168.1.100`

---

## 📚 Дополнительная документация

После успешного запуска изучите:

1. **[VSS-BEGINNER-GUIDE.md](VSS-BEGINNER-GUIDE.md)** - руководство для начинающих
2. **[FREESWITCH-QUICK-START.md](FREESWITCH-QUICK-START.md)** - работа с FreeSWITCH
3. **[VSS-MANUAL.md](VSS-MANUAL.md)** - полное руководство пользователя
4. **[API-DOCUMENTATION.md](API-DOCUMENTATION.md)** - API документация

---

## ✅ Чеклист установки

- [ ] Ubuntu VM создана и запущена
- [ ] SSH доступ настроен
- [ ] Docker установлен на VM
- [ ] VSS проект скопирован на VM
- [ ] Docker Compose запущен
- [ ] Все контейнеры в статусе "running"
- [ ] Веб-интерфейс доступен из Windows
- [ ] FreeSWITCH отвечает
- [ ] Тестовый звонок работает
- [ ] Пароли изменены

---

**Готово! Теперь VSS работает на Linux VM! 🎉**

**Версия:** 1.0  
**Дата:** 2025-01-XX  
**Для:** Windows Server + Linux VM


