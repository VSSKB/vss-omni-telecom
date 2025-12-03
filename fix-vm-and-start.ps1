# Fix VM with correct Ubuntu ISO and start installation

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " FIX VM WITH UBUNTU ISO AND START" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

$VMName = "VSS-Ubuntu"

# Find ISO files
Write-Host "`nSearching for Ubuntu ISO..." -ForegroundColor Cyan
$isoFiles = Get-ChildItem "C:\ISO\" -Filter "*.iso" | Sort-Object Length -Descending

if ($isoFiles.Count -eq 0) {
    Write-Host "ERROR: No ISO files found in C:\ISO\" -ForegroundColor Red
    Write-Host "`nPlease download Ubuntu Server ISO:" -ForegroundColor Yellow
    Write-Host "https://ubuntu.com/download/server" -ForegroundColor White
    exit
}

Write-Host "`nFound ISO files:" -ForegroundColor Cyan
$i = 1
$correctISO = $null

foreach ($iso in $isoFiles) {
    $sizeGB = [math]::Round($iso.Length / 1GB, 2)
    
    if ($sizeGB -gt 1.5) {
        Write-Host "  $i. $($iso.Name) - $sizeGB GB (OK)" -ForegroundColor Green
        if ($null -eq $correctISO) { $correctISO = $iso }
    } else {
        Write-Host "  $i. $($iso.Name) - $sizeGB GB (TOO SMALL)" -ForegroundColor Yellow
    }
    $i++
}

if ($null -eq $correctISO) {
    Write-Host "`nERROR: No valid ISO found (need > 1.5 GB)" -ForegroundColor Red
    Write-Host "Please wait for download to complete or download manually." -ForegroundColor Yellow
    exit
}

$isoPath = $correctISO.FullName

Write-Host "`nUsing ISO: $($correctISO.Name)" -ForegroundColor Green
Write-Host "Size: $([math]::Round($correctISO.Length / 1GB, 2)) GB" -ForegroundColor White
Write-Host "Path: $isoPath" -ForegroundColor Gray

# Stop VM
Write-Host "`nStopping VM..." -ForegroundColor Cyan
Stop-VM -Name $VMName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "VM stopped" -ForegroundColor Green

# Update ISO
Write-Host "`nUpdating ISO in VM..." -ForegroundColor Cyan
$dvd = Get-VMDvdDrive -VMName $VMName

Set-VMDvdDrive -VMName $VMName `
    -ControllerNumber $dvd.ControllerNumber `
    -ControllerLocation $dvd.ControllerLocation `
    -Path $null

Set-VMDvdDrive -VMName $VMName `
    -ControllerNumber $dvd.ControllerNumber `
    -ControllerLocation $dvd.ControllerLocation `
    -Path $isoPath

Write-Host "ISO updated" -ForegroundColor Green

# Set boot order - DVD first
Write-Host "`nSetting boot order (DVD first)..." -ForegroundColor Cyan
$dvdBoot = Get-VMDvdDrive -VMName $VMName
Set-VMFirmware -VMName $VMName -FirstBootDevice $dvdBoot
Write-Host "Boot order configured" -ForegroundColor Green

# Start VM
Write-Host "`nStarting VM..." -ForegroundColor Cyan
Start-VM -Name $VMName
Start-Sleep -Seconds 3
Write-Host "VM started" -ForegroundColor Green

# Open console
Write-Host "`nOpening VM console..." -ForegroundColor Cyan
Start-Process "vmconnect.exe" -ArgumentList "localhost","$VMName"

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " DONE! VM STARTED WITH UBUNTU ISO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

Write-Host "`nIn VM console:" -ForegroundColor Yellow
Write-Host "  1. Select 'Try or Install Ubuntu Server'" -ForegroundColor White
Write-Host "  2. Follow installer" -ForegroundColor White
Write-Host "  3. Username: vss, Password: vss123" -ForegroundColor White
Write-Host "  4. CHECK: Install OpenSSH server" -ForegroundColor White
Write-Host "  5. CHECK: docker" -ForegroundColor White
Write-Host ""
Write-Host "After install (~15 min):" -ForegroundColor Yellow
Write-Host "  - Login: vss / vss123" -ForegroundColor White
Write-Host "  - Get IP: ip addr show" -ForegroundColor White
Write-Host "  - See: AFTER-VM-INSTALL.md" -ForegroundColor White
Write-Host ""

