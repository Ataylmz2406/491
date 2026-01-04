@echo off
SETLOCAL EnableExtensions

echo Starting Skin Lesion Analysis ...

:: 1. Start Backend in background
echo Starting Backend...
cd backend
IF EXIST "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) ELSE (
    echo Virtual environment not found or check path backend\venv
    pause
    exit /b
)

:: Start uvicorn in a new window so it doesn't block
start "Backend Server" cmd /k "uvicorn main:app --reload --port 8000"
cd ..

:: 2. Start Frontend in a new window
echo Starting Frontend...
cd frontend
start "Frontend Server" cmd /k "npm run dev"
cd ..

echo.
echo ====================================================
echo Servers are launching in separate windows.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Close the popup windows to stop the servers.
echo ====================================================
pause
