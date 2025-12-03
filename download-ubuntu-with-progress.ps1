# Загрузка Ubuntu Server ISO с отображением прогресса

Write-Host "`n" -NoNewline
Write-Host "=" * 70 -ForegroundColor Green
Write-Host "  📥 ЗАГРУЗКА UBUNTU SERVER ISO С ПРОГРЕССОМ" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Green
Write-Host ""

$url = "https://releases.ubuntu.com/22.04.3/ubuntu-22.04.3-live-server-amd64.iso"
$output = "C:\ISO\ubuntu-22.04.3-server.iso"
$expectedSizeMB = 1987  # Примерный размер в MB

# Создать директорию
if (-not (Test-Path "C:\ISO")) {
    New-Item -ItemType Directory -Path "C:\ISO" -Force | Out-Null
    Write-Host "✅ Создана папка C:\ISO\" -ForegroundColor Green
}

# Удалить старый файл
if (Test-Path $output) {
    Write-Host "🗑️  Удаление старого файла..." -ForegroundColor Yellow
    Remove-Item $output -Force
}

Write-Host "📋 Информация о загрузке:" -ForegroundColor Cyan
Write-Host "   URL:    $url" -ForegroundColor White
Write-Host "   Файл:   $output" -ForegroundColor White
Write-Host "   Размер: ~1.9 GB" -ForegroundColor White
Write-Host ""
Write-Host "⏳ Загрузка началась... Пожалуйста, подождите." -ForegroundColor Yellow
Write-Host ""

# Использовать Invoke-WebRequest с прогрессом
try {
    # Настройка прогресса
    $ProgressPreference = 'Continue'
    
    # Загрузка с прогрессом
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor Green
    Write-Host "✅ ЗАГРУЗКА УСПЕШНО ЗАВЕРШЕНА!" -ForegroundColor Green
    Write-Host "=" * 70 -ForegroundColor Green
    Write-Host ""
    
    $fileInfo = Get-Item $output
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    $sizeGB = [math]::Round($fileInfo.Length / 1GB, 2)
    
    Write-Host "📊 Детали файла:" -ForegroundColor Cyan
    Write-Host "   Имя:    $($fileInfo.Name)" -ForegroundColor White
    Write-Host "   Размер: $sizeGB GB ($sizeMB MB)" -ForegroundColor White
    Write-Host "   Путь:   $($fileInfo.FullName)" -ForegroundColor White
    Write-Host ""
    
    if ($sizeMB -gt 1500) {
        Write-Host "✅ Размер правильный! ISO готов к использованию." -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 Следующий шаг - исправить VM:" -ForegroundColor Yellow
        Write-Host "   Запустите: .\fix-vm-iso.ps1" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Предупреждение: Размер меньше ожидаемого!" -ForegroundColor Red
        Write-Host "   Возможно, загрузка прервалась." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor Red
    Write-Host "❌ ОШИБКА ЗАГРУЗКИ!" -ForegroundColor Red
    Write-Host "=" * 70 -ForegroundColor Red
    Write-Host ""
    Write-Host "Детали ошибки:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Попробуйте:" -ForegroundColor Yellow
    Write-Host "   1. Проверьте интернет соединение" -ForegroundColor White
    Write-Host "   2. Запустите скрипт снова" -ForegroundColor White
    Write-Host "   3. Или скачайте вручную: https://ubuntu.com/download/server" -ForegroundColor White
}

Write-Host ""
Write-Host "Нажмите Enter для продолжения..." -ForegroundColor Gray
$null = Read-Host

