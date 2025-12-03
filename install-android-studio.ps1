# Скрипт установки Android Studio с эмулятором Android
# Для Windows Server 2022

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Установка Android Studio" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Проверка прав администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  Рекомендуется запуск от имени администратора`n" -ForegroundColor Yellow
}

# Проверка, установлен ли уже Android Studio
$androidStudioPath = "${env:ProgramFiles}\Android\Android Studio"
$androidStudioPathX86 = "${env:ProgramFiles(x86)}\Android\Android Studio"
$localAppData = "${env:LOCALAPPDATA}\Android\Sdk"

if ((Test-Path $androidStudioPath) -or (Test-Path $androidStudioPathX86)) {
    Write-Host "✅ Android Studio уже установлен!" -ForegroundColor Green
    if (Test-Path $androidStudioPath) {
        Write-Host "Путь: $androidStudioPath" -ForegroundColor Gray
    } else {
        Write-Host "Путь: $androidStudioPathX86" -ForegroundColor Gray
    }
    
    if (Test-Path $localAppData) {
        Write-Host "Android SDK: $localAppData" -ForegroundColor Gray
    }
    
    # Попытка запустить Android Studio
    $exePath = Get-ChildItem -Path $androidStudioPath, $androidStudioPathX86 -Filter "studio64.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exePath) {
        Write-Host "`nЗапуск Android Studio..." -ForegroundColor Yellow
        Start-Process -FilePath $exePath.FullName -ErrorAction SilentlyContinue
        Write-Host "✅ Android Studio запущен" -ForegroundColor Green
    }
    exit 0
}

Write-Host "Скачивание Android Studio..." -ForegroundColor Yellow

# Создание временной директории
$tempDir = "$env:TEMP\AndroidStudio_Install"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

# URL для скачивания Android Studio (последняя версия)
# Используем прямой URL с официального сайта
$androidStudioUrl = "https://redirector.gvt1.com/edgedl/android/studio/install/2023.3.1.18/android-studio-2023.3.1.18-windows.exe"
$installerPath = "$tempDir\android-studio-installer.exe"

try {
    $ProgressPreference = 'SilentlyContinue'
    Write-Host "Скачивание установщика Android Studio..." -ForegroundColor Gray
    Write-Host "⚠️  Это может занять некоторое время (установщик ~1 GB)`n" -ForegroundColor Yellow
    
    # Попытка скачать через официальный сайт
    Write-Host "Попытка получить актуальную ссылку..." -ForegroundColor Gray
    
    # Используем стабильную версию
    $androidStudioUrl = "https://dl.google.com/dl/android/studio/install/2023.3.1.18/android-studio-2023.3.1.18-windows.exe"
    
    Invoke-WebRequest -Uri $androidStudioUrl -OutFile $installerPath -UseBasicParsing -ErrorAction Stop
    
    $fileSize = (Get-Item $installerPath).Length / 1MB
    Write-Host "✅ Установщик скачан: $installerPath ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
    
    Write-Host "`nЗапуск установщика Android Studio..." -ForegroundColor Yellow
    Write-Host "⚠️  Следуйте инструкциям в окне установщика`n" -ForegroundColor Yellow
    Write-Host "Рекомендации:" -ForegroundColor Cyan
    Write-Host "  - Установите Android SDK" -ForegroundColor White
    Write-Host "  - Установите Android Virtual Device (AVD)" -ForegroundColor White
    Write-Host "  - Выберите компоненты для эмулятора`n" -ForegroundColor White
    
    # Запуск установщика
    Start-Process -FilePath $installerPath -Wait
    
    Write-Host "`nПроверка установки..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    if ((Test-Path $androidStudioPath) -or (Test-Path $androidStudioPathX86)) {
        Write-Host "✅ Android Studio успешно установлен!" -ForegroundColor Green
        
        # Поиск исполняемого файла
        $exePath = Get-ChildItem -Path $androidStudioPath, $androidStudioPathX86 -Filter "studio64.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($exePath) {
            Write-Host "`nЗапуск Android Studio..." -ForegroundColor Yellow
            Start-Process -FilePath $exePath.FullName
            Write-Host "✅ Android Studio запущен" -ForegroundColor Green
            Write-Host "`nПосле первого запуска:" -ForegroundColor Cyan
            Write-Host "1. Настройте Android SDK" -ForegroundColor White
            Write-Host "2. Создайте виртуальное устройство (AVD)" -ForegroundColor White
            Write-Host "3. Запустите эмулятор Android`n" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️  Установка может быть не завершена. Проверьте вручную." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Ошибка скачивания/установки: $_" -ForegroundColor Red
    Write-Host "`nАльтернативный способ:" -ForegroundColor Yellow
    Write-Host "1. Скачайте Android Studio вручную: https://developer.android.com/studio" -ForegroundColor White
    Write-Host "2. Запустите установщик вручную`n" -ForegroundColor White
    Write-Host "Или используйте Chocolatey (если установлен):" -ForegroundColor Yellow
    Write-Host "  choco install androidstudio -y`n" -ForegroundColor Gray
}

# Очистка временных файлов
if (Test-Path $tempDir) {
    Write-Host "Очистка временных файлов..." -ForegroundColor Gray
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Установка завершена" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

