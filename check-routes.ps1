# Script to check all nginx-proxy-manager routes
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking all VSS routes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$routes = @(
    @{ Name = "VSS Frontend"; Url = "http://localhost:8084"; Expected = "HTML/Dashboard" },
    @{ Name = "VSS Workspace API"; Url = "http://workspace.localhost:8084"; Expected = "API/JSON" },
    @{ Name = "VSS OTTB API"; Url = "http://ottb.localhost:8084"; Expected = "API/JSON" },
    @{ Name = "VSS DCI API"; Url = "http://dci.localhost:8084"; Expected = "API/JSON" },
    @{ Name = "VSS POINT API"; Url = "http://point.localhost:8084"; Expected = "API/JSON" },
    @{ Name = "Guacamole"; Url = "http://guacamole.localhost:8084"; Expected = "Guacamole UI" },
    @{ Name = "RabbitMQ Management"; Url = "http://rabbitmq.localhost:8084"; Expected = "RabbitMQ UI" },
    @{ Name = "Grafana"; Url = "http://grafana.localhost:8084"; Expected = "Grafana UI" },
    @{ Name = "Prometheus"; Url = "http://prometheus.localhost:8084"; Expected = "Prometheus Metrics" }
)

$successCount = 0
$failCount = 0

foreach ($route in $routes) {
    Write-Host "Checking: $($route.Name)" -ForegroundColor White
    Write-Host "  URL: $($route.Url)" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $route.Url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        
        Write-Host "  Status: $($response.StatusCode) OK" -ForegroundColor Green
        
        # Check content type
        $contentType = ""
        if ($response.Headers.ContainsKey("Content-Type")) {
            $contentType = $response.Headers["Content-Type"]
        } elseif ($response.Content.Headers.ContainsKey("Content-Type")) {
            $contentType = $response.Content.Headers["Content-Type"]
        }
        
        if ($contentType) {
            Write-Host "  Content-Type: $contentType" -ForegroundColor Gray
        }
        
        # Check content length
        $contentLength = 0
        if ($response.Content) {
            $contentLength = $response.Content.Length
        }
        Write-Host "  Content Length: $contentLength bytes" -ForegroundColor Gray
        
        # Check if content matches expected
        if ($contentLength -gt 0) {
            $contentPreview = ""
            if ($response.Content -is [string]) {
                $contentPreview = $response.Content.Substring(0, [Math]::Min(100, $response.Content.Length))
            } else {
                $contentPreview = [System.Text.Encoding]::UTF8.GetString($response.Content[0..99])
            }
            
            # Check for common indicators
            if ($contentPreview -match "html|HTML|<!DOCTYPE|<html") {
                Write-Host "  Type: HTML Page" -ForegroundColor Cyan
            } elseif ($contentPreview -match "json|JSON|\{|\[") {
                Write-Host "  Type: JSON/API" -ForegroundColor Cyan
            } elseif ($contentPreview -match "guacamole|Guacamole") {
                Write-Host "  Type: Guacamole" -ForegroundColor Cyan
            } elseif ($contentPreview -match "rabbitmq|RabbitMQ") {
                Write-Host "  Type: RabbitMQ" -ForegroundColor Cyan
            } elseif ($contentPreview -match "grafana|Grafana") {
                Write-Host "  Type: Grafana" -ForegroundColor Cyan
            } elseif ($contentPreview -match "prometheus|Prometheus|# HELP|# TYPE") {
                Write-Host "  Type: Prometheus" -ForegroundColor Cyan
            }
        }
        
        $successCount++
        Write-Host "  Result: SUCCESS" -ForegroundColor Green
        
    } catch {
        $errorMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            Write-Host "  Status: $statusCode" -ForegroundColor Yellow
            $errorMsg = "HTTP $statusCode"
        }
        Write-Host "  Error: $errorMsg" -ForegroundColor Red
        Write-Host "  Result: FAILED" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

