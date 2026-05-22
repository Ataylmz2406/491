FROM node:22-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

RUN useradd -m -u 1000 user \
    && apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    DATABASE_URL=sqlite:////home/user/app/backend/suderm.db \
    SUDERM_SECURE_COOKIES=true \
    SUDERM_CORS_ORIGINS=https://suderm-suderm.hf.space,https://app.suderm.net,https://suderm.net,https://www.suderm.net

WORKDIR $HOME/app

COPY --chown=user backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision \
    && pip install --no-cache-dir -r backend/requirements.txt

COPY --chown=user backend backend
COPY --chown=user ["Mil10K images", "Mil10K images"]
COPY --chown=user MILK10k_SwinV2_ISICinit_fold4_best.* ./
RUN if [ -f MILK10k_SwinV2_ISICinit_fold4_best.bin ] && [ ! -f backend/MILK10k_SwinV2_ISICinit_fold4_best.pth ]; then \
        cp MILK10k_SwinV2_ISICinit_fold4_best.bin backend/MILK10k_SwinV2_ISICinit_fold4_best.pth; \
    elif [ -f MILK10k_SwinV2_ISICinit_fold4_best.pth ] && [ ! -f backend/MILK10k_SwinV2_ISICinit_fold4_best.pth ]; then \
        cp MILK10k_SwinV2_ISICinit_fold4_best.pth backend/MILK10k_SwinV2_ISICinit_fold4_best.pth; \
    fi
COPY --chown=user --from=frontend-build /app/frontend/dist frontend/dist

RUN mkdir -p backend/static/heatmaps

WORKDIR $HOME/app/backend
EXPOSE 7860

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
