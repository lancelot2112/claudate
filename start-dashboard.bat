@echo off
setlocal enabledelayedexpansion

REM Claudate Dashboard Startup Script for Windows
REM Starts both backend API and frontend dashboard simultaneously

echo [DASHBOARD] Starting Claudate Dashboard...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js to continue.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed. Please install npm to continue.
    pause
    exit /b 1
)

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%"
set "FRONTEND_DIR=%SCRIPT_DIR%dashboard-frontend-app"

REM Check if directories exist
if not exist "%BACKEND_DIR%" (
    echo [ERROR] Backend directory not found: %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%" (
    echo [ERROR] Frontend directory not found: %FRONTEND_DIR%
    pause
    exit /b 1
)

REM Create logs directory
if not exist "%SCRIPT_DIR%logs" mkdir "%SCRIPT_DIR%logs"

REM Install backend dependencies if needed
echo [DASHBOARD] Checking backend dependencies...
cd /d "%BACKEND_DIR%"
if not exist "node_modules" (
    echo [DASHBOARD] Installing backend dependencies...
    npm install
) else (
    echo [SUCCESS] Backend dependencies are up to date
)

REM Install frontend dependencies if needed
echo [DASHBOARD] Checking frontend dependencies...
cd /d "%FRONTEND_DIR%"
if not exist "node_modules" (
    echo [DASHBOARD] Installing frontend dependencies...
    npm install
) else (
    echo [SUCCESS] Frontend dependencies are up to date
)

REM Start backend server
echo [DASHBOARD] Starting backend server...
cd /d "%BACKEND_DIR%"
start "Backend Server" cmd /c "set PORT=3001 && npm start > logs\backend.log 2>&1"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

echo [SUCCESS] Backend server started - http://localhost:3001

REM Start frontend server  
echo [DASHBOARD] Starting frontend server...
cd /d "%FRONTEND_DIR%"
start "Frontend Server" cmd /c "npm run dev > ..\logs\frontend.log 2>&1"

REM Wait for frontend to start
timeout /t 5 /nobreak >nul

echo [SUCCESS] Frontend server started - http://localhost:3000

REM Display status
echo.
echo [SUCCESS] 🚀 Claudate Dashboard is now running!
echo.
echo Services:
echo   📊 Dashboard:    http://localhost:3000
echo   🔧 Backend API:  http://localhost:3001  
echo   📊 Dashboard UI: http://localhost:3000/dashboard
echo.
echo Logs:
echo   📝 Backend:  tail -f logs/backend.log
echo   📝 Frontend: tail -f logs/frontend.log
echo.
echo [WARNING] Close this window or press Ctrl+C to stop all services
echo [WARNING] Both servers are running in separate windows
echo.

REM Keep script running
pause