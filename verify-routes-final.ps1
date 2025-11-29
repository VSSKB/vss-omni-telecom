# Final verification of routes through nginx-proxy-manager
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Final Route Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get host IP
$hostIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" 
} | Select-Object -First 1).IPAddress

if (-not $hostIP) {
    $hostIP = "host.docker.internal"
}

Write-Host "Using host IP: $hostIP" -ForegroundColor Yellow
Write-Host ""

# Test routes with localhost (no subdomain resolution needed)
$routes = @(
    @{Name="VSS Frontend"; Domain="localhost"; Port=8084; Path="/"; Expected="HTML"},
    @{Name="VSS Workspace"; Domain="localhost"; Port=8084; Path="/workspace"; Expected="API"},
    @{Name="VSS Workspace Health"; Domain="localhost"; Port=8084; Path="/workspace/health"; Expected="JSON"},
    @{Name="VSS OTTB Health"; Domain="localhost"; Port=8084; Path="/ottb/health"; Expected="JSON"},
    @{Name="VSS DCI Health"; Domain="localhost"; Port=8084; Path="/dci/health"; Expected="JSON"},
    @{Name="VSS POINT Health"; Domain="localhost"; Port=8084; Path="/point/health"; Expected="JSON"},
    @{Name="Guacamole"; Domain="localhost"; Port=8084; Path="/guacamole"; Expected="HTML"}
)

Write-Host "Testing routes through nginx-proxy-manager (port 8084)..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($route in $routes) {
    $url = "http://$($route.Domain):$($route.Port)$($route.Path)"
    Write-Host "Testing: $($route.Name)" -ForegroundColor White
    Write-Host "  URL: $url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host "  Status: $($response.StatusCode) OK" -ForegroundColor Green
        
        # Check content
        if ($response.Content -match "healthy|status") {
            Write-Host "  Content: Health check response detected" -ForegroundColor Cyan
        } elseif ($response.Content -match "html|HTML|<!DOCTYPE") {
            Write-Host "  Content: HTML page detected" -ForegroundColor Cyan
        } elseif ($response.Content -match "json|JSON|\{|\[") {
            Write-Host "  Content: JSON response detected" -ForegroundColor Cyan
        }
        
        $successCount++
    } catch {
        $statusCode = "N/A"
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        Write-Host "  Status: $statusCode" -ForegroundColor Yellow
        
        if ($statusCode -eq 404) {
            Write-Host "  Note: Route may need custom location configuration" -ForegroundColor Yellow
        } elseif ($statusCode -eq 502) {
            Write-Host "  Note: Cannot connect to backend - check host.docker.internal" -ForegroundColor Yellow
        }
        
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Note: Subdomains (workspace.localhost, etc.) require hosts file entries" -ForegroundColor Yellow
Write-Host "or use paths instead: localhost:8084/workspace, localhost:8084/ottb, etc." -ForegroundColor Yellow
Write-Host ""

