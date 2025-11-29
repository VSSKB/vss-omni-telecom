# Check direct service connections
Write-Host "Checking direct service connections..." -ForegroundColor Cyan
Write-Host ""

$services = @(
    @{Name="Workspace"; Port=3000},
    @{Name="OTTB"; Port=8083},
    @{Name="DCI"; Port=8082},
    @{Name="POINT"; Port=8081},
    @{Name="Guacamole"; Port=8080},
    @{Name="RabbitMQ Management"; Port=15672},
    @{Name="Grafana"; Port=3001},
    @{Name="Prometheus"; Port=9090}
)

foreach ($svc in $services) {
    Write-Host "Testing: $($svc.Name) on port $($svc.Port)" -ForegroundColor White
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($svc.Port)" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        Write-Host "  Status: $($response.StatusCode) OK" -ForegroundColor Green
        Write-Host "  Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
        Write-Host "  Content Length: $($response.Content.Length) bytes" -ForegroundColor Gray
    } catch {
        $statusCode = "N/A"
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        Write-Host "  Status: $statusCode" -ForegroundColor Yellow
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# Get host IP for Docker
Write-Host "Getting host IP for Docker..." -ForegroundColor Cyan
$hostIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "172.*" -or $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } | Select-Object -First 1).IPAddress
if (-not $hostIP) {
    $hostIP = "host.docker.internal"
}
Write-Host "Host IP: $hostIP" -ForegroundColor Yellow
Write-Host ""

