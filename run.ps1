# Run both backend and frontend on Windows (PowerShell)
# Usage: Right-click -> Run with PowerShell, or open PowerShell and run: .\run.ps1

$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

Write-Host "Starting backend in a new PowerShell window..."
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location -LiteralPath '$backend'; if(-not (Test-Path '.\.venv')){ python -m venv .\.venv }; . .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt; python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000" -WorkingDirectory $backend

Write-Host "Starting frontend in a new PowerShell window..."
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location -LiteralPath '$frontend'; npm install; npm run dev" -WorkingDirectory $frontend

Write-Host "Done. Two windows were opened for backend and frontend. Close them to stop the servers."