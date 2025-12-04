@echo off
REM VSS OMNI TELECOM - Full Stack Stopper
REM This script stops all VSS components

title VSS Full Stack Stopper

echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║         VSS OMNI TELECOM - STOPPING ALL SERVICES      ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

REM Stop Node.js services
echo [1/3] Stopping Node.js services...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js services stopped
) else (
    echo [INFO] No Node.js processes were running
)
echo.

REM Stop Nginx
echo [2/3] Stopping Nginx...
call nginx-control.bat stop >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Nginx stopped
) else (
    taskkill /F /IM nginx.exe 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Nginx stopped
    ) else (
        echo [INFO] Nginx was not running
    )
)
echo.

REM Stop Docker containers
echo [3/3] Stopping Docker containers...
echo   - PostgreSQL
docker stop vss-postgres 2>nul
echo   - Redis
docker stop vss-redis 2>nul
echo   - RabbitMQ
docker stop vss-rabbitmq 2>nul
echo [OK] Docker containers stopped
echo.

echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║           ✅ ALL SERVICES STOPPED!                    ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.
echo To restart the stack, run: start-full-stack.bat
echo.
pause

