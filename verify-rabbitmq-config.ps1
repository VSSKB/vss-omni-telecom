# Verify RabbitMQ configuration
Write-Host "Verifying RabbitMQ configuration..." -ForegroundColor Cyan
Write-Host ""

$username = "vss-admin"
$password = "vss_rabbit_pass"
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{
    Authorization = "Basic $base64Auth"
}

$baseUrl = "http://localhost:15672/api"

# Check RabbitMQ is running
Write-Host "1. Checking RabbitMQ status..." -ForegroundColor White
try {
    $overview = Invoke-RestMethod -Uri "$baseUrl/overview" -Headers $headers -TimeoutSec 10
    Write-Host "   Status: Running" -ForegroundColor Green
    Write-Host "   Version: $($overview.rabbitmq_version)" -ForegroundColor Gray
    Write-Host "   Management Version: $($overview.management_version)" -ForegroundColor Gray
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check vhosts
Write-Host "2. Checking vhosts..." -ForegroundColor White
try {
    $vhosts = Invoke-RestMethod -Uri "$baseUrl/vhosts" -Headers $headers -TimeoutSec 10
    $vssVhost = $vhosts | Where-Object { $_.name -eq "/vss" }
    if ($vssVhost) {
        Write-Host "   VHost /vss exists" -ForegroundColor Green
    } else {
        Write-Host "   VHost /vss not found" -ForegroundColor Red
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check exchanges
Write-Host "3. Checking exchanges..." -ForegroundColor White
try {
    $exchanges = Invoke-RestMethod -Uri "$baseUrl/exchanges/%2Fvss" -Headers $headers -TimeoutSec 10
    $requiredExchanges = @("vss.events", "vss.commands", "vss.rpc")
    
    foreach ($ex in $requiredExchanges) {
        $found = $exchanges | Where-Object { $_.name -eq $ex }
        if ($found) {
            Write-Host "   Exchange: $ex (type: $($found.type))" -ForegroundColor Green
        } else {
            Write-Host "   Exchange: $ex not found" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check queues
Write-Host "4. Checking queues..." -ForegroundColor White
try {
    $queues = Invoke-RestMethod -Uri "$baseUrl/queues/%2Fvss" -Headers $headers -TimeoutSec 10
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
    
    $foundCount = 0
    foreach ($q in $requiredQueues) {
        $found = $queues | Where-Object { $_.name -eq $q }
        if ($found) {
            Write-Host "   Queue: $q (messages: $($found.messages), consumers: $($found.consumers))" -ForegroundColor Green
            $foundCount++
        } else {
            Write-Host "   Queue: $q not found" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "   Found: $foundCount/$($requiredQueues.Count) queues" -ForegroundColor $(if ($foundCount -eq $requiredQueues.Count) { "Green" } else { "Yellow" })
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check bindings
Write-Host "5. Checking bindings..." -ForegroundColor White
try {
    $bindings = Invoke-RestMethod -Uri "$baseUrl/bindings/%2Fvss" -Headers $headers -TimeoutSec 10
    $queueBindings = $bindings | Where-Object { $_.destination_type -eq "queue" }
    
    Write-Host "   Total queue bindings: $($queueBindings.Count)" -ForegroundColor Gray
    
    # Check key bindings
    $keyBindings = @(
        @{Exchange="vss.events"; Queue="vss.call.events"; Key="call.*"},
        @{Exchange="vss.events"; Queue="vss.slot.events"; Key="slot.*"},
        @{Exchange="vss.commands"; Queue="vss.slot.commands"; Key="slot.*"},
        @{Exchange="vss.commands"; Queue="vss.autodial.leads"; Key="autodial.lead"},
        @{Exchange="vss.commands"; Queue="vss.gacs.commands"; Key="gacs.execute"},
        @{Exchange="vss.events"; Queue="vss.pipeline.events"; Key="pipeline.*"},
        @{Exchange="vss.events"; Queue="vss.system.alerts"; Key="system.alert"},
        @{Exchange="vss.events"; Queue="vss.guacamole.sessions"; Key="guacamole.*"},
        @{Exchange="vss.events"; Queue="vss.archonts.deployments"; Key="archonts.*"},
        @{Exchange="vss.events"; Queue="vss.telemetry.metrics"; Key="telemetry.*"}
    )
    
    $foundBindings = 0
    foreach ($binding in $keyBindings) {
        $found = $queueBindings | Where-Object { 
            $_.source -eq $binding.Exchange -and 
            $_.destination -eq $binding.Queue -and 
            $_.routing_key -eq $binding.Key 
        }
        if ($found) {
            Write-Host "   $($binding.Exchange) -> $($binding.Queue) [$($binding.Key)]" -ForegroundColor Green
            $foundBindings++
        } else {
            Write-Host "   $($binding.Exchange) -> $($binding.Queue) [$($binding.Key)] - NOT FOUND" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "   Found: $foundBindings/$($keyBindings.Count) bindings" -ForegroundColor $(if ($foundBindings -eq $keyBindings.Count) { "Green" } else { "Yellow" })
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration verification complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

