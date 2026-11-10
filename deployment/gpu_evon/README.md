# VaaniOps — Gnani Evon v3.3 Hosted GPU Deployment Guide

This guide details the complete hardware assessment, installation, security, and integration architecture for deploying **Gnani Evon v3.3** on a dedicated hosted Linux NVIDIA GPU server with **vLLM**.

---

## 1. Hardware Sizing & Memory Assessment

### Model Specifications
- **Model**: `gnani/gnani-evon-v3.3` (or `gnani/gnani-evon-v3.3-30B-A3B`)
- **Parameters**: 30 Billion total parameters (~3.5B active parameters per token)
- **Architecture**: Mamba2-Transformer Hybrid Mixture of Experts (MoE)
- **Precision**: BF16 (16-bit brain floating point)
- **Native Context Window**: 131,072 tokens (128K)

### VRAM Calculation
1. **Base Model Weights**:
   $$30 \times 10^9 \text{ parameters} \times 2 \text{ bytes (BF16)} \approx 60.0 \text{ GB}$$
2. **CUDA Runtime & Kernel Overhead**:
   $$\approx 4.0 \text{ GB}$$
3. **KV Cache & Sequence Activations**:
   - For Hybrid MoE models, Mamba2 state has fixed memory overhead ($O(1)$ with sequence length).
   - The Transformer attention layers require KV cache:
     - At 32K context: $\approx 6 \text{ GB}$ (Supports concurrent batch size $8\text{--}16$).
     - At 64K context: $\approx 10 \text{ GB}$ (Supports concurrent batch size $4\text{--}8$).
     - At 128K context: $\approx 16 \text{ GB}$ (Requires tightly managed batch size on 80GB).

### Recommended GPU Hardware
| Hardware Configuration | Total VRAM | Recommended `MAX_MODEL_LEN` | Concurrency | Suitability | Estimated Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1x NVIDIA H200 SXM** | **141 GB** | **131,072 (Full 128K)** | High (16+ seqs) | **Best-in-class / Production** | ~$3.99 - $4.50 / hr |
| **1x NVIDIA H100 SXM** | **80 GB** | **65,536 (or 128K single)** | Medium (8-16 seqs) | **Recommended Standard** | ~$2.49 - $3.49 / hr |
| **1x NVIDIA A100 SXM** | **80 GB** | **32,768 - 65,536** | Moderate (4-8 seqs) | **Budget Production** | ~$1.49 - $1.99 / hr |
| **2x NVIDIA A100 80GB** | **160 GB (TP=2)** | **131,072 (Full 128K)** | High (32+ seqs) | **High Concurrency** | ~$2.98 - $3.98 / hr |

> [!IMPORTANT]
> A single 80GB GPU (A100 or H100) comfortably hosts the 60GB model weights. For 128K context with high concurrent traffic, either deploy on an **NVIDIA H200 (141GB)**, run **Tensor Parallelism 2 (2x A100 80GB)**, or set `--max-model-len 32768` for workshop operations where transcripts are under 2,000 tokens.

---

## 2. Recommended Cloud GPU Providers

1. **RunPod (Community or Secure Cloud)**:
   - 1x H100 80GB SXM: ~$2.99/hr (on-demand).
   - 1x A100 80GB SXM: ~$1.89/hr.
   - Fast network storage with pre-baked PyTorch/CUDA templates.
2. **Lambda Labs Cloud**:
   - 1x H100 80GB SXM: ~$2.49/hr.
   - 1x A100 80GB SXM: ~$1.49/hr.
3. **FluidStack / Vast.ai**:
   - Flexible spot/on-demand compute.

---

## 3. Deployment Steps

### Quick Start with Docker Compose
1. SSH into your GPU server:
   ```bash
   ssh root@<YOUR_GPU_SERVER_IP>
   ```
2. Clone repository or copy `deployment/gpu_evon`:
   ```bash
   git clone <REPO_URL>
   cd ops/deployment/gpu_evon
   ```
3. Run the automated installer:
   ```bash
   chmod +x deploy_gpu_server.sh
   sudo ./deploy_gpu_server.sh
   ```

### Manual vLLM Command (Reference)
```bash
pip install -U "vllm>=0.12.0"

vllm serve gnani/gnani-evon-v3.3 \
  --served-model-name model \
  --max-model-len 131072 \
  --port 8000 \
  --trust-remote-code \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --reasoning-parser nano_v3 \
  --dtype bfloat16
```

---

## 4. Connecting the VaaniOps Backend

In `backend/.env`, configure the GPU server endpoint and secret:
```env
EVON_BASE_URL=https://<YOUR_GPU_SERVER_HOST>/v1
EVON_MODEL=model
EVON_API_KEY=<YOUR_EVON_GPU_SECRET>
EVON_ENABLED=true
EVON_TIMEOUT_SECONDS=60
```

