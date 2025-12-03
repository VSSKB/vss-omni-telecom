# Script to start VSS Omni Telecom Docker stack
Write-Host "=== VSS Omni Telecom Stack Startup ===" -ForegroundColor Cyan

# Check Docker availability
Write-Host "`n[Check] Verifying Docker..." -ForegroundColor Yellow
$dockerCheck = docker version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not available. Run fix-docker.ps1 first" -ForegroundColor Red
    exit 1
}
Write-Host "Docker is available" -ForegroundColor Green

# Stop all containers
Write-Host "`n[1/4] Stopping all containers..." -ForegroundColor Yellow
$containers = docker ps -aq
if ($containers) {
    docker stop $containers
    Write-Host "Containers stopped" -ForegroundColor Green
} else {
    Write-Host "No running containers" -ForegroundColor Green
}

# Remove all containers
Write-Host "`n[2/4] Removing all containers..." -ForegroundColor Yellow
$containers = docker ps -aq
if ($containers) {
    docker rm -f $containers
    Write-Host "Containers removed" -ForegroundColor Green
} else {
    Write-Host "No containers to remove" -ForegroundColor Green
}

# Clean up unused resources
Write-Host "`n[3/4] Cleaning unused resources..." -ForegroundColor Yellow
docker system prune -f
Write-Host "Resources cleaned" -ForegroundColor Green

# Start the stack
Write-Host "`n[4/4] Starting Docker Compose stack..." -ForegroundColor Yellow
if (Test-Path "docker-compose.yml") {
    Write-Host "Using file: docker-compose.yml" -ForegroundColor Cyan
    docker-compose up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n=== Stack started successfully! ===" -ForegroundColor Green
        Write-Host "`nRunning containers:" -ForegroundColor Cyan
        docker-compose ps
        
        Write-Host "`nTo view logs use:" -ForegroundColor Cyan
        Write-Host "  docker-compose logs -f" -ForegroundColor White
        Write-Host "`nTo stop the stack use:" -ForegroundColor Cyan
        Write-Host "  docker-compose down" -ForegroundColor White
    } else {
        Write-Host "`nERROR: Failed to start the stack" -ForegroundColor Red
        Write-Host "Check docker-compose.yml for errors" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "ERROR: docker-compose.yml not found in current directory" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    
    # Show available docker-compose files
    Write-Host "`nAvailable docker-compose files:" -ForegroundColor Cyan
    Get-ChildItem -Filter "docker-compose*.yml" | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
    exit 1
}
