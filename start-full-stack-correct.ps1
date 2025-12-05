# VSS OMNI TELECOM - Pravilnyy zapusk vsego steka
# Eto skript zapuskaet vse servisy v pravilnom poryadke

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  VSS OMNI TELECOM - ZAPUSK VSYO STEKA" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Perekhodim v direktoriyu skripta
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Proverka Docker
Write-Host "[1/8] Proverka Docker..." -ForegroundColor Yellow
try {
    docker version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Docker ne zapushchen ili nedostupen!" -ForegroundColor Red
        Write-Host "   Zapustite Docker Desktop i poprobuyte snova." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] Docker dostupen" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker ne ustanovlen!" -ForegroundColor Red
    exit 1
}

# Определение команды docker-compose
$composeCmd = "docker-compose"
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    $composeCmd = "docker compose"
}

# Proverka fayla docker-compose
$composeFile = "docker-compose.vss-demiurge-simple.yml"
if (-not (Test-Path $composeFile)) {
    Write-Host "[ERROR] Fayl $composeFile ne nayden!" -ForegroundColor Red
    exit 1
}

# Ostanovka sushchestvuyushchikh konteynerov
Write-Host "`n[2/8] Ostanovka sushchestvuyushchikh konteynerov..." -ForegroundColor Yellow
& $composeCmd -f $composeFile down 2>&1 | Out-Null
Write-Host "[OK] Konteynery ostanovleny" -ForegroundColor Green

# Zapusk bazovoy infrastruktury
Write-Host "`n[3/8] Zapusk bazovoy infrastruktury (RabbitMQ, PostgreSQL, Redis)..." -ForegroundColor Yellow
& $composeCmd -f $composeFile up -d rabbitmq postgres redis

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Ne udalos zapustit bazovuyu infrastrukturu!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Bazovaya infrastruktura zapushchena" -ForegroundColor Green

# Ozhidanie gotovnosti bazovykh servisov
Write-Host "`n[4/8] Ozhidanie gotovnosti bazovykh servisov (30 sekund)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Proverka zdorovya bazovykh servisov
Write-Host "   Proverka RabbitMQ..." -ForegroundColor Gray
$rabbitmqReady = $false
for ($i = 1; $i -le 15; $i++) {
    $result = docker exec vss-rabbitmq rabbitmq-diagnostics ping 2>&1
    if ($LASTEXITCODE -eq 0) {
        $rabbitmqReady = $true
        Write-Host "   [OK] RabbitMQ gotov" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $rabbitmqReady) {
    Write-Host "   [WARN] RabbitMQ eshche ne gotov, no prodolzhaem..." -ForegroundColor Yellow
}

Write-Host "   Proverka PostgreSQL..." -ForegroundColor Gray
$postgresReady = $false
for ($i = 1; $i -le 15; $i++) {
    $result = docker exec vss-postgres pg_isready -U vss -d vss_db 2>&1
    if ($LASTEXITCODE -eq 0) {
        $postgresReady = $true
        Write-Host "   [OK] PostgreSQL gotov" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $postgresReady) {
    Write-Host "   [WARN] PostgreSQL eshche ne gotov, no prodolzhaem..." -ForegroundColor Yellow
}

Write-Host "   Proverka Redis..." -ForegroundColor Gray
$redisReady = $false
for ($i = 1; $i -le 15; $i++) {
    $result = docker exec vss-redis redis-cli -a vss_redis_pass ping 2>&1
    if ($result -match "PONG") {
        $redisReady = $true
        Write-Host "   [OK] Redis gotov" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $redisReady) {
    Write-Host "   [WARN] Redis eshche ne gotov, no prodolzhaem..." -ForegroundColor Yellow
}

# Zapusk osnovnykh servisov
Write-Host "`n[5/8] Zapusk osnovnykh servisov (OTTB, DCI, POINT)..." -ForegroundColor Yellow
& $composeCmd -f $composeFile up -d vss-ottb vss-dci vss-point

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Ne udalos zapustit osnovnye servisy!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Osnovnye servisy zapushcheny" -ForegroundColor Green
Start-Sleep -Seconds 10

# Zapusk Guacamole
Write-Host "`n[6/8] Zapusk Guacamole..." -ForegroundColor Yellow
& $composeCmd -f $composeFile up -d guacd vss-guacamole
Write-Host "[OK] Guacamole zapushchen" -ForegroundColor Green
Start-Sleep -Seconds 5

# Zapusk Workspace i ostalnykh servisov
Write-Host "`n[7/8] Zapusk Workspace, Nginx i Docs Portal..." -ForegroundColor Yellow
& $composeCmd -f $composeFile up -d vss-workspace nginx vss-docs

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Ne udalos zapustit ostalnye servisy!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Vse servisy zapushcheny" -ForegroundColor Green

# Ozhidanie polnoy gotovnosti
Write-Host "`n[8/8] Ozhidanie polnoy gotovnosti sistemy (20 sekund)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Proverka statusa
Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "Proverka statusa konteynerov:" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
& $composeCmd -f $composeFile ps

# Vyvod informatsii o dostupe
Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  STEK USPESHNO ZAPUSHCHEN!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Dostup k servisam:" -ForegroundColor Cyan
Write-Host "   Workspace API:    http://localhost:3000" -ForegroundColor White
Write-Host "   OTTB API:         http://localhost:8083" -ForegroundColor White
Write-Host "   DCI API:          http://localhost:8082" -ForegroundColor White
Write-Host "   POINT API:        http://localhost:8081" -ForegroundColor White
Write-Host "   Nginx Gateway:    http://localhost:8085" -ForegroundColor White
Write-Host "   Guacamole:        http://localhost:8080/guacamole" -ForegroundColor White
Write-Host "   Docs Portal:      http://localhost:3100" -ForegroundColor White
Write-Host "   RabbitMQ UI:      http://localhost:15672" -ForegroundColor White
Write-Host "     (login: vss-admin, password: vss_rabbit_pass)" -ForegroundColor Gray

Write-Host "`nUpravlenie:" -ForegroundColor Cyan
Write-Host "   Prosmotr logov:   docker-compose -f $composeFile logs -f" -ForegroundColor Gray
Write-Host "   Ostanovka:        docker-compose -f $composeFile down" -ForegroundColor Gray
Write-Host "   Perezapusk:       .\start-full-stack-correct.ps1" -ForegroundColor Gray

Write-Host "`nProverka zdorovya servisov:" -ForegroundColor Cyan
Write-Host "   Workspace:        curl http://localhost:3000/health" -ForegroundColor Gray
Write-Host "   OTTB:             curl http://localhost:8083/health" -ForegroundColor Gray
Write-Host "   DCI:              curl http://localhost:8082/health" -ForegroundColor Gray
Write-Host "   POINT:            curl http://localhost:8081/health" -ForegroundColor Gray

Write-Host ""

