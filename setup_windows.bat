@echo off
SETLOCAL EnableExtensions

echo ====================================================
echo Skin Lesion Analysis - Windows Setup Script
echo ====================================================

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

echo Activate venv and installing requirements...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt

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

cd ..

echo.
echo ====================================================
echo Setup Complete!
echo You can now run the project using 'run.bat'
echo ====================================================
pause
