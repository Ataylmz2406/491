@echo off
SETLOCAL EnableExtensions

echo Starting Skin Lesion Analysis ...

:: 1. Check for Python
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Python is not installed or not in your PATH.
    echo Please install Python 3.9+ from python.org and try again.
    pause
    exit /b
)

:: 2. Setup Backend
echo.
echo [1/2] Setting up Backend...
cd backend

IF NOT EXIST "venv" (
    echo Creating virtual environment...
    python -m venv venv
) ELSE (
    echo Virtual environment already exists.
)

echo Activating venv and installing requirements...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt

:: Start uvicorn in a new window so it doesn't block
start "Backend Server" cmd /k "uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd ..

:: 3. Setup Frontend
echo.
echo [2/2] Setting up Frontend...
cd frontend

call npm -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed.
    echo Please install Node.js from nodejs.org and try again.
    pause
    exit /b
)

if NOT EXIST "node_modules" (
    echo Installing npm packages...
    call npm install
) ELSE (
    echo Node modules already installed.
)

start "Frontend Server" cmd /k "npm run dev"
cd ..

echo.
echo ====================================================
echo Servers are launching in separate windows.
echo Backend: http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
echo Close the popup windows to stop the servers.
echo ====================================================
pause
