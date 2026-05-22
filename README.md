---
title: SUDerm
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

<div align="center">

# 🔬 SUDerm — Skin Lesion Analysis

**AI-powered dermatology assistant built on SwinV2 Transformer**

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=white)](https://vitejs.dev)
[![Flutter](https://img.shields.io/badge/Flutter-mobile-02569B?logo=flutter&logoColor=white)](https://flutter.dev)
[![Hugging Face](https://img.shields.io/badge/HuggingFace-Space-FFD21E?logo=huggingface&logoColor=black)](https://huggingface.co/spaces/suderm/suderm)

</div>

---

## Overview

SUDerm is a professional skin lesion analysis application powered by a fine-tuned **SwinV2** vision transformer trained on the MILK10k and ISIC datasets. It provides dermatological image classification through a web interface and a cross-platform mobile app.

| Component | Technology |
|-----------|-----------|
| AI Model | SwinV2 Transformer (PyTorch) |
| Backend | FastAPI (Python 3.10+) |
| Web Frontend | React + Vite |
| Mobile App | Flutter (Dart) |
| Deployment | Docker · Hugging Face Spaces · GitHub Actions |

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.10+ | Required for modern type syntax in the backend |
| Node.js | 20.19+ | Matches the frontend Vite toolchain |

---

## Model Weights

> **The model checkpoint is not included in this repository due to its size.**

To run predictions locally, obtain the checkpoint file and place it in the **project root**:

```
ENS491/
├── MILK10k_SwinV2_ISICinit_fold4_best.pth   ← place file here
├── backend/
│   ├── main.py
│   └── ...
├── frontend/
└── ...
```

**Expected SHA-256:**
```
96183b808508b3e357a1f92ecadc0f30d14a77c15aa53d420154eb54b45faae5
```

---

## Quick Start

The run scripts automatically create virtual environments, install Python dependencies, and install Node modules on first run.

### Windows

<details>
<summary><strong>Option 1 — Batch Script (Command Prompt)</strong></summary>

```cmd
run.bat
```

Double-click the file or run it from Command Prompt.
</details>

<details>
<summary><strong>Option 2 — PowerShell</strong></summary>

Right-click `run.ps1` → **Run with PowerShell**, or:

```powershell
.\run.ps1
```

If script execution is blocked, enable it for the current session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\run.ps1
```
</details>

### macOS / Linux

```bash
chmod +x run.sh
./run.sh
```

---

## Accessing the App

Once the scripts finish, open your browser:

| Service | URL |
|---------|-----|
| Web Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |

The Vite dev server automatically proxies `/api` requests to the FastAPI backend — no extra environment variables needed.

---

## Configuration

The backend reads the following **optional** environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SUDERM_CORS_ORIGINS` | `http://localhost:5173,`<br>`http://127.0.0.1:5173` | Comma-separated allowed frontend origins |
| `SUDERM_ACCESS_TOKEN_TTL_MINUTES` | `15` | Access token lifetime (minutes) |
| `SUDERM_REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh token cookie lifetime (days) |
| `SUDERM_SECURE_COOKIES` | — | Set to `true` when serving over HTTPS |
| `SUDERM_MODEL_CHECKPOINT_SHA256` | *(see above)* | Trusted SHA-256 for the `.pth` file |
| `SUDERM_ALLOW_UNTRUSTED_CHECKPOINT` | `false` | Skip hash verification (local experiments only — **do not use in production**) |
| `SUDERM_ALLOW_UNSAFE_CHECKPOINT_LOAD` | `false` | Load checkpoint with `weights_only=False` (legacy local use only) |

---

## Hugging Face Deployment

The root `Dockerfile` builds the React frontend, bundles it into the FastAPI backend, and exposes the app on **port 7860** for Hugging Face Spaces.

Continuous deployment is handled by `.github/workflows/deploy-huggingface.yml`:

1. The workflow downloads the pre-uploaded model artifact (`MILK10k_SwinV2_ISICinit_fold4_best.bin`) from the HF Space.
2. It then uploads the updated app files back to the `suderm/suderm` Space.

**Required GitHub secret:** `HF_TOKEN` with write access to the target Hugging Face Space.

---

## Author

**Eren Can Sever** — [batu.cansever@sabanciuniv.edu](mailto:batu.cansever@sabanciuniv.edu)

---

## License

This project does not currently specify a license. Contact the repository owner for usage permissions.
