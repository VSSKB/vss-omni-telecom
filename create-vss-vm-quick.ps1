# Автоматическое создание VM для VSS
Write-Host ' Создание VM для VSS OMNI TELECOM' -ForegroundColor Green
$VMName = 'VSS-Ubuntu'
$ISOPath = Read-Host 'Введите путь к Ubuntu ISO'
if (-not (Test-Path $ISOPath)) {
    Write-Host ' ISO не найден!' -ForegroundColor Red
    Write-Host 'Скачайте: https://ubuntu.com/download/server' -ForegroundColor Yellow
    exit
}
Write-Host ' ISO найден! Создаю VM...' -ForegroundColor Green
New-VHD -Path "C:\Hyper-V\$VMName\$VMName.vhdx" -SizeBytes 50GB -Dynamic
New-VM -Name $VMName -MemoryStartupBytes 8GB -Generation 2 -VHDPath "C:\Hyper-V\$VMName\$VMName.vhdx" -SwitchName 'Default Switch'
Set-VMProcessor -VMName $VMName -Count 4
Set-VMFirmware -VMName $VMName -EnableSecureBoot Off
Add-VMDvdDrive -VMName $VMName -Path $ISOPath
Write-Host ' VM создана! Запускаю...' -ForegroundColor Green
Start-VM -Name $VMName
vmconnect.exe localhost $VMName
