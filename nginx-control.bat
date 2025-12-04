@echo off
REM VSS OMNI TELECOM - Nginx Control Script

if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="test" goto test
if "%1"=="status" goto status

:help
echo.
echo VSS Nginx Control
echo =================
echo.
echo Usage: nginx-control.bat [command]
echo.
echo Commands:
echo   start    - Start Nginx
echo   stop     - Stop Nginx
echo   restart  - Restart Nginx
echo   test     - Test configuration
echo   status   - Show Nginx status
echo.
goto end

:start
echo Starting Nginx...
cd /d C:\nginx
start /B nginx.exe
timeout /t 2 /nobreak >nul
echo.
echo Nginx started!
echo Access VSS at: http://79.137.207.215/
goto status

:stop
echo Stopping Nginx...
taskkill /F /IM nginx.exe 2>nul
if %ERRORLEVEL%==0 (
    echo Nginx stopped!
) else (
    echo Nginx was not running.
)
goto end

:restart
echo Restarting Nginx...
call :stop
timeout /t 2 /nobreak >nul
call :start
goto end

:test
echo Testing Nginx configuration...
cd /d C:\nginx
nginx.exe -t
goto end

:status
echo.
echo Nginx Status:
echo =============
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %ERRORLEVEL%==0 (
    echo [RUNNING] Nginx is active
    echo.
    tasklist /FI "IMAGENAME eq nginx.exe"
) else (
    echo [STOPPED] Nginx is not running
)
echo.
goto end

:end

