# Исправление VM с правильным Ubuntu ISO

Write-Host "`n🔧 Исправление VM с правильным ISO" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Green

$VMName = "VSS-Ubuntu"

# Найти скачанный ISO
Write-Host "`n📀 Поиск Ubuntu ISO..." -ForegroundColor Cyan
$isoFiles = Get-ChildItem "C:\ISO\" -Filter "ubuntu*.iso" | Sort-Object Length -Descending

if ($isoFiles.Count -eq 0) {
    Write-Host "❌ ISO файлы не найдены в C:\ISO\" -ForegroundColor Red
    Write-Host "`n💡 Скачайте Ubuntu Server ISO:" -ForegroundColor Yellow
    Write-Host "   https://ubuntu.com/download/server" -ForegroundColor White
    exit
}

Write-Host "`nНайденные ISO файлы:" -ForegroundColor Cyan
$i = 1
foreach ($iso in $isoFiles) {
    $sizeMB = [math]::Round($iso.Length / 1MB, 2)
    $sizeGB = [math]::Round($iso.Length / 1GB, 2)
    
    if ($sizeMB -gt 1000) {
        Write-Host "  $i. $($iso.Name) - $sizeGB GB ✅" -ForegroundColor Green
    } else {
        Write-Host "  $i. $($iso.Name) - $sizeMB MB ⚠️  (слишком маленький)" -ForegroundColor Yellow
    }
    $i++
}

# Выбрать самый большой ISO (вероятно правильный)
$correctISO = $isoFiles[0]
$isoPath = $correctISO.FullName

Write-Host "`n✅ Использую: $($correctISO.Name)" -ForegroundColor Green
Write-Host "   Путь: $isoPath" -ForegroundColor White
Write-Host "   Размер: $([math]::Round($correctISO.Length / 1GB, 2)) GB" -ForegroundColor White

# Остановить VM
Write-Host "`n⏹️  Остановка VM..." -ForegroundColor Cyan
Stop-VM -Name $VMName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "✅ VM остановлена" -ForegroundColor Green

# Обновить ISO
Write-Host "`n💿 Обновление ISO в VM..." -ForegroundColor Cyan
$dvd = Get-VMDvdDrive -VMName $VMName

# Отключить старый ISO
Set-VMDvdDrive -VMName $VMName `
    -ControllerNumber $dvd.ControllerNumber `
    -ControllerLocation $dvd.ControllerLocation `
    -Path $null

# Подключить новый ISO
Set-VMDvdDrive -VMName $VMName `
    -ControllerNumber $dvd.ControllerNumber `
    -ControllerLocation $dvd.ControllerLocation `
    -Path $isoPath

Write-Host "✅ ISO обновлен" -ForegroundColor Green

# Настроить boot order - DVD первым
Write-Host "`n🥾 Настройка порядка загрузки..." -ForegroundColor Cyan
$dvdBoot = Get-VMDvdDrive -VMName $VMName
Set-VMFirmware -VMName $VMName -FirstBootDevice $dvdBoot
Write-Host "✅ DVD установлен первым в boot order" -ForegroundColor Green

# Запустить VM
Write-Host "`n🚀 Запуск VM..." -ForegroundColor Cyan
Start-VM -Name $VMName
Start-Sleep -Seconds 3
Write-Host "✅ VM запущена" -ForegroundColor Green

# Открыть консоль
Write-Host "`n🖥️  Открытие консоли..." -ForegroundColor Cyan
Start-Process "vmconnect.exe" -ArgumentList "localhost","$VMName"

Write-Host "`n" -NoNewline
Write-Host "=" * 50 -ForegroundColor Green
Write-Host "✅ Готово! VM запущена с правильным ISO!" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Green
Write-Host ""
Write-Host "📋 Теперь в консоли VM:" -ForegroundColor Yellow
Write-Host "   1. Выберите 'Try or Install Ubuntu Server'" -ForegroundColor White
Write-Host "   2. Следуйте установщику" -ForegroundColor White
Write-Host "   3. Username: vss, Password: vss123" -ForegroundColor White
Write-Host "   4. ✅ Install OpenSSH server" -ForegroundColor White
Write-Host "   5. ✅ Install Docker" -ForegroundColor White
Write-Host ""
Write-Host "📖 Детали: AFTER-VM-INSTALL.md" -ForegroundColor Cyan
Write-Host ""

