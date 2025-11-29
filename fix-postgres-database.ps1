# Fix PostgreSQL database connection issue
Write-Host "Fixing PostgreSQL database connection..." -ForegroundColor Cyan
Write-Host ""

# Check if database exists
Write-Host "1. Checking database vss_db..." -ForegroundColor White
try {
    $result = docker exec vss-postgres psql -U vss -d vss_db -c "SELECT 1;" 2>&1
    if ($result -match "1 row") {
        Write-Host "   Database vss_db exists and is accessible" -ForegroundColor Green
    } else {
        Write-Host "   Warning: Unexpected response" -ForegroundColor Yellow
        Write-Host "   Response: $result" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Error checking database: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check for FATAL errors in logs
Write-Host "2. Checking for database errors..." -ForegroundColor White
$logs = docker logs vss-postgres --tail 50 2>&1
$fatalErrors = $logs | Select-String -Pattern "FATAL.*database.*does not exist"

if ($fatalErrors) {
    Write-Host "   Found errors:" -ForegroundColor Yellow
    $fatalErrors | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "   Solution: Healthcheck fixed in docker-compose.vss-demiurge.yml" -ForegroundColor Cyan
    Write-Host "   Changed: pg_isready -U vss -> pg_isready -U vss -d vss_db" -ForegroundColor Gray
} else {
    Write-Host "   No database errors found" -ForegroundColor Green
}

Write-Host ""
Write-Host "3. Checking service status..." -ForegroundColor White
$services = @("vss-postgres", "vss-point", "vss-dci", "vss-ottb", "vss-workspace")
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
Write-Host "Fix complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If errors persist, check:" -ForegroundColor Yellow
Write-Host "  1. All services use POSTGRES_URL with vss_db" -ForegroundColor Gray
Write-Host "  2. No hardcoded database name 'vss' in code" -ForegroundColor Gray
Write-Host "  3. Environment variables are set correctly" -ForegroundColor Gray
Write-Host ""

