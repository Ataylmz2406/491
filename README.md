---
title: SUDerm
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# SUDerm - Skin Lesion Analysis

A SwinV2-based AI application for professional skin lesion analysis.

## Prerequisites

- **Python 3.10+** from python.org
- **Node.js 20.19+** from nodejs.org

Python 3.10+ is required because the backend uses modern Python type syntax. Node.js 20.19+ aligns with the current frontend toolchain.

## Important: Model Weights

Due to their size, the model weights (`MILK10k_SwinV2_ISICinit_fold4_best.pth`) are not included in this repository.

To run predictions, obtain `MILK10k_SwinV2_ISICinit_fold4_best.pth` and place it directly inside the project root:

```text
ENS491/
├── MILK10k_SwinV2_ISICinit_fold4_best.pth  <-- PLACE FILE HERE
├── backend/
│   ├── main.py
│   └── ...
```

The backend resolves the model path from the project root. The provided run scripts already start the backend from the expected location.

## Running the Application

The project includes setup scripts that create virtual environments, install Python requirements, and install Node modules on first run.

### Windows Users

You have two options to run the application on Windows.

**Option 1: Batch Script (Command Prompt)**

Double-click `run.bat` or run it from Command Prompt:

```cmd
run.bat
```

**Option 2: PowerShell Script**

Right-click `run.ps1` and select "Run with PowerShell", or run it from PowerShell:

```powershell
.\run.ps1
```

If PowerShell blocks script execution, run PowerShell as your user and allow local scripts for the session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\run.ps1
```

### macOS / Linux Users

Use the provided Bash script:

```bash
chmod +x run.sh
./run.sh
```

## Accessing the Application

After the scripts finish setup and start both servers, open:

- **Frontend Portal**: http://localhost:5173
- **Backend API**: http://localhost:8000

The frontend dev server proxies `/api` requests to the backend at `http://127.0.0.1:8000`, so the default scripts work without extra frontend environment variables.

## Optional Configuration

The backend supports these optional environment variables:

- `SUDERM_CORS_ORIGINS`: comma-separated allowed frontend origins. Default: `http://localhost:5173,http://127.0.0.1:5173`
- `SUDERM_ACCESS_TOKEN_TTL_MINUTES`: access-token lifetime. Default: `15`
- `SUDERM_REFRESH_TOKEN_TTL_DAYS`: refresh-token cookie lifetime. Default: `7`
- `SUDERM_SECURE_COOKIES`: set to `true` when serving over HTTPS.
- `SUDERM_MODEL_CHECKPOINT_SHA256`: trusted SHA256 for `MILK10k_SwinV2_ISICinit_fold4_best.pth`. Default is `96183b808508b3e357a1f92ecadc0f30d14a77c15aa53d420154eb54b45faae5`.
- `SUDERM_ALLOW_UNTRUSTED_CHECKPOINT`: set to `true` only for local experiments where checkpoint hash verification is intentionally disabled. Do not use in deployment.
- `SUDERM_ALLOW_UNSAFE_CHECKPOINT_LOAD`: set to `true` only for a trusted local legacy checkpoint that cannot load with `weights_only=True`.

## Hugging Face Deployment

The root `Dockerfile` builds the React frontend, serves it from the FastAPI backend, and runs the Space on port `7860`.

Automatic deployment is handled by `.github/workflows/deploy-huggingface.yml`. The GitHub repository must define an Actions secret named `HF_TOKEN` with write access to the `suderm/suderm` Hugging Face Space.

The model checkpoint is not stored in GitHub. The workflow downloads the already-uploaded Space artifact `MILK10k_SwinV2_ISICinit_fold4_best.bin` before uploading the updated app files back to Hugging Face.
