# Автоматизированная настройка Ubuntu VM для VSS
# Скрипт для Windows Server с Hyper-V

Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║  VSS OMNI TELECOM - Установка на Ubuntu VM (Hyper-V)     ║
║  Автоматизированное развертывание                         ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Параметры VM
$VMName = "VSS-Ubuntu"
$VMPath = "C:\VMs"
$VHDPath = "$VMPath\$VMName\$VMName.vhdx"
$Memory = 8GB
$CPUCount = 4
$DiskSize = 50GB
$SwitchName = "External"  # Измените на имя вашего виртуального свитча

# Проверка наличия Hyper-V
Write-Host "`n[1/8] Проверка Hyper-V..." -ForegroundColor Yellow
$hyperv = Get-WindowsFeature -Name Hyper-V
if ($hyperv.Installed -eq $false) {
    Write-Host "❌ Hyper-V не установлен!" -ForegroundColor Red
    Write-Host "Установите Hyper-V командой:" -ForegroundColor Yellow
    Write-Host "   Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart" -ForegroundColor White
    exit 1
}
Write-Host "✅ Hyper-V установлен" -ForegroundColor Green

# Проверка ISO образа Ubuntu
Write-Host "`n[2/8] Проверка ISO образа Ubuntu..." -ForegroundColor Yellow
$ISOPath = Read-Host "Введите полный путь к Ubuntu ISO (например: C:\ISO\ubuntu-22.04-server-amd64.iso)"
if (-not (Test-Path $ISOPath)) {
    Write-Host "❌ ISO файл не найден!" -ForegroundColor Red
    Write-Host "Скачайте Ubuntu Server 22.04 LTS с: https://ubuntu.com/download/server" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ ISO найден: $ISOPath" -ForegroundColor Green

# Создание директории для VM
Write-Host "`n[3/8] Создание директории VM..." -ForegroundColor Yellow
if (-not (Test-Path $VMPath)) {
    New-Item -Path $VMPath -ItemType Directory -Force | Out-Null
}
Write-Host "✅ Директория создана: $VMPath" -ForegroundColor Green

# Проверка виртуального свитча
Write-Host "`n[4/8] Проверка виртуального свитча..." -ForegroundColor Yellow
$switch = Get-VMSwitch -Name $SwitchName -ErrorAction SilentlyContinue
if ($null -eq $switch) {
    Write-Host "⚠️  Свитч '$SwitchName' не найден" -ForegroundColor Yellow
    Write-Host "Доступные свитчи:" -ForegroundColor Cyan
    Get-VMSwitch | Format-Table Name, SwitchType
    $SwitchName = Read-Host "Введите имя существующего свитча или нажмите Enter для создания нового"
    
    if ([string]::IsNullOrWhiteSpace($SwitchName)) {
        $SwitchName = "VSS-External"
        Write-Host "Создание нового внешнего свитча: $SwitchName" -ForegroundColor Cyan
        $adapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1
        New-VMSwitch -Name $SwitchName -NetAdapterName $adapter.Name -AllowManagementOS $true
    }
}
Write-Host "✅ Виртуальный свитч: $SwitchName" -ForegroundColor Green

# Создание VM
Write-Host "`n[5/8] Создание виртуальной машины..." -ForegroundColor Yellow
try {
    # Проверка существования VM
    $existingVM = Get-VM -Name $VMName -ErrorAction SilentlyContinue
    if ($existingVM) {
        Write-Host "⚠️  VM '$VMName' уже существует!" -ForegroundColor Yellow
        $confirm = Read-Host "Удалить существующую VM? (yes/no)"
        if ($confirm -eq "yes") {
            Stop-VM -Name $VMName -Force -ErrorAction SilentlyContinue
            Remove-VM -Name $VMName -Force
            Remove-Item -Path "$VMPath\$VMName" -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            Write-Host "Отменено пользователем" -ForegroundColor Red
            exit 1
        }
    }

    # Создание новой VM
    New-VM -Name $VMName `
           -MemoryStartupBytes $Memory `
           -Generation 2 `
           -NewVHDPath $VHDPath `
           -NewVHDSizeBytes $DiskSize `
           -Path $VMPath `
           -SwitchName $SwitchName

    # Настройка VM
    Set-VMProcessor -VMName $VMName -Count $CPUCount
    Set-VMMemory -VMName $VMName -DynamicMemoryEnabled $false
    
    # Добавление DVD привода с ISO
    Add-VMDvdDrive -VMName $VMName -Path $ISOPath
    
    # Настройка порядка загрузки (сначала DVD)
    $dvd = Get-VMDvdDrive -VMName $VMName
    Set-VMFirmware -VMName $VMName -FirstBootDevice $dvd
    
    # Отключение Secure Boot для совместимости
    Set-VMFirmware -VMName $VMName -EnableSecureBoot Off

    Write-Host "✅ VM создана успешно!" -ForegroundColor Green
} catch {
    Write-Host "❌ Ошибка создания VM: $_" -ForegroundColor Red
    exit 1
}

# Запуск VM
Write-Host "`n[6/8] Запуск VM..." -ForegroundColor Yellow
Start-VM -Name $VMName
Write-Host "✅ VM запущена" -ForegroundColor Green

# Подключение к VM
Write-Host "`n[7/8] Открытие консоли VM..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
vmconnect.exe localhost $VMName

# Инструкции
Write-Host "`n[8/8] Следующие шаги:" -ForegroundColor Yellow
Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║  VM создана и запущена!                                   ║
╚═══════════════════════════════════════════════════════════╝

📋 УСТАНОВКА UBUNTU:

1. В открывшемся окне VM следуйте инструкциям установщика Ubuntu:
   - Language: English
   - Keyboard: English (US)
   - Network: Auto (DHCP)
   - Storage: Use entire disk
   - Profile Setup:
     * Your name: VSS Admin
     * Server name: vss-ubuntu
     * Username: vss
     * Password: [придумайте надежный пароль]
   - SSH Setup: ✅ Install OpenSSH server

2. Дождитесь завершения установки (15-20 минут)

3. После установки VM перезагрузится

4. Войдите в систему (username: vss)

5. Узнайте IP адрес:
   ip addr show

6. Выполните настройку Docker:
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker vss
   newgrp docker

7. Скопируйте VSS проект на VM:
   Вернитесь в Windows PowerShell и выполните:
   
   .\copy-vss-to-vm.ps1

8. Запустите VSS:
   ssh vss@<IP_АДРЕС_VM>
   cd ~/vss-omni-telecom
   docker compose -f docker-compose.vss-demiurge.yml up -d

╔═══════════════════════════════════════════════════════════╗
║  Полная документация: SETUP-LINUX-VM.md                  ║
╚═══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Host "`n✅ Настройка завершена! Установите Ubuntu в VM." -ForegroundColor Green
Write-Host "📖 Подробная инструкция: SETUP-LINUX-VM.md" -ForegroundColor Yellow


