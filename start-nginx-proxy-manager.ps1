# PowerShell script to start nginx-proxy-manager container
# Usage: .\start-nginx-proxy-manager.ps1

Write-Host "Starting nginx-proxy-manager container..." -ForegroundColor Green

# Check if Docker is running
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Docker is not running or not accessible." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: Docker command not found. Please ensure Docker is installed and running." -ForegroundColor Red
    exit 1
}

# Check if container already exists
$existingContainer = docker ps -a --filter "name=nginx-proxy-manager" --format "{{.Names}}"
if ($existingContainer -eq "nginx-proxy-manager") {
    Write-Host "Container 'nginx-proxy-manager' already exists." -ForegroundColor Yellow
    $running = docker ps --filter "name=nginx-proxy-manager" --format "{{.Names}}"
    if ($running -eq "nginx-proxy-manager") {
        Write-Host "Container is already running." -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "Starting existing container..." -ForegroundColor Yellow
        docker start nginx-proxy-manager
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Container started successfully!" -ForegroundColor Green
        } else {
            Write-Host "Failed to start container." -ForegroundColor Red
            exit 1
        }
        exit 0
    }
}

# Function to find a free port starting from a given port
function Find-FreePort {
    param([int]$startPort, [int]$maxAttempts = 20)
    
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        $testPort = $startPort + $i
        $portInUse = netstat -ano | findstr ":$testPort" | findstr "LISTENING"
        if (-not $portInUse) {
            return $testPort
        }
    }
    return $null
}

# Check port availability and find free ports
$httpPort = 8080
$httpsPort = 4443
$adminPort = 8181

# Get all listening ports
$allListeningPorts = netstat -ano | findstr "LISTENING"

# Check and find free HTTP port
$port8080 = $allListeningPorts | findstr ":8080"
if ($port8080) {
    Write-Host "Port 8080 is already in use. Searching for free HTTP port..." -ForegroundColor Yellow
    $freeHttpPort = Find-FreePort -startPort 8080
    if ($freeHttpPort) {
        $httpPort = $freeHttpPort
        Write-Host "Using port $httpPort for HTTP." -ForegroundColor Green
    } else {
        Write-Host "Error: Could not find a free HTTP port." -ForegroundColor Red
        exit 1
    }
}

# Check and find free HTTPS port
$port4443 = $allListeningPorts | findstr ":4443"
if ($port4443) {
    Write-Host "Port 4443 is already in use. Searching for free HTTPS port..." -ForegroundColor Yellow
    $freeHttpsPort = Find-FreePort -startPort 4443
    if ($freeHttpsPort) {
        $httpsPort = $freeHttpsPort
        Write-Host "Using port $httpsPort for HTTPS." -ForegroundColor Green
    } else {
        Write-Host "Error: Could not find a free HTTPS port." -ForegroundColor Red
        exit 1
    }
}

# Check and find free Admin UI port
$port8181 = $allListeningPorts | findstr ":8181"
if ($port8181) {
    Write-Host "Port 8181 is already in use. Searching for free Admin UI port..." -ForegroundColor Yellow
    $freeAdminPort = Find-FreePort -startPort 8181
    if ($freeAdminPort) {
        $adminPort = $freeAdminPort
        Write-Host "Using port $adminPort for Admin UI." -ForegroundColor Green
    } else {
        Write-Host "Error: Could not find a free Admin UI port." -ForegroundColor Red
        exit 1
    }
}

# Run the container
Write-Host "Creating and starting nginx-proxy-manager container..." -ForegroundColor Cyan
Write-Host "Using ports: Admin UI=$adminPort, HTTP=$httpPort, HTTPS=$httpsPort" -ForegroundColor Cyan

docker run -d `
    --name=nginx-proxy-manager `
    -p ${adminPort}:8181 `
    -p ${httpPort}:8080 `
    -p ${httpsPort}:4443 `
    -v /docker/appdata/nginx-proxy-manager:/config:rw `
    jlesage/nginx-proxy-manager

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "nginx-proxy-manager started successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access the admin UI at: http://localhost:$adminPort" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Default credentials:" -ForegroundColor Yellow
    Write-Host "  Email:    admin@example.com" -ForegroundColor Yellow
    Write-Host "  Password: changeme" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ports:" -ForegroundColor Cyan
    Write-Host "  $adminPort - Admin UI" -ForegroundColor White
    Write-Host "  $httpPort - HTTP" -ForegroundColor White
    Write-Host "  $httpsPort - HTTPS" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Failed to start container. Check Docker logs for details." -ForegroundColor Red
    exit 1
}

