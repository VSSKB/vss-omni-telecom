# Add subdomain entries to hosts file
# Requires administrator privileges

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entries = @(
    "127.0.0.1 workspace.localhost",
    "127.0.0.1 ottb.localhost",
    "127.0.0.1 dci.localhost",
    "127.0.0.1 point.localhost",
    "127.0.0.1 guacamole.localhost",
    "127.0.0.1 rabbitmq.localhost",
    "127.0.0.1 grafana.localhost",
    "127.0.0.1 prometheus.localhost"
)

Write-Host "Adding entries to hosts file..." -ForegroundColor Cyan
Write-Host "File: $hostsPath" -ForegroundColor Gray
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Warning: This script requires administrator privileges." -ForegroundColor Yellow
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or manually add these entries to $hostsPath:" -ForegroundColor Yellow
    foreach ($entry in $entries) {
        Write-Host "  $entry" -ForegroundColor Gray
    }
    exit 1
}

# Read existing hosts file
$existingContent = Get-Content $hostsPath -ErrorAction Stop
$newEntries = @()

# Check which entries already exist
foreach ($entry in $entries) {
    $domain = ($entry -split '\s+')[1]
    $exists = $existingContent | Where-Object { $_ -match $domain }
    
    if ($exists) {
        Write-Host "Entry exists: $entry" -ForegroundColor Yellow
    } else {
        Write-Host "Adding: $entry" -ForegroundColor Green
        $newEntries += $entry
    }
}

# Add new entries
if ($newEntries.Count -gt 0) {
    Add-Content -Path $hostsPath -Value "" -ErrorAction Stop
    Add-Content -Path $hostsPath -Value "# VSS nginx-proxy-manager routes" -ErrorAction Stop
    foreach ($entry in $newEntries) {
        Add-Content -Path $hostsPath -Value $entry -ErrorAction Stop
    }
    Write-Host ""
    Write-Host "Entries added successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "All entries already exist." -ForegroundColor Green
}

Write-Host ""
Write-Host "You can now access services via subdomains:" -ForegroundColor Cyan
Write-Host "  http://workspace.localhost:8084" -ForegroundColor White
Write-Host "  http://ottb.localhost:8084" -ForegroundColor White
Write-Host "  http://dci.localhost:8084" -ForegroundColor White
Write-Host "  http://point.localhost:8084" -ForegroundColor White
Write-Host "  http://guacamole.localhost:8084" -ForegroundColor White
Write-Host ""

