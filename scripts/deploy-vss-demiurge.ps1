# deploy-vss-demiurge.ps1 - PowerShell скрипт развертывания VSS DEMIURGE

param(
    [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"

$COMPOSE_FILE = "docker-compose.vss-demiurge.yml"
$RABBITMQ_CONFIG_DIR = "./config/rabbitmq"
$BACKUP_DIR = "./backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"

function Write-Log {
    param([string]$Message, [string]$Color = "Green")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

function Write-Warning-Log {
    param([string]$Message)
    Write-Log -Message "[WARN] $Message" -Color "Yellow"
}

function Write-Error-Log {
    param([string]$Message)
    Write-Log -Message "[ERROR] $Message" -Color "Red"
}

function Test-Environment {
    Write-Log "Checking environment..."
    
    # Check Docker
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error-Log "Docker is not installed"
        exit 1
    }
    
    # Check Docker Compose
    $composeCmd = $null
    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        $script:COMPOSE_CMD = "docker-compose"
    } elseif (docker compose version 2>&1 | Out-Null) {
        $script:COMPOSE_CMD = "docker compose"
    } else {
        Write-Error-Log "Docker Compose is not installed"
        exit 1
    }
    
    # Check configuration files
    if (-not (Test-Path "$RABBITMQ_CONFIG_DIR/definitions.json")) {
        Write-Error-Log "RabbitMQ definitions.json not found"
        exit 1
    }
    
    if (-not (Test-Path ".env")) {
        Write-Warning-Log ".env file not found, creating from template"
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Log "Please edit .env file with your configuration"
            exit 1
        } else {
            Write-Error-Log ".env.example not found"
            exit 1
        }
    }
}

function Backup-Existing {
    if ($SkipBackup) {
        Write-Log "Skipping backup (SkipBackup flag set)"
        return
    }
    
    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
    }
    
    Write-Log "Creating backup of existing deployment..."
    try {
        Compress-Archive -Path ./data, ./config, ./.env -DestinationPath "$BACKUP_DIR/backup_$TIMESTAMP.zip" -Force
    } catch {
        Write-Warning-Log "Some files could not be backed up: $_"
    }
}

function Start-Infrastructure {
    Write-Log "Deploying VSS DEMIURGE infrastructure..."
    
    # Pull latest images
    & $COMPOSE_CMD -f $COMPOSE_FILE pull
    
    # Start core infrastructure first
    Write-Log "Starting core infrastructure..."
    & $COMPOSE_CMD -f $COMPOSE_FILE up -d rabbitmq postgresql redis
    
    # Wait for RabbitMQ
    Write-Log "Waiting for RabbitMQ to be ready..."
    $maxAttempts = 30
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            $result = & $COMPOSE_CMD -f $COMPOSE_FILE exec -T rabbitmq rabbitmq-diagnostics ping 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log "✅ RabbitMQ is ready"
                break
            }
        } catch {}
        $attempt++
        Start-Sleep -Seconds 2
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Error-Log "RabbitMQ failed to start"
        exit 1
    }
    
    # Wait for PostgreSQL
    Write-Log "Waiting for PostgreSQL to be ready..."
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            $result = & $COMPOSE_CMD -f $COMPOSE_FILE exec -T postgresql pg_isready -U vss 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log "✅ PostgreSQL is ready"
                break
            }
        } catch {}
        $attempt++
        Start-Sleep -Seconds 2
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Error-Log "PostgreSQL failed to start"
        exit 1
    }
    
    # Start core services
    Write-Log "Starting core services..."
    & $COMPOSE_CMD -f $COMPOSE_FILE up -d vss-ottb vss-dci vss-point
    
    # Start Guacamole services
    Write-Log "Starting Guacamole services..."
    & $COMPOSE_CMD -f $COMPOSE_FILE up -d guacd vss-guacamole
    
    # Start workspace
    Write-Log "Starting workspace..."
    & $COMPOSE_CMD -f $COMPOSE_FILE up -d vss-workspace
    
    # Start monitoring
    Write-Log "Starting monitoring stack..."
    & $COMPOSE_CMD -f $COMPOSE_FILE up -d prometheus grafana
    
    Write-Log "Infrastructure deployment completed"
}

function Test-Health {
    Write-Log "Performing health checks..."
    
    $services = @(
        @{Name="rabbitmq"; Port=15672},
        @{Name="postgresql"; Port=5432},
        @{Name="redis"; Port=6379},
        @{Name="vss-ottb"; Port=8083},
        @{Name="vss-dci"; Port=8082},
        @{Name="vss-point"; Port=8081},
        @{Name="vss-workspace"; Port=3000},
        @{Name="vss-guacamole"; Port=8080},
        @{Name="prometheus"; Port=9090},
        @{Name="grafana"; Port=3000}
    )
    
    foreach ($service in $services) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
            Write-Log "✅ $($service.Name) is responding"
        } catch {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
                Write-Log "✅ $($service.Name) is responding"
            } catch {
                Write-Warning-Log "⚠️ $($service.Name) health check failed (may need more time to start)"
            }
        }
    }
}

function Main {
    Write-Log "Starting VSS DEMIURGE deployment..."
    
    Test-Environment
    Backup-Existing
    Start-Infrastructure
    
    Write-Log "Waiting for services to initialize..."
    Start-Sleep -Seconds 10
    
    Test-Health
    
    Write-Log "🎉 VSS DEMIURGE deployment completed successfully!"
    Write-Log ""
    Write-Log "📊 Access URLs:"
    Write-Log "   - RabbitMQ Management: http://localhost:15672"
    Write-Log "   - VSS Workspace: http://localhost:3000"
    Write-Log "   - VSS OTTB API: http://localhost:8083"
    Write-Log "   - VSS DCI API: http://localhost:8082"
    Write-Log "   - VSS POINT API: http://localhost:8081"
    Write-Log "   - Guacamole: http://localhost:8080"
    Write-Log "   - Prometheus: http://localhost:9090"
    Write-Log "   - Grafana: http://localhost:3001 (admin / password from .env)"
    Write-Log ""
    Write-Log "🔧 Next steps:"
    Write-Log "   1. Configure your trunks in the OTTB interface"
    Write-Log "   2. Set up Tailscale for remote access"
    Write-Log "   3. Configure Archonts templates for call centers"
    Write-Log "   4. Import Grafana dashboards from config/grafana/dashboards"
}

try {
    Main
} catch {
    Write-Error-Log "Deployment failed: $_"
    exit 1
}

