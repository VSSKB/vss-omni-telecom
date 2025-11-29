# PowerShell script to add all VSS routes to nginx-proxy-manager
# Usage: .\add-routes-to-nginx-proxy-manager.ps1

param(
    [string]$NpmAdminUrl = "http://localhost:8181",
    [string]$AdminEmail = "deepkb03@gmail.com",
    [string]$AdminPassword = "PoiuuioP1!",
    [string]$BaseDomain = "localhost"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Adding VSS routes to nginx-proxy-manager" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ignore SSL certificate errors for self-signed certs
if (-not ([System.Management.Automation.PSTypeName]'TrustAllCertsPolicy').Type) {
    Add-Type @"
        using System.Net;
        using System.Security.Cryptography.X509Certificates;
        public class TrustAllCertsPolicy : ICertificatePolicy {
            public bool CheckValidationResult(
                ServicePoint srvPoint, X509Certificate certificate,
                WebRequest request, int certificateProblem) {
                return true;
            }
        }
"@
    [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
}

# Function to get auth token
function Get-AuthToken {
    param([string]$Url, [string]$Email, [string]$Password)
    
    # Try different API endpoints
    $endpoints = @(
        "$Url/api/tokens",
        "$Url/api/tokens/login",
        "$Url/api/login"
    )
    
    foreach ($loginUrl in $endpoints) {
        try {
            # Try with identity/secret format
            $body1 = @{
                identity = $Email
                secret = $Password
            } | ConvertTo-Json
            
            $response = Invoke-RestMethod -Uri $loginUrl -Method Post -Body $body1 -ContentType "application/json" -ErrorAction Stop
            if ($response.token) {
                return $response.token
            }
        } catch {
            # Try with email/password format
            try {
                $body2 = @{
                    email = $Email
                    password = $Password
                } | ConvertTo-Json
                
                $response = Invoke-RestMethod -Uri $loginUrl -Method Post -Body $body2 -ContentType "application/json" -ErrorAction Stop
                if ($response.token) {
                    return $response.token
                } elseif ($response.access_token) {
                    return $response.access_token
                }
            } catch {
                continue
            }
        }
    }
    
    Write-Host "Error: Failed to authenticate. Please check credentials and API endpoint." -ForegroundColor Red
    Write-Host "Tried endpoints: $($endpoints -join ', ')" -ForegroundColor Yellow
    return $null
}

# Function to add proxy host
function Add-ProxyHost {
    param(
        [string]$Token,
        [string]$BaseUrl,
        [string]$DomainName,
        [int]$ForwardPort,
        [string]$ForwardHost = "localhost",
        [bool]$ForwardScheme = $false,
        [bool]$WebsocketSupport = $false,
        [string]$CustomLocation = ""
    )
    
    $apiUrl = "$BaseUrl/api/nginx/proxy-hosts"
    
    $forwardSchemeValue = if ($ForwardScheme) { "https" } else { "http" }
    
    $body = @{
        domain_names = @($DomainName)
        forward_scheme = $forwardSchemeValue
        forward_host = $ForwardHost
        forward_port = $ForwardPort
        allow_websocket_upgrade = $WebsocketSupport
        access_list_id = 0
        certificate_id = 0
        ssl_forced = $false
        http2_support = $false
        hsts_enabled = $false
        hsts_subdomains = $false
        block_exploits = $false
        caching_enabled = $false
    } | ConvertTo-Json -Depth 10
    
    $headers = @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $body -Headers $headers -ErrorAction Stop
        $forwardInfo = "$ForwardHost" + ":" + "$ForwardPort"
        Write-Host "Added: $DomainName -> $forwardInfo" -ForegroundColor Green
        return $response
    } catch {
        $errorMessage = $_.Exception.Message
        if ($errorMessage -match "already exists") {
            Write-Host "Skipped: $DomainName (already exists)" -ForegroundColor Yellow
        } else {
            Write-Host "Failed: $DomainName - $errorMessage" -ForegroundColor Red
        }
        return $null
    }
}

# Get authentication token
Write-Host "Authenticating to nginx-proxy-manager..." -ForegroundColor Cyan
$token = Get-AuthToken -Url $NpmAdminUrl -Email $AdminEmail -Password $AdminPassword

if (-not $token) {
    Write-Host "Failed to authenticate. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "Authentication successful!" -ForegroundColor Green
Write-Host ""

# Define all routes
$routes = @(
    @{
        Domain = "$BaseDomain"
        Port = 80
        ForwardHost = "vss-nginx"
        Description = "VSS Frontend (Main Dashboard)"
        Websocket = $false
    },
    @{
        Domain = "workspace.$BaseDomain"
        Port = 3000
        ForwardHost = "vss-workspace"
        Description = "VSS Workspace API"
        Websocket = $true
    },
    @{
        Domain = "ottb.$BaseDomain"
        Port = 8083
        ForwardHost = "vss-ottb"
        Description = "VSS OTTB API"
        Websocket = $false
    },
    @{
        Domain = "dci.$BaseDomain"
        Port = 8082
        ForwardHost = "vss-dci"
        Description = "VSS DCI API"
        Websocket = $false
    },
    @{
        Domain = "point.$BaseDomain"
        Port = 8081
        ForwardHost = "vss-point"
        Description = "VSS POINT API"
        Websocket = $false
    },
    @{
        Domain = "guacamole.$BaseDomain"
        Port = 8080
        ForwardHost = "vss-guacamole"
        Description = "Guacamole Remote Desktop"
        Websocket = $true
    },
    @{
        Domain = "rabbitmq.$BaseDomain"
        Port = 15672
        ForwardHost = "vss-rabbitmq"
        Description = "RabbitMQ Management"
        Websocket = $false
    },
    @{
        Domain = "grafana.$BaseDomain"
        Port = 3000
        ForwardHost = "vss-grafana"
        Description = "Grafana Dashboard"
        Websocket = $false
    },
    @{
        Domain = "prometheus.$BaseDomain"
        Port = 9090
        ForwardHost = "vss-prometheus"
        Description = "Prometheus Metrics"
        Websocket = $false
    }
)

Write-Host "Adding proxy hosts..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$skipCount = 0
$failCount = 0

foreach ($route in $routes) {
    Write-Host "Adding: $($route.Description) ($($route.Domain))" -ForegroundColor White
    
    $forwardHost = if ($route.ForwardHost) { $route.ForwardHost } else { "localhost" }
    
    $result = Add-ProxyHost `
        -Token $token `
        -BaseUrl $NpmAdminUrl `
        -DomainName $route.Domain `
        -ForwardPort $route.Port `
        -ForwardHost $forwardHost `
        -ForwardScheme $false `
        -WebsocketSupport $route.Websocket
    
    if ($result -ne $null) {
        $successCount++
    } elseif ($result -eq $null) {
        # Check if it was skipped (already exists) or failed
        $skipCount++
    } else {
        $failCount++
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successfully added: $successCount" -ForegroundColor Green
Write-Host "Skipped (already exists): $skipCount" -ForegroundColor Yellow
Write-Host "Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Access nginx-proxy-manager admin at: $NpmAdminUrl" -ForegroundColor Cyan
Write-Host ""

