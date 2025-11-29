# Test RabbitMQ connection
Write-Host "Testing RabbitMQ Management UI..." -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 10
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:15672" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host "Status: $($response.StatusCode) OK" -ForegroundColor Green
        Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
        Write-Host "Content Length: $($response.Content.Length) bytes" -ForegroundColor Gray
        
        if ($response.Content -match "RabbitMQ|Management") {
            Write-Host "RabbitMQ Management UI is working!" -ForegroundColor Green
        }
        
        break
    } catch {
        $statusCode = "N/A"
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        
        if ($statusCode -eq 200) {
            Write-Host "Status: $statusCode OK" -ForegroundColor Green
            break
        } else {
            Write-Host "Status: $statusCode - Waiting..." -ForegroundColor Yellow
            Start-Sleep -Seconds 3
        }
    }
}

if ($attempt -eq $maxAttempts) {
    Write-Host "RabbitMQ Management UI is not responding after $maxAttempts attempts" -ForegroundColor Red
    Write-Host "Checking container status..." -ForegroundColor Yellow
    docker ps --filter "name=rabbitmq" --format "table {{.Names}}\t{{.Status}}"
}

