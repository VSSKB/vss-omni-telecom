# Script to verify new RabbitMQ configuration
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RabbitMQ Configuration Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$containerName = "vss-rabbitmq"

# Check container status
Write-Host "1. Container Status:" -ForegroundColor Yellow
$status = docker ps --filter "name=$containerName" --format "{{.Status}}"
if ($status -match "healthy") {
    Write-Host "   OK: Container is running and healthy" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Container is not healthy: $status" -ForegroundColor Red
    exit 1
}

# Check vhost
Write-Host "`n2. Vhost Check:" -ForegroundColor Yellow
$vhosts = docker exec $containerName rabbitmqctl list_vhosts 2>&1 | Select-String -Pattern "vss"
if ($vhosts -match "vss") {
    Write-Host "   OK: Vhost 'vss' exists" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Vhost 'vss' not found" -ForegroundColor Red
}

# Check exchanges
Write-Host "`n3. Exchanges Check:" -ForegroundColor Yellow
$exchanges = docker exec $containerName rabbitmqctl list_exchanges -p vss name 2>&1
$requiredExchanges = @("vss.events", "vss.commands", "vss.rpc")
foreach ($ex in $requiredExchanges) {
    if ($exchanges -match $ex) {
        Write-Host "   OK: $ex" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: $ex not found" -ForegroundColor Red
    }
}

# Check queues
Write-Host "`n4. Queues Check:" -ForegroundColor Yellow
$queues = docker exec $containerName rabbitmqctl list_queues -p vss name 2>&1
$requiredQueues = @(
    "vss.call.events",
    "vss.slot.events",
    "vss.slot.commands",
    "vss.autodial.leads",
    "vss.gacs.commands",
    "vss.pipeline.events",
    "vss.system.alerts",
    "vss.guacamole.sessions",
    "vss.archonts.deployments",
    "vss.telemetry.metrics"
)
$foundQueues = 0
foreach ($q in $requiredQueues) {
    if ($queues -match $q) {
        Write-Host "   OK: $q" -ForegroundColor Green
        $foundQueues++
    } else {
        Write-Host "   ERROR: $q not found" -ForegroundColor Red
    }
}
Write-Host "`n   Total queues: $foundQueues of $($requiredQueues.Count)" -ForegroundColor Cyan

# Check policies
Write-Host "`n5. Policies Check:" -ForegroundColor Yellow
$policies = docker exec $containerName rabbitmqctl list_policies -p vss 2>&1
if ($policies -match "vss-message-ttl") {
    Write-Host "   OK: Policy 'vss-message-ttl' is applied" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Policy 'vss-message-ttl' not found" -ForegroundColor Red
}
if ($policies -match "vss-ha-policy") {
    Write-Host "   OK: Policy 'vss-ha-policy' is applied" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Policy 'vss-ha-policy' not found" -ForegroundColor Red
}

# Check permissions
Write-Host "`n6. Permissions Check:" -ForegroundColor Yellow
$permissions = docker exec $containerName rabbitmqctl list_permissions -p vss 2>&1
if ($permissions -match "vss-admin") {
    Write-Host "   OK: User 'vss-admin' has permissions on vhost 'vss'" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Permissions for 'vss-admin' are not configured correctly" -ForegroundColor Red
}

# Check service connections
Write-Host "`n7. Service Connections Check:" -ForegroundColor Yellow
$services = @("vss-workspace", "vss-dci", "vss-ottb", "vss-point")
foreach ($service in $services) {
    $logs = docker logs $service --tail 10 2>&1 | Select-String -Pattern "RabbitMQ|Connected|error" | Select-Object -Last 1
    if ($logs -match "Connected|RabbitMQ.*success") {
        Write-Host "   OK: $service connected to RabbitMQ" -ForegroundColor Green
    } elseif ($logs -match "error|Error|vhost.*not found") {
        Write-Host "   ERROR: $service has connection problems" -ForegroundColor Red
        Write-Host "     Last error: $logs" -ForegroundColor Gray
    } else {
        Write-Host "   UNKNOWN: $service - status undetermined" -ForegroundColor Yellow
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Verification Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
