# VaaniOps — Gnani AI Integration & API Diagnostics Guide

## 1. Overview
VaaniOps integrates **Gnani AI's official Vachana APIs** to deliver a genuine Telugu-first voice operating system for India's small businesses:
- **Speech-to-Text (STT):** Gnani Prisma v2.5
- **Text-to-Speech (TTS):** Gnani Timbre v2.5

---

## 2. Official Endpoint Specifications

### A. Gnani Prisma v2.5 (STT)
- **Official Endpoint:** `POST https://api.vachana.ai/stt/v3`
- **Authentication Header:** `X-API-Key-ID: <GNANI_API_KEY>`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `audio_file`: Converted 16 kHz Mono 16-bit linear PCM `.wav` file (max 30 seconds duration, < 10MB).
  - `language_code`: `te-IN` (Telugu) or `en-IN` (English India).
- **Model Rules:**
  - Prisma v2.5 is the official default model.
  - Accepts a single language code per request (never a comma-separated list).
- **Expected Success Response:**
  ```json
  {
    "success": true,
    "request_id": "req-xyz789",
    "transcript": "రవి గారు బైక్ రిపేర్ కోసం ఇచ్చారు...",
    "model": "prisma-v2.5"
  }
  ```

### B. Gnani Timbre v2.5 (TTS)
- **Official Endpoint:** `POST https://api.vachana.ai/api/v1/tts/inference`
- **Authentication Header:** `X-API-Key-ID: <GNANI_API_KEY>`
- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "text": "రవి గారి సర్వీస్ ఆర్డర్ క్రియేట్ అయ్యింది.",
    "voice": "Kaveri",
    "model": "timbre-v2.5",
    "language": "te-IN",
    "speed": 1.0,
    "audio_config": {
      "encoding": "linear_pcm",
      "container": "wav",
      "num_channels": 1,
      "sample_rate": 48000,
      "sample_width": 2
    }
  }
  ```
- **Voice Catalog Validation:**
  - **Telugu (`te-IN`):** `Kaveri` (default), `Ananya`, `Chaitanya`, `Venu`.
  - **English India (`en-IN`):** `Maya` (default), `Aarav`, `Pooja`, `Rohan`.
- **Response Handling:**
  - Backend inspects `Content-Type`. If binary WAV is returned, streams directly.
  - If JSON is returned with base64 audio (`audio_content` or `audio`), decodes base64 to standard playable WAV bytes.

---

## 3. Obtaining & Storing the API Key

1. Log into your Gnani AI developer portal at [vachana.ai](https://vachana.ai).
2. Generate an API Key under **API Credentials** with permissions for Prisma and Timbre.
3. Keep the key secure. **Never hardcode or expose it in frontend client code or git commits.**

---

## 4. Local Configuration

Create your local backend environment file:
```bash
cp backend/.env.example backend/.env
```
Populate `backend/.env`:
```env
GNANI_API_KEY=your_actual_gnani_api_key_here
DATABASE_URL=sqlite:///./vaaniops.db
FRONTEND_ORIGIN=http://localhost:5173
APP_ENV=development
GNANI_TIMEOUT_SECONDS=60
```

Frontend local environment (`frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 5. Render Deployment Configuration

When hosting the backend on Render:
1. Under **Environment Variables**, configure:
   - `GNANI_API_KEY`: Paste your key (marked as secret).
   - `DATABASE_URL`: `sqlite:////app/data/vaaniops.db`
   - `FRONTEND_ORIGIN`: Your production Vercel frontend URL (e.g. `https://vaaniops.vercel.app`).
   - `APP_ENV`: `production`
   - `GNANI_TIMEOUT_SECONDS`: `60`
2. Under **Disks**, attach a 1 GB persistent disk mounted at `/app/data` to persist the SQLite database across restarts.

When hosting the frontend on Vercel:
- Set `VITE_API_BASE_URL` to your Render backend URL (e.g. `https://vaaniops-backend.onrender.com`).
- **Never place `GNANI_API_KEY` into Vercel environment variables.**

---

## 6. API Access Diagnostic States

The backend exposes a safe diagnostics endpoint: `GET /api/health/gnani`.
It returns structured service status without exposing credentials:

| State Code | Diagnostic Meaning | Recommended Action |
|------------|-------------------|-------------------|
| `no_key` / `missing_key` | `GNANI_API_KEY` is empty | Add the key to `backend/.env` or Render env vars. |
| `unauthorized` | Key is invalid or not registered | Verify the key on `vachana.ai` dashboard. |
| `credits_unavailable` | Account quota or balance exhausted | Recharge credits on your Gnani AI account. |
| `service_unavailable` | Gnani API cluster is temporarily down | Wait and retry; check status at Gnani portal. |
| `unreachable` | Network/DNS error reaching `api.vachana.ai` | Check outbound internet connection. |
| `ready` / `healthy` | Key authenticated; accepting requests | System fully operational for live STT & TTS. |

---

## 7. Common Authentication & Credit Errors

- **HTTP 401 / 403 Unauthorized:** Returned when `X-API-Key-ID` header is unrecognized. Check for trailing spaces or expired tokens.
- **HTTP 402 / 403 Insufficient Credits:** Returned when speech synthesis or transcription credits are depleted. VaaniOps detects credit error keywords and maps them to HTTP 402 with actionable guidance.
- **HTTP 429 Rate Limit:** Exceeded concurrent requests per second. VaaniOps implements an `asyncio.Lock` for Timbre synthesis to prevent overlapping jobs.

