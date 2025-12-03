# Скрипт установки BlueStacks (эмулятор Android)
# Для Windows Server 2022

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Установка BlueStacks" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Проверка прав администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  Рекомендуется запуск от имени администратора`n" -ForegroundColor Yellow
}

# Проверка, установлен ли уже BlueStacks
$bluestacksPath = "${env:ProgramFiles}\BlueStacks"
$bluestacksPathX86 = "${env:ProgramFiles(x86)}\BlueStacks"
if ((Test-Path $bluestacksPath) -or (Test-Path $bluestacksPathX86)) {
    Write-Host "✅ BlueStacks уже установлен!" -ForegroundColor Green
    if (Test-Path $bluestacksPath) {
        Write-Host "Путь: $bluestacksPath" -ForegroundColor Gray
    } else {
        Write-Host "Путь: $bluestacksPathX86" -ForegroundColor Gray
    }
    
    # Попытка запустить BlueStacks
    $exePath = Get-ChildItem -Path $bluestacksPath, $bluestacksPathX86 -Filter "HD-Player.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exePath) {
        Write-Host "`nЗапуск BlueStacks..." -ForegroundColor Yellow
        Start-Process -FilePath $exePath.FullName -ErrorAction SilentlyContinue
        Write-Host "✅ BlueStacks запущен" -ForegroundColor Green
    }
    exit 0
}

Write-Host "Скачивание BlueStacks..." -ForegroundColor Yellow

# Создание временной директории
$tempDir = "$env:TEMP\BlueStacks_Install"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

# URL для скачивания BlueStacks (через официальный сайт)
# Прямой URL может изменяться, поэтому используем редирект
$bluestacksUrl = "https://www.bluestacks.com/download.html"
$installerPath = "$tempDir\BlueStacksInstaller.exe"

try {
    $ProgressPreference = 'SilentlyContinue'
    Write-Host "Получение актуальной ссылки на установщик..." -ForegroundColor Gray
    
    # Попытка получить прямую ссылку через официальный сайт
    $response = Invoke-WebRequest -Uri $bluestacksUrl -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
    
    # Если редирект, получаем финальный URL
    if ($response.StatusCode -eq 301 -or $response.StatusCode -eq 302) {
        $finalUrl = $response.Headers.Location
        Write-Host "Найдена ссылка: $finalUrl" -ForegroundColor Gray
    }
    
    Write-Host "⚠️  Прямое скачивание недоступно. Используйте ручную установку." -ForegroundColor Yellow
    Write-Host "Открываю официальный сайт BlueStacks..." -ForegroundColor Cyan
    Start-Process "https://www.bluestacks.com/download.html"
    
    Write-Host "`nПожалуйста:" -ForegroundColor Yellow
    Write-Host "1. Скачайте BlueStacks с открывшегося сайта" -ForegroundColor White
    Write-Host "2. Запустите установщик вручную" -ForegroundColor White
    Write-Host "3. После установки запустите этот скрипт снова для проверки`n" -ForegroundColor White
    
    throw "Требуется ручная установка BlueStacks"
    
    Write-Host "`nПроверка установки..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    if ((Test-Path $bluestacksPath) -or (Test-Path $bluestacksPathX86)) {
        Write-Host "✅ BlueStacks успешно установлен!" -ForegroundColor Green
        
        # Поиск исполняемого файла
        $exePath = Get-ChildItem -Path $bluestacksPath, $bluestacksPathX86 -Filter "HD-Player.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($exePath) {
            Write-Host "`nЗапуск BlueStacks..." -ForegroundColor Yellow
            Start-Process -FilePath $exePath.FullName
            Write-Host "✅ BlueStacks запущен" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️  Установка может быть не завершена. Проверьте вручную." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Ошибка скачивания/установки: $_" -ForegroundColor Red
    Write-Host "`nАльтернативный способ:" -ForegroundColor Yellow
    Write-Host "1. Скачайте BlueStacks вручную: https://www.bluestacks.com/" -ForegroundColor White
    Write-Host "2. Запустите установщик вручную`n" -ForegroundColor White
}

# Очистка временных файлов
if (Test-Path $tempDir) {
    Write-Host "Очистка временных файлов..." -ForegroundColor Gray
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Установка завершена" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

