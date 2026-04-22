# ---- Builder stage: compile llama-cpp-python ----
FROM python:3.11-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY ./src/requirements.txt .

RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

# ---- Runtime stage: lean image ----
FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built Python packages from builder
COPY --from=builder /install /usr/local

COPY ./src/ .

RUN mkdir -p /app/models

ENV AI_HF_HOME=/app/models
ENV PYTHONUNBUFFERED=1

EXPOSE 8100

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "1"]
