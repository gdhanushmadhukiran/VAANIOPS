# ==============================================================================
# VaaniOps — Gnani Evon v3.3 Hosted GPU Container Specification
# Model: gnani/gnani-evon-v3.3 (30B Mamba2-Transformer MoE)
# Hardware: NVIDIA A100 (80GB), H100 (80GB), or H200 (141GB)
# ==============================================================================

FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    VLLM_NO_USAGE_STATS=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3.11-venv \
    python3-pip \
    git \
    curl \
    wget \
    build-essential \
    ninja-build \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set default python
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Upgrade pip & install torch and vLLM as required by model card
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
RUN pip install --no-cache-dir "vllm>=0.12.0" "transformers>=4.49.0" hf-transfer huggingface_hub

# Create app directory
WORKDIR /app

# Copy runtime entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Default port for vLLM internal listener
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]

