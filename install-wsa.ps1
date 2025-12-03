# Скрипт установки Windows Subsystem for Android (WSA)
# Для Windows Server 2022 (неофициальная поддержка)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Установка Windows Subsystem for Android" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Проверка прав администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ Требуются права администратора!" -ForegroundColor Red
    Write-Host "Запустите скрипт от имени администратора.`n" -ForegroundColor Yellow
    exit 1
}

# Проверка системы
$osVersion = (Get-CimInstance Win32_OperatingSystem).Version
$osName = (Get-CimInstance Win32_OperatingSystem).Caption
Write-Host "Система: $osName" -ForegroundColor Yellow
Write-Host "Версия: $osVersion`n" -ForegroundColor Yellow

# Проверка, установлен ли уже WSA
$existingWSA = Get-AppxPackage | Where-Object {$_.Name -like "*WindowsSubsystemForAndroid*"}
if ($existingWSA) {
    Write-Host "✅ WSA уже установлен!" -ForegroundColor Green
    $existingWSA | Format-Table Name, Version, PackageFullName
    exit 0
}

Write-Host "⚠️  ВАЖНО: WSA официально не поддерживается на Windows Server 2022!" -ForegroundColor Red
Write-Host "Microsoft прекращает поддержку WSA с марта 2025 года.`n" -ForegroundColor Yellow

# Проверка требований
Write-Host "Проверка требований..." -ForegroundColor Cyan

# 1. Проверка Virtual Machine Platform
$vmPlatform = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -ErrorAction SilentlyContinue
if ($vmPlatform -and $vmPlatform.State -ne "Enabled") {
    Write-Host "Включение Virtual Machine Platform..." -ForegroundColor Yellow
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart | Out-Null
    Write-Host "✅ Virtual Machine Platform включен" -ForegroundColor Green
} elseif ($vmPlatform -and $vmPlatform.State -eq "Enabled") {
    Write-Host "✅ Virtual Machine Platform включен" -ForegroundColor Green
} else {
    Write-Host "⚠️  Virtual Machine Platform недоступен" -ForegroundColor Yellow
}

# 2. Проверка WSL
$wsl = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -ErrorAction SilentlyContinue
if ($wsl -and $wsl.State -ne "Enabled") {
    Write-Host "Включение WSL..." -ForegroundColor Yellow
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart | Out-Null
    Write-Host "✅ WSL включен" -ForegroundColor Green
} elseif ($wsl -and $wsl.State -eq "Enabled") {
    Write-Host "✅ WSL включен" -ForegroundColor Green
} else {
    Write-Host "⚠️  WSL недоступен" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Попытка установки WSA" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Создание временной директории
$tempDir = "$env:TEMP\WSA_Install"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

# Попытка скачать WSA с GitHub (WSABuilds)
Write-Host "Попытка 1: Скачивание WSA с GitHub (WSABuilds)..." -ForegroundColor Yellow
$wsaZipUrl = "https://github.com/MustardChef/WSABuilds/releases/latest/download/MagiskOnWSALTS.zip"
$zipPath = "$tempDir\WSA.zip"

try {
    $ProgressPreference = 'SilentlyContinue'
    Write-Host "Скачивание: $wsaZipUrl" -ForegroundColor Gray
    Invoke-WebRequest -Uri $wsaZipUrl -OutFile $zipPath -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Файл скачан: $zipPath" -ForegroundColor Green
    
    # Распаковка
    Write-Host "Распаковка архива..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath "$tempDir\WSA" -Force
    
    # Поиск файла .msixbundle
    $msixFiles = Get-ChildItem -Path "$tempDir\WSA" -Filter "*.msixbundle" -Recurse
    if ($msixFiles.Count -gt 0) {
        $msixPath = $msixFiles[0].FullName
        Write-Host "✅ Найден пакет: $msixPath" -ForegroundColor Green
        
        Write-Host "`nУстановка WSA..." -ForegroundColor Yellow
        try {
            Add-AppxPackage -Path $msixPath -ErrorAction Stop
            Write-Host "✅ WSA успешно установлен!" -ForegroundColor Green
            
            # Проверка установки
            Start-Sleep -Seconds 2
            $installed = Get-AppxPackage | Where-Object {$_.Name -like "*WindowsSubsystemForAndroid*"}
            if ($installed) {
                Write-Host "`n✅ Установка подтверждена!" -ForegroundColor Green
                $installed | Format-Table Name, Version
                exit 0
            }
        } catch {
            Write-Host "❌ Ошибка установки: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Файл .msixbundle не найден в архиве" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Ошибка скачивания: $_" -ForegroundColor Red
}

# Попытка 2: Использование прямого пакета Microsoft Store
Write-Host "`nПопытка 2: Прямая установка через Microsoft Store API..." -ForegroundColor Yellow

# URL для получения прямого пакета WSA
$storeApiUrl = "https://store.rg-adguard.net/api/GetFiles"
$packageId = "9P3395VX91NR" # Windows Subsystem for Android

try {
    Write-Host "Попытка получить прямой URL пакета..." -ForegroundColor Gray
    # Это сложнее, так как требует парсинг страницы store.rg-adguard.net
    Write-Host "⚠️  Требуется ручное скачивание с https://store.rg-adguard.net/" -ForegroundColor Yellow
    Write-Host "   Поиск: MicrosoftCorporationII.WindowsSubsystemForAndroid" -ForegroundColor Gray
} catch {
    Write-Host "❌ Не удалось получить пакет через Store API" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Red
Write-Host "Установка WSA не удалась" -ForegroundColor Red
Write-Host "========================================`n" -ForegroundColor Red

Write-Host "Причины:" -ForegroundColor Yellow
Write-Host "1. WSA не поддерживается на Windows Server 2022" -ForegroundColor White
Write-Host "2. Microsoft прекращает поддержку WSA с марта 2025" -ForegroundColor White
Write-Host "3. Требуется Windows 11 для официальной поддержки`n" -ForegroundColor White

Write-Host "Рекомендуется использовать альтернативные эмуляторы:" -ForegroundColor Cyan
Write-Host "1. BlueStacks (install-bluestacks.ps1)" -ForegroundColor Yellow
Write-Host "2. Android Studio (install-android-studio.ps1)`n" -ForegroundColor Yellow

Write-Host "Запустите следующие скрипты для установки альтернатив:" -ForegroundColor Green
Write-Host "  .\install-bluestacks.ps1" -ForegroundColor Cyan
Write-Host "  .\install-android-studio.ps1`n" -ForegroundColor Cyan

# Очистка временных файлов
if (Test-Path $tempDir) {
    Write-Host "Очистка временных файлов..." -ForegroundColor Gray
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

exit 1
