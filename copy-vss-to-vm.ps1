# Скрипт для копирования VSS на Linux VM
Write-Host "📦 Копирование VSS на Linux VM" -ForegroundColor Green

$LinuxIP = Read-Host "Введите IP адрес Linux VM (например: 192.168.1.100)"
$LinuxUser = "vss"
$ProjectPath = "C:\Users\Administrator\Documents\vss-omni-telecom"

Write-Host "`n📤 Копирование файлов..." -ForegroundColor Cyan
Write-Host "Это может занять несколько минут..." -ForegroundColor Yellow

# Копирование через SCP
scp -r $ProjectPath ${LinuxUser}@${LinuxIP}:~/

Write-Host "`n✅ Файлы скопированы!" -ForegroundColor Green
Write-Host "`n🚀 Следующий шаг - подключитесь к VM и запустите VSS:" -ForegroundColor Cyan
Write-Host "   ssh ${LinuxUser}@${LinuxIP}" -ForegroundColor White
Write-Host "   cd ~/vss-omni-telecom" -ForegroundColor White
Write-Host "   docker compose -f docker-compose.vss-demiurge.yml up -d" -ForegroundColor White

