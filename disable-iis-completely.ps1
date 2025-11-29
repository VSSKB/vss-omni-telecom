# Script to completely disable IIS
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Disabling IIS Completely" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Stop IIS services
Write-Host "1. Stopping IIS services..." -ForegroundColor Yellow
$services = @("W3SVC", "WAS", "IISADMIN")
foreach ($service in $services) {
    try {
        $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
        if ($svc) {
            if ($svc.Status -eq "Running") {
                Stop-Service -Name $service -Force -ErrorAction SilentlyContinue
                Write-Host "   Stopped: $service" -ForegroundColor Green
            } else {
                Write-Host "   Already stopped: $service" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "   Service not found: $service" -ForegroundColor Gray
    }
}

# Disable startup
Write-Host "`n2. Disabling IIS services startup..." -ForegroundColor Yellow
foreach ($service in $services) {
    try {
        $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
        if ($svc) {
            Set-Service -Name $service -StartupType Disabled -ErrorAction SilentlyContinue
            Write-Host "   Disabled: $service" -ForegroundColor Green
        }
    } catch {
        Write-Host "   Service not found: $service" -ForegroundColor Gray
    }
}

# Stop all websites
Write-Host "`n3. Stopping all IIS websites..." -ForegroundColor Yellow
try {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    $websites = Get-Website -ErrorAction SilentlyContinue
    foreach ($site in $websites) {
        try {
            Stop-Website -Name $site.Name -ErrorAction SilentlyContinue
            Write-Host "   Stopped website: $($site.Name)" -ForegroundColor Green
        } catch {
            Write-Host "   Could not stop: $($site.Name)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   WebAdministration module not available" -ForegroundColor Yellow
}

# Check port 80
Write-Host "`n4. Checking port 80..." -ForegroundColor Yellow
$port80 = netstat -ano | Select-String -Pattern "LISTENING.*:80 "
if ($port80) {
    Write-Host "   WARNING: Port 80 is still in use:" -ForegroundColor Red
    $port80 | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} else {
    Write-Host "   OK: Port 80 is free" -ForegroundColor Green
}

# Verify services status
Write-Host "`n5. Verifying services status..." -ForegroundColor Yellow
foreach ($service in $services) {
    try {
        $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
        if ($svc) {
            $status = $svc.Status
            $startType = $svc.StartType
            if ($status -eq "Stopped" -and $startType -eq "Disabled") {
                Write-Host "   OK: $service - Stopped, Disabled" -ForegroundColor Green
            } else {
                Write-Host "   WARNING: $service - Status: $status, StartType: $startType" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "   Service not found: $service" -ForegroundColor Gray
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "IIS Disabled!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Note: IIS services are now stopped and disabled." -ForegroundColor Yellow
Write-Host "Port 80 should be available for Nginx Proxy Manager." -ForegroundColor Yellow
Write-Host ""

