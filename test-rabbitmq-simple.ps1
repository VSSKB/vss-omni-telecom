# Simple RabbitMQ test
Write-Host "Testing RabbitMQ Management UI..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:15672" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
    Write-Host "Content Length: $($response.Content.Length) bytes" -ForegroundColor Gray
    
    if ($response.Content -match "RabbitMQ|Management") {
        Write-Host ""
        Write-Host "RabbitMQ Management UI is working!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Access at: http://localhost:15672" -ForegroundColor Cyan
        Write-Host "Username: vss-admin" -ForegroundColor White
        Write-Host "Password: vss_rabbit_pass" -ForegroundColor White
    }
} catch {
    $statusCode = "N/A"
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Status: $statusCode" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

