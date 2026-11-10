# VaaniOps — Team Contribution & Engineering Roles

## Project Overview
**VaaniOps — Voice Operating System for India's Small Businesses**  
A production-grade, deployable Telugu-first business management platform powered by Gnani AI Prisma v2.5 and Timbre v2.5.

---

## Member 1: Frontend, UX, Audio Experience & Deployment Architecture

### Core Responsibilities & Deliverables:
1. **Frontend Architecture & Design System:**
   - Designed and built the React 18 + Vite + TypeScript application adhering to a premium SaaS theme (Dark Navy sidebar `#0a0f1d`, Electric Violet `#7c3aed`, Warm canvas `#f8fafc`).
   - Implemented responsive desktop and mobile navigation layouts with Lucide React iconography.

2. **Web Audio Recording & Conversion Pipeline (`frontend/src/utils/audioRecorder.ts`):**
   - Engineered browser microphone capture using `MediaRecorder`.
   - Built the Web Audio API resampling engine (`OfflineAudioContext`) to convert recorded audio dynamically to **16 kHz Mono 16-bit linear PCM WAV**.
   - Enforced the 30-second duration constraint with real-time visual progress timers and graceful microphone permission error handlers.
   - Ensured unsupported WebM/Opus audio is never forwarded to backend endpoints.

3. **Dashboard & Voice Workspace User Experience:**
   - Created the real-time **Business Overview Dashboard** featuring aggregated KPI cards, Spoken Telugu Scenario prompts, recent work order tracking, and live voice activity logs.
   - Built the **Voice Operations Studio** containing the large microphone recorder, audio preview player, Prisma v2.5 transcript display, editable work-order form, and one-click Telugu spoken confirmation playback.
   - Created the **Orders Manager** with real-time search, status filtering, inline status update dropdowns, and an **Order Details Modal**.

4. **Deployment & CI Configuration:**
   - Configured Vercel frontend build pipeline (`npm run build` optimization, TypeScript strict checks).
   - Authored `render.yaml` specification with persistent SQLite disk mounts and health check definitions.

---

## Member 2: AI Speech Integration, FastAPI Backend, Database & API Security

### Core Responsibilities & Deliverables:
1. **FastAPI Backend & Service Modularization:**
   - Designed and developed the Python 3.12 FastAPI backend with clean service separation:
     - `app/services/gnani_prisma.py`
     - `app/services/gnani_timbre.py`
     - `app/services/order_extractor.py`
     - `app/services/audio_service.py`
   - Configured route handlers for `/api/health`, `/api/health/gnani`, `/api/transcribe`, `/api/extract`, `/api/orders`, `/api/speak`, and `/api/stats`.

2. **Gnani AI Official Speech Integrations:**
   - **Prisma v2.5 (STT):** Integrated `POST https://api.vachana.ai/stt/v3` with `X-API-Key-ID` authentication and HTTPX multipart upload. Enforced single language code (`te-IN`, `en-IN`), verified WAV duration and file size, parsed model and request ID, and mapped credit exhaustion to HTTP 402.
   - **Timbre v2.5 (TTS):** Integrated `POST https://api.vachana.ai/api/v1/tts/inference`. Implemented official voice catalog validation (`Kaveri`, `Ananya`, `Chaitanya`, `Venu`), dual response parsing (direct binary WAV and JSON base64-encoded audio), and concurrency lock guards to prevent overlapping synthesis jobs.

3. **Business Information Extraction Engine:**
   - Developed deterministic rule-based and regex extraction tailored to Telugu, English, and mixed Tanglish speech.
   - Accurately parses customer names (using honorific markers like `garu`, `gari`), equipment assets, repair services, delivery timelines, and INR costs without hallucination.
   - Maintained interface isolation to allow drop-in replacement with Evon v3.3 when open weights are available.

4. **Database & API Security:**
   - Built SQLAlchemy `WorkOrder` ORM model and SQLite persistence layer with unique order number generation (`VO-YYYYMMDD-XXXX`).
   - Implemented safe diagnostic probing in `/api/health/gnani` distinguishing missing keys, unauthorized access, and credit exhaustion without exposing raw credentials.
   - Implemented CORS controls via `FRONTEND_ORIGIN` and Docker containerization (`backend/Dockerfile`).

5. **Automated Testing Suite:**
   - Authored 32 pytest unit and integration tests covering audio validation, response parsing, error states, extraction rules, and order lifecycles (31 passed, 1 skipped live integration).

---

## Shared Knowledge & Mutual Understanding
Both members have end-to-end understanding of:
- The complete audio recording, WAV resampling, and speech pipeline.
- Official Gnani AI Vachana endpoint request/response contracts and header schemas.
- The Pydantic data schemas, SQLAlchemy SQLite models, and database migration lifecycle.
- Production deployment topology across Vercel and Render.

