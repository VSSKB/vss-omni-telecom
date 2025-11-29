# Test service paths
Write-Host "Testing service paths..." -ForegroundColor Cyan
Write-Host ""

$tests = @(
    @{Name="Workspace /health"; Url="http://localhost:3000/health"},
    @{Name="Workspace /api"; Url="http://localhost:3000/api"},
    @{Name="OTTB /health"; Url="http://localhost:8083/health"},
    @{Name="DCI /health"; Url="http://localhost:8082/health"},
    @{Name="POINT /health"; Url="http://localhost:8081/health"},
    @{Name="Guacamole /guacamole"; Url="http://localhost:8080/guacamole"},
    @{Name="RabbitMQ /"; Url="http://localhost:15672/"}
)

foreach ($test in $tests) {
    Write-Host "Testing: $($test.Name)" -ForegroundColor White
    Write-Host "  URL: $($test.Url)" -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri $test.Url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host "  Status: $($response.StatusCode) OK" -ForegroundColor Green
        if ($response.Content.Length -gt 0) {
            $preview = $response.Content.Substring(0, [Math]::Min(200, $response.Content.Length))
            Write-Host "  Preview: $preview..." -ForegroundColor Gray
        }
    } catch {
        $statusCode = "N/A"
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        Write-Host "  Status: $statusCode" -ForegroundColor Yellow
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

