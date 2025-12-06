# VSS Docker Image Fix Script
# Fixes corrupted Docker images and rebuilds services

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VSS Docker Image Fix Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "[1/7] Checking Docker status..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "  ✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Stop all running containers
Write-Host "[2/7] Stopping all running containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.vss-demiurge-simple.yml down 2>&1 | Out-Null
Write-Host "  ✓ Containers stopped" -ForegroundColor Green

# Remove problematic VSS images
Write-Host "[3/7] Removing corrupted VSS images..." -ForegroundColor Yellow
$vssImages = @(
    "vss-omni-telecom-vss-point",
    "vss-omni-telecom-vss-docs",
    "vss-omni-telecom-vss-ottb",
    "vss-omni-telecom-vss-dci",
    "vss-omni-telecom-vss-workspace",
    "vss-point",
    "vss-docs",
    "vss-ottb",
    "vss-dci",
    "vss-workspace"
)

foreach ($image in $vssImages) {
    Write-Host "  Removing $image..." -ForegroundColor Gray
    docker rmi -f $image 2>&1 | Out-Null
    docker rmi -f "$image:latest" 2>&1 | Out-Null
}
Write-Host "  ✓ Images removed" -ForegroundColor Green

# Prune dangling images
Write-Host "[4/7] Cleaning up dangling images..." -ForegroundColor Yellow
docker image prune -f | Out-Null
Write-Host "  ✓ Cleanup complete" -ForegroundColor Green

# Prune build cache (optional, but helps with corrupted builds)
Write-Host "[5/7] Cleaning build cache..." -ForegroundColor Yellow
docker builder prune -f | Out-Null
Write-Host "  ✓ Build cache cleaned" -ForegroundColor Green

# Verify Docker is still responsive
Write-Host "[6/7] Verifying Docker is responsive..." -ForegroundColor Yellow
try {
    docker version | Out-Null
    Write-Host "  ✓ Docker is responsive" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker is not responding. Please restart Docker Desktop." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "  1. Right-click Docker Desktop icon" -ForegroundColor White
    Write-Host "  2. Select 'Restart'" -ForegroundColor White
    Write-Host "  3. Wait for Docker to fully start" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
    exit 1
}

# Rebuild images
Write-Host "[7/7] Rebuilding VSS images..." -ForegroundColor Yellow
Write-Host ""
Write-Host "This may take several minutes..." -ForegroundColor Cyan
Write-Host ""

$buildResult = docker-compose -f docker-compose.vss-demiurge-simple.yml build --no-cache 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Images rebuilt successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now start the services with:" -ForegroundColor Cyan
    Write-Host "  docker-compose -f docker-compose.vss-demiurge-simple.yml up -d" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "✗ Build failed. Error output:" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host $buildResult -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If the error persists, try:" -ForegroundColor Yellow
    Write-Host "  1. Restart Docker Desktop" -ForegroundColor White
    Write-Host "  2. Ensure Docker Desktop is using Linux containers" -ForegroundColor White
    Write-Host "  3. Check Docker Desktop logs" -ForegroundColor White
    exit 1
}

