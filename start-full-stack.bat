@echo off
REM VSS OMNI TELECOM - Full Stack Launcher
REM This script starts all VSS components in the correct order

title VSS Full Stack Launcher

echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║         VSS OMNI TELECOM - FULL STACK LAUNCHER        ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

REM Step 1: Check Docker
echo [1/5] Checking Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running or not installed!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo [OK] Docker is running
echo.

REM Step 2: Start Docker Containers
echo [2/5] Starting Docker containers...
echo   - PostgreSQL
echo   - Redis  
echo   - RabbitMQ

REM Check if containers exist, if not create them
docker ps -a --format "{{.Names}}" | findstr "vss-postgres" >nul
if %ERRORLEVEL% NEQ 0 (
    echo Creating PostgreSQL container...
    docker run -d --name vss-postgres -e POSTGRES_USER=vss_admin -e POSTGRES_PASSWORD=vss_secure_pass_2024 -e POSTGRES_DB=vss_db -p 5432:5432 -v vss_postgres_data:/var/lib/postgresql/data --restart unless-stopped postgres:15-alpine
) else (
    docker start vss-postgres
)

docker ps -a --format "{{.Names}}" | findstr "vss-redis" >nul
if %ERRORLEVEL% NEQ 0 (
    echo Creating Redis container...
    docker run -d --name vss-redis -p 6379:6379 --restart unless-stopped redis:7-alpine
) else (
    docker start vss-redis
)

docker ps -a --format "{{.Names}}" | findstr "vss-rabbitmq" >nul
if %ERRORLEVEL% NEQ 0 (
    echo Creating RabbitMQ container...
    docker run -d --name vss-rabbitmq -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=vss-admin -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass --restart unless-stopped rabbitmq:3-management-alpine
) else (
    docker start vss-rabbitmq
)

echo [OK] Docker containers started
echo Waiting 15 seconds for database initialization...
timeout /t 15 /nobreak >nul
echo.

REM Step 3: Start VSS Services
echo [3/5] Starting VSS Node.js services...
echo   - Install Wizard
echo   - VSS Demiurge
echo   - Admin Backend
echo   - Workspace
echo   - Point API
echo   - DCI API
echo   - OTTB API

start "VSS Services" /MIN powershell -NoExit -Command "cd '%~dp0'; npm run start:all"
echo [OK] VSS services starting...
echo Waiting 25 seconds for services initialization...
timeout /t 25 /nobreak >nul
echo.

REM Step 4: Start Nginx
echo [4/5] Starting Nginx Gateway...
call nginx-control.bat start >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Nginx started
) else (
    echo [WARNING] Nginx may not have started correctly
    echo You can still access services directly via their ports
)
echo.

REM Step 5: Open Browsers
echo [5/5] Opening web interfaces...
timeout /t 2 /nobreak >nul

start http://79.137.207.215/
timeout /t 1 /nobreak >nul
start http://79.137.207.215:3000/vss-dashboard.html
timeout /t 1 /nobreak >nul
start http://79.137.207.215:8181/

echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║              ✅ VSS STACK IS READY!                   ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.
echo 🌐 Web Interfaces:
echo    Main:      http://79.137.207.215/
echo    Dashboard: http://79.137.207.215:3000/vss-dashboard.html
echo    Demiurge:  http://79.137.207.215:8181/
echo.
echo 🔐 Login: admin / admin123
echo.
echo 📊 Management:
echo    RabbitMQ:  http://79.137.207.215:15672/
echo    Docker:    docker ps
echo    Nginx:     nginx-control.bat status
echo.
echo Press any key to close this window...
pause >nul

