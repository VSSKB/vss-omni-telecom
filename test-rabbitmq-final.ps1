# Final RabbitMQ test
Write-Host "Testing RabbitMQ Management UI..." -ForegroundColor Cyan
Write-Host ""

# Test direct connection
Write-Host "1. Testing direct connection (localhost:15672)..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "http://localhost:15672" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "   Status: $($response.StatusCode) OK" -ForegroundColor Green
    Write-Host "   Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
    Write-Host "   Content Length: $($response.Content.Length) bytes" -ForegroundColor Gray
    
    if ($response.Content -match "RabbitMQ|Management") {
        Write-Host "   ✓ RabbitMQ Management UI is working!" -ForegroundColor Green
    }
} catch {
    $statusCode = "N/A"
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    Write-Host "   Status: $statusCode" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test through nginx-proxy-manager
Write-Host "2. Testing through nginx-proxy-manager (rabbitmq.localhost:8084)..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "http://rabbitmq.localhost:8084" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "   Status: $($response.StatusCode) OK" -ForegroundColor Green
    Write-Host "   ✓ Working through nginx-proxy-manager!" -ForegroundColor Green
} catch {
    $statusCode = "N/A"
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    
    if ($statusCode -eq 404) {
        Write-Host "   Status: 404 - Domain not found (need hosts file entry)" -ForegroundColor Yellow
    } elseif ($statusCode -eq 502) {
        Write-Host "   Status: 502 - Backend connection failed" -ForegroundColor Yellow
        Write-Host "   Note: Check if host.docker.internal works in nginx-proxy-manager" -ForegroundColor Yellow
    } else {
        Write-Host "   Status: $statusCode" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "RabbitMQ credentials:" -ForegroundColor Cyan
Write-Host "  Username: vss-admin" -ForegroundColor White
Write-Host "  Password: vss_rabbit_pass (or from RABBITMQ_PASSWORD env var)" -ForegroundColor White
Write-Host ""

