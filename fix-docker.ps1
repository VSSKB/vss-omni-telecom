# Script to fix Docker Desktop hanging issues
Write-Host "=== Docker Desktop Fix Script ===" -ForegroundColor Cyan

# Step 1: Stop all Docker processes
Write-Host "`n[1/5] Stopping Docker processes..." -ForegroundColor Yellow
$dockerProcesses = @("Docker Desktop", "dockerd", "com.docker.backend", "com.docker.service", "com.docker.proxy", "vpnkit")
foreach ($proc in $dockerProcesses) {
    Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Write-Host "Processes stopped" -ForegroundColor Green

# Step 2: Stop Docker service
Write-Host "`n[2/5] Stopping Docker service..." -ForegroundColor Yellow
Stop-Service -Name "com.docker.service" -Force -ErrorAction SilentlyContinue
Write-Host "Service stopped" -ForegroundColor Green

# Step 3: Wait
Write-Host "`n[3/5] Waiting 5 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "Done" -ForegroundColor Green

# Step 4: Start Docker service
Write-Host "`n[4/5] Starting Docker service..." -ForegroundColor Yellow
Start-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
Write-Host "Service started" -ForegroundColor Green

# Step 5: Start Docker Desktop
Write-Host "`n[5/5] Starting Docker Desktop..." -ForegroundColor Yellow
$dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerPath) {
    Start-Process -FilePath $dockerPath
    Write-Host "Docker Desktop started" -ForegroundColor Green
} else {
    Write-Host "ERROR: Docker Desktop not found at: $dockerPath" -ForegroundColor Red
    exit 1
}

# Wait for initialization
Write-Host "`n=== Waiting for Docker initialization (up to 60 seconds) ===" -ForegroundColor Cyan
$maxWait = 60
$waited = 0
$ready = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 5
    $waited += 5
    
    Write-Host "Checking Docker... ($waited/$maxWait sec)" -ForegroundColor Yellow
    
    # Check Docker availability
    $result = docker version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
}

if ($ready) {
    Write-Host "`n=== Docker is ready! ===" -ForegroundColor Green
    Write-Host "`nDocker information:" -ForegroundColor Cyan
    docker version
} else {
    Write-Host "`n=== WARNING: Docker is still initializing ===" -ForegroundColor Yellow
    Write-Host "Wait another 30-60 seconds and try Docker commands" -ForegroundColor Yellow
    Write-Host "If problem persists, try rebooting the computer" -ForegroundColor Yellow
}
