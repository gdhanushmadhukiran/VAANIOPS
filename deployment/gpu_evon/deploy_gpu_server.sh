#!/usr/bin/env bash
# ==============================================================================
# VaaniOps — Evon v3.3 Automated GPU Host Provisioning Script
# Target OS: Ubuntu 22.04 LTS (NVIDIA A100 / H100 / H200)
# ==============================================================================
set -euo pipefail

echo "==================================================================="
echo "  VaaniOps — Evon v3.3 vLLM Host Installer"
echo "==================================================================="

# 1. Verify NVIDIA Driver & VRAM
if ! command -v nvidia-smi &> /dev/null; then
    echo "ERROR: nvidia-smi not found. Please install NVIDIA drivers (>= 535) before running."
    exit 1
fi

GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)
VRAM_TOTAL_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n 1)
VRAM_TOTAL_GB=$((VRAM_TOTAL_MB / 1024))

echo "Detected GPU: ${GPU_NAME} (${VRAM_TOTAL_GB} GB VRAM)"

if [ "$VRAM_TOTAL_GB" -lt 75 ]; then
    echo "WARNING: Gnani Evon v3.3 (30B MoE) requires at least ~60GB for BF16 weights."
    echo "An 80GB+ GPU (A100 80GB, H100 80GB, or H200 141GB) is strictly recommended."
    read -p "Do you wish to continue with constrained memory? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 2. Install Docker if missing
if ! command -v docker &> /dev/null; then
    echo "Installing Docker CE..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# 3. Install NVIDIA Container Toolkit if missing
if ! dpkg -l | grep -q nvidia-container-toolkit; then
    echo "Configuring NVIDIA Container Toolkit..."
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
      sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
      tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
    apt-get update
    apt-get install -y nvidia-container-toolkit
    nvidia-ctk runtime configure --runtime=docker
    systemctl restart docker
fi

# 4. Prepare Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env.gpu ]; then
    echo "Creating .env.gpu configuration..."
    SECRET_KEY=$(openssl rand -hex 16)
    cp .env.gpu.example .env.gpu
    sed -i "s/change_this_secret_in_production/${SECRET_KEY}/g" .env.gpu
    echo "Generated EVON_GPU_SECRET: ${SECRET_KEY}"
fi

# 5. Launch vLLM Services via Docker Compose
echo "Starting vLLM container and secure reverse proxy..."
docker compose --env-file .env.gpu up -d --build

echo "Waiting for Evon v3.3 model weights to load (this takes 2-5 minutes on first download)..."
until docker compose exec -T vllm curl -s http://localhost:8000/health > /dev/null 2>&1; do
    printf "."
    sleep 5
done
echo ""

echo "==================================================================="
echo "  Evon v3.3 GPU Host Successfully Deployed!"
echo "==================================================================="
PUBLIC_IP=$(curl -s https://ifconfig.me || echo "YOUR_SERVER_IP")
source .env.gpu

echo "Add these variables to your VaaniOps backend/.env:"
echo "-------------------------------------------------------------------"
echo "EVON_BASE_URL=http://${PUBLIC_IP}/v1"
echo "EVON_MODEL=model"
echo "EVON_API_KEY=${EVON_GPU_SECRET}"
echo "EVON_ENABLED=true"
echo "-------------------------------------------------------------------"

