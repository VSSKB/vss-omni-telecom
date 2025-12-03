# Deploy VSS to Linux VM and start the stack

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " DEPLOY VSS TO LINUX VM" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

# Get VM IP
Write-Host "`nEnter Linux VM IP address:" -ForegroundColor Yellow
Write-Host "(Find it in VM: ip addr show)" -ForegroundColor Gray
$LinuxIP = Read-Host "VM IP"

if ([string]::IsNullOrWhiteSpace($LinuxIP)) {
    Write-Host "ERROR: IP address required!" -ForegroundColor Red
    exit
}

$LinuxUser = "vss"
$ProjectPath = "C:\Users\Administrator\Documents\vss-omni-telecom"

Write-Host "`nDeployment Info:" -ForegroundColor Cyan
Write-Host "  Linux VM IP: $LinuxIP" -ForegroundColor White
Write-Host "  Username:    $LinuxUser" -ForegroundColor White
Write-Host "  Source:      $ProjectPath" -ForegroundColor White

Write-Host "`nCopying VSS to VM..." -ForegroundColor Cyan
Write-Host "(This may take 2-5 minutes)" -ForegroundColor Yellow
Write-Host ""

# Copy files via SCP
try {
    scp -r $ProjectPath ${LinuxUser}@${LinuxIP}:~/
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nFiles copied successfully!" -ForegroundColor Green
        
        Write-Host "`n============================================================" -ForegroundColor Green
        Write-Host " NOW SSH TO VM AND START VSS" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
        
        Write-Host "`nCommands to run on VM:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  ssh ${LinuxUser}@${LinuxIP}" -ForegroundColor Cyan
        Write-Host "  cd ~/vss-omni-telecom" -ForegroundColor Cyan
        Write-Host "  docker compose -f docker-compose.vss-demiurge.yml up -d" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Would you like to SSH now? (Y/N)" -ForegroundColor Yellow
        $answer = Read-Host
        
        if ($answer -eq "Y" -or $answer -eq "y") {
            Write-Host "`nConnecting to VM..." -ForegroundColor Cyan
            ssh ${LinuxUser}@${LinuxIP}
        }
    } else {
        Write-Host "`nERROR: Copy failed!" -ForegroundColor Red
    }
} catch {
    Write-Host "`nERROR: $_" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check VM IP is correct" -ForegroundColor White
    Write-Host "  2. Check VM is running (SSH enabled)" -ForegroundColor White
    Write-Host "  3. Try: ssh ${LinuxUser}@${LinuxIP}" -ForegroundColor White
}

Write-Host ""

