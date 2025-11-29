# Verify RabbitMQ Management UI
Write-Host "Verifying RabbitMQ Management UI..." -ForegroundColor Cyan
Write-Host ""

$username = "vss-admin"
$password = "vss_rabbit_pass"
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{
    Authorization = "Basic $base64Auth"
}

# Test API endpoint
Write-Host "Testing API endpoint..." -ForegroundColor White
try {
    $response = Invoke-RestMethod -Uri "http://localhost:15672/api/overview" -Headers $headers -TimeoutSec 10 -Method Get
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "RabbitMQ Version: $($response.rabbitmq_version)" -ForegroundColor Cyan
    Write-Host "Management Version: $($response.management_version)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "RabbitMQ Management UI is working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access at: http://localhost:15672" -ForegroundColor Cyan
    Write-Host "Username: $username" -ForegroundColor White
    Write-Host "Password: $password" -ForegroundColor White
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try web interface
    Write-Host ""
    Write-Host "Trying web interface..." -ForegroundColor Yellow
    try {
        $webResponse = Invoke-WebRequest -Uri "http://localhost:15672" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        Write-Host "Web interface responds: $($webResponse.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "Web interface also failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

