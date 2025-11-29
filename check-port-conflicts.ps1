# Script to check for port conflicts across all Docker Compose files and scripts
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Port Conflict Checker" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$portMap = @{}
$conflicts = @()

# Function to extract ports from docker-compose files
function Get-PortsFromCompose {
    param([string]$filePath)
    
    $ports = @()
    $content = Get-Content $filePath -Raw
    
    # Find all port mappings
    $portPattern = '"\s*(\d+):(\d+)"'
    $matches = [regex]::Matches($content, $portPattern)
    
    foreach ($match in $matches) {
        $hostPort = [int]$match.Groups[1].Value
        $containerPort = [int]$match.Groups[2].Value
        $ports += @{
            HostPort = $hostPort
            ContainerPort = $containerPort
            File = $filePath
        }
    }
    
    return $ports
}

# Check docker-compose files
$composeFiles = @(
    "docker-compose.vss-demiurge-simple.yml",
    "docker-compose.vss-demiurge.yml",
    "docker-compose.nginx-proxy-manager.yml"
)

Write-Host "Checking Docker Compose files..." -ForegroundColor Yellow
foreach ($file in $composeFiles) {
    if (Test-Path $file) {
        Write-Host "  Checking: $file" -ForegroundColor Cyan
        $ports = Get-PortsFromCompose -filePath $file
        
        foreach ($port in $ports) {
            $portKey = $port.HostPort
            if ($portMap.ContainsKey($portKey)) {
                $conflicts += @{
                    Port = $portKey
                    File1 = $portMap[$portKey].File
                    File2 = $port.File
                    Service1 = $portMap[$portKey].Service
                    Service2 = $port.Service
                }
            } else {
                $portMap[$portKey] = @{
                    File = $port.File
                    ContainerPort = $port.ContainerPort
                    Service = "Unknown"
                }
            }
        }
    } else {
        Write-Host "  WARNING: $file not found" -ForegroundColor Yellow
    }
}

# Check running containers
Write-Host "`nChecking running containers..." -ForegroundColor Yellow
$runningContainers = docker ps --format "{{.Names}}|{{.Ports}}" 2>&1
foreach ($line in $runningContainers) {
    if ($line -match "^(.+)\|(.+)$") {
        $containerName = $matches[1]
        $ports = $matches[2]
        
        # Extract host ports from port string
        $portPattern = '(\d+\.\d+\.\d+\.\d+):(\d+)->|\[::\]:(\d+)->'
        $portMatches = [regex]::Matches($ports, $portPattern)
        
        foreach ($pm in $portMatches) {
            $hostPort = if ($pm.Groups[2].Value) { [int]$pm.Groups[2].Value } else { [int]$pm.Groups[3].Value }
            
            if ($portMap.ContainsKey($hostPort)) {
                $conflicts += @{
                    Port = $hostPort
                    File1 = $portMap[$hostPort].File
                    File2 = "Running Container"
                    Service1 = $portMap[$hostPort].Service
                    Service2 = $containerName
                }
            }
        }
    }
}

# Display results
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Port Usage Summary" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$sortedPorts = $portMap.Keys | Sort-Object
foreach ($port in $sortedPorts) {
    $info = $portMap[$port]
    Write-Host "Port $port :" -ForegroundColor White -NoNewline
    Write-Host " $($info.File) (container: $($info.ContainerPort))" -ForegroundColor Gray
}

if ($conflicts.Count -gt 0) {
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "CONFLICTS FOUND!" -ForegroundColor Red
    Write-Host "========================================`n" -ForegroundColor Red
    
    foreach ($conflict in $conflicts) {
        Write-Host "Port $($conflict.Port) conflict:" -ForegroundColor Red
        Write-Host "  - $($conflict.File1) ($($conflict.Service1))" -ForegroundColor Yellow
        Write-Host "  - $($conflict.File2) ($($conflict.Service2))" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "No conflicts found!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
}

# Display port ranges
Write-Host "Port Usage by Service:" -ForegroundColor Cyan
Write-Host "  RabbitMQ: 5672, 15672" -ForegroundColor Gray
Write-Host "  PostgreSQL: 5432" -ForegroundColor Gray
Write-Host "  Redis: 6379 (internal only)" -ForegroundColor Gray
Write-Host "  OTTB: 8083" -ForegroundColor Gray
Write-Host "  DCI: 8082" -ForegroundColor Gray
Write-Host "  POINT: 8081" -ForegroundColor Gray
Write-Host "  Workspace: 3000" -ForegroundColor Gray
Write-Host "  Guacamole: 8080" -ForegroundColor Gray
Write-Host "  Nginx: 8085 (simple), 80 (full)" -ForegroundColor Gray
Write-Host "  Nginx Proxy Manager: 8080, 4443, 8181" -ForegroundColor Gray
Write-Host ""

