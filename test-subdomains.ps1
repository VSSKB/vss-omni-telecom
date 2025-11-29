# Test subdomains through nginx-proxy-manager
Write-Host "Testing subdomains..." -ForegroundColor Cyan
Write-Host ""

$subdomains = @(
    @{Name="Workspace"; Domain="workspace.localhost"},
    @{Name="OTTB"; Domain="ottb.localhost"},
    @{Name="DCI"; Domain="dci.localhost"},
    @{Name="POINT"; Domain="point.localhost"},
    @{Name="Guacamole"; Domain="guacamole.localhost"}
)

foreach ($sub in $subdomains) {
    $url = "http://$($sub.Domain):8084"
    Write-Host "Testing: $($sub.Name) ($($sub.Domain))" -ForegroundColor White
    Write-Host "  URL: $url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host "  Status: $($response.StatusCode) OK" -ForegroundColor Green
        Write-Host "  Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
        if ($response.Content.Length -gt 0) {
            Write-Host "  Content Length: $($response.Content.Length) bytes" -ForegroundColor Gray
        }
    } catch {
        $statusCode = "N/A"
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        Write-Host "  Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 502) { "Yellow" } else { "Red" })
        
        if ($statusCode -eq 502) {
            Write-Host "  Note: Backend connection failed - host.docker.internal may not work" -ForegroundColor Yellow
        } elseif ($statusCode -eq 404) {
            Write-Host "  Note: Domain not found - may need hosts file entry" -ForegroundColor Yellow
        }
        
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "Note: To use subdomains, add entries to C:\Windows\System32\drivers\etc\hosts:" -ForegroundColor Yellow
Write-Host "127.0.0.1 workspace.localhost" -ForegroundColor Gray
Write-Host "127.0.0.1 ottb.localhost" -ForegroundColor Gray
Write-Host "127.0.0.1 dci.localhost" -ForegroundColor Gray
Write-Host "127.0.0.1 point.localhost" -ForegroundColor Gray
Write-Host "127.0.0.1 guacamole.localhost" -ForegroundColor Gray
Write-Host ""

