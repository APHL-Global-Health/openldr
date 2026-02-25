FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (better layer caching)
COPY ./src/requirements.txt .

# CPU-only torch (smaller image ~2GB vs ~5GB for CUDA)
# GPU variant: change index URL to https://download.pytorch.org/whl/cu121
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY ./src/ .

RUN mkdir -p /app/models

ENV AI_HF_HOME=/app/models
ENV PYTHONUNBUFFERED=1

EXPOSE 8100

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "1"]