#!/usr/bin/env bash
# ==============================================================================
# VaaniOps — Evon v3.3 vLLM Service Entrypoint
# ==============================================================================
set -euo pipefail

MODEL_ID="${MODEL_ID:-gnani/gnani-evon-v3.3}"
SERVED_MODEL_NAME="${SERVED_MODEL_NAME:-model}"
PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"
TENSOR_PARALLEL_SIZE="${TENSOR_PARALLEL_SIZE:-1}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-0.92}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-131072}"
MAX_NUM_SEQS="${MAX_NUM_SEQS:-16}"

echo "=========================================================="
echo "Starting VaaniOps Gnani Evon v3.3 vLLM Inference Engine"
echo "Model: ${MODEL_ID}"
echo "Served Name: ${SERVED_MODEL_NAME}"
echo "Max Context Length: ${MAX_MODEL_LEN}"
echo "Tensor Parallel Size: ${TENSOR_PARALLEL_SIZE}"
echo "GPU Memory Target: ${GPU_MEMORY_UTILIZATION}"
echo "=========================================================="

# Check GPU availability
if ! command -v nvidia-smi &> /dev/null; then
    echo "ERROR: nvidia-smi not detected. Please verify NVIDIA driver and Container Toolkit."
    exit 1
fi

echo "NVIDIA GPU Detected:"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader

# Execute vLLM serve following official gnani-evon-v3.3 model-card specification
exec python3 -m vllm.entrypoints.openai.api_server \
    --model "${MODEL_ID}" \
    --served-model-name "${SERVED_MODEL_NAME}" \
    --host "${HOST}" \
    --port "${PORT}" \
    --trust-remote-code \
    --enable-auto-tool-choice \
    --tool-call-parser qwen3_coder \
    --reasoning-parser nano_v3 \
    --max-model-len "${MAX_MODEL_LEN}" \
    --tensor-parallel-size "${TENSOR_PARALLEL_SIZE}" \
    --gpu-memory-utilization "${GPU_MEMORY_UTILIZATION}" \
    --max-num-seqs "${MAX_NUM_SEQS}" \
    --dtype bfloat16 \
    --disable-log-requests

