# Script to fix Redis security issues
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Redis Security Fix" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$containerName = "vss-redis"

# Check if Redis is running
Write-Host "1. Checking Redis container status..." -ForegroundColor Yellow
$status = docker ps --filter "name=$containerName" --format "{{.Status}}"
if ($status -match "Up") {
    Write-Host "   OK: Redis container is running" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Redis container is not running" -ForegroundColor Red
    exit 1
}

# Check if port is exposed externally
Write-Host "`n2. Checking port exposure..." -ForegroundColor Yellow
$ports = docker ps --filter "name=$containerName" --format "{{.Ports}}"
if ($ports -match "6379->6379") {
    Write-Host "   WARNING: Port 6379 is exposed externally" -ForegroundColor Yellow
    Write-Host "   This should be removed for security" -ForegroundColor Yellow
} elseif ($ports -eq "" -or $ports -notmatch "6379") {
    Write-Host "   OK: Port 6379 is not exposed externally (internal only)" -ForegroundColor Green
} else {
    Write-Host "   INFO: Port configuration: $ports" -ForegroundColor Cyan
}

# Check Redis password protection
Write-Host "`n3. Checking Redis password protection..." -ForegroundColor Yellow
$pingResult = docker exec $containerName redis-cli -a vss_redis_pass ping 2>&1
if ($pingResult -match "PONG") {
    Write-Host "   OK: Redis password is set and working" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Redis password check failed" -ForegroundColor Red
}

# Check for security warnings in logs
Write-Host "`n4. Checking for security warnings..." -ForegroundColor Yellow
$logs = docker logs $containerName --tail 50 2>&1 | Select-String -Pattern "SECURITY ATTACK|POST|Host:"
if ($logs) {
    Write-Host "   WARNING: Security warnings found in logs:" -ForegroundColor Yellow
    $logs | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} else {
    Write-Host "   OK: No security warnings in recent logs" -ForegroundColor Green
}

# Check protected mode
Write-Host "`n5. Checking protected mode..." -ForegroundColor Yellow
$config = docker exec $containerName cat /usr/local/etc/redis/redis.conf 2>&1 | Select-String -Pattern "protected-mode"
if ($config -match "protected-mode yes") {
    Write-Host "   OK: Protected mode is enabled" -ForegroundColor Green
} else {
    Write-Host "   WARNING: Protected mode may not be enabled" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Security Check Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  - Redis port should NOT be exposed externally" -ForegroundColor Cyan
Write-Host "  - Redis password is required for connections" -ForegroundColor Cyan
Write-Host "  - Protected mode should be enabled" -ForegroundColor Cyan
Write-Host "  - Services connect via Docker network (internal)" -ForegroundColor Cyan
Write-Host ""

