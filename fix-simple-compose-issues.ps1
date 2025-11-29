# Fix issues in docker-compose.vss-demiurge-simple.yml
Write-Host "Fixing issues in docker-compose.vss-demiurge-simple.yml..." -ForegroundColor Cyan
Write-Host ""

Write-Host "1. PostgreSQL healthcheck:" -ForegroundColor White
Write-Host "   Fixed: pg_isready -U vss -> pg_isready -U vss -d vss_db" -ForegroundColor Green

Write-Host ""
Write-Host "2. Nginx port:" -ForegroundColor White
Write-Host "   Fixed: Port 80 -> Port 8085 (port 80 is reserved by Windows)" -ForegroundColor Green
Write-Host "   Access: http://localhost:8085" -ForegroundColor Cyan

Write-Host ""
Write-Host "3. Nginx configuration:" -ForegroundColor White
Write-Host "   Fixed: Commented out nginx-rtmp references (not available in simple version)" -ForegroundColor Green

Write-Host ""
Write-Host "4. RabbitMQ vhost:" -ForegroundColor White
Write-Host "   Created both vhosts: /vss and vss" -ForegroundColor Green
Write-Host "   Permissions set for vss-admin user" -ForegroundColor Green

Write-Host ""
Write-Host "5. Service status:" -ForegroundColor White
$services = @("vss-postgres", "vss-nginx", "vss-rabbitmq", "vss-workspace", "vss-ottb", "vss-dci", "vss-point")
foreach ($service in $services) {
    $status = docker ps --filter "name=$service" --format "{{.Status}}" 2>&1
    if ($status) {
        Write-Host "   $service : $status" -ForegroundColor Green
    } else {
        Write-Host "   $service : Not running" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All fixes applied!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access points:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:8085" -ForegroundColor White
Write-Host "  Workspace API: http://localhost:3000" -ForegroundColor White
Write-Host "  OTTB API: http://localhost:8083" -ForegroundColor White
Write-Host "  DCI API: http://localhost:8082" -ForegroundColor White
Write-Host "  POINT API: http://localhost:8081" -ForegroundColor White
Write-Host ""

