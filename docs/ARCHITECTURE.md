# VaaniOps — System Architecture & Technical Design

## 1. Executive Summary
**VaaniOps** is a Telugu-first Voice Operating System engineered for India's micro and small businesses—workshops, electricians, plumbers, and local repair shops. The platform transforms natural spoken Telugu and English into validated business work orders and provides instant spoken audio confirmation.

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|  [Microphone] -> MediaRecorder -> Web Audio API (Resample 16kHz Mono 16-bit WAV)  |
|                                       |                                           |
|                           HTTP POST /api/transcribe                               |
+---------------------------------------|-------------------------------------------+
                                        v
+-----------------------------------------------------------------------------------+
|                              FASTAPI BACKEND                                      |
|                                                                                   |
|  [AudioService] -> Validates RIFF/WAVE header, 16kHz, duration <= 30s             |
|        |                                                                          |
|        v                                                                          |
|  [GnaniPrismaService] === POST api.vachana.ai/stt/v3 ===> Gnani Prisma v2.5      |
|        |                                                                          |
|        +<--- Real Telugu/English Transcript <------------------------------------+
|        v                                                                          |
|  [OrderExtractor] -> Deterministic extraction of Customer, Asset, Service, Date   |
|        |             (Isolated interface ready for future Evon v3.3 LLM)          |
|        v                                                                          |
|  [SQLAlchemy Session] -> SQLite Database (Persistent Volume)                      |
|        |                                                                          |
|  [GnaniTimbreService] === POST api.vachana.ai/api/v1/tts/inference ===> Timbre   |
|        |                                                                          |
|        +<--- Spoken Telugu WAV (Kaveri voice) <----------------------------------+
+---------------------------------------|-------------------------------------------+
                                        v
+-----------------------------------------------------------------------------------+
|                             HTML5 AUDIO PLAYBACK                                  |
|                 User hears confirmed order in natural Telugu                      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Frontend Architecture
- **Framework:** React 18 + TypeScript + Vite + Tailwind CSS.
- **Audio Processing Pipeline:**
  1. Captures audio via browser `navigator.mediaDevices.getUserMedia`.
  2. Employs `MediaRecorder` with 200ms timeslices.
  3. Decodes source audio buffer using `AudioContext.decodeAudioData`.
  4. Resamples dynamically to **16,000 Hz Mono** via `OfflineAudioContext`.
  5. Enforces strict 16-bit linear PCM WAV formatting (`44-byte RIFF header`).
  6. Automatically caps recording at 30 seconds with a real-time progress indicator.
  7. Ensures unsupported WebM/Opus audio is never forwarded to speech models.

---

## 3. Backend Architecture & Service Separation
Built with Python 3.12 and FastAPI using clean hexagonal service separation:

### A. `app/services/audio_service.py`
- Inspects audio headers, verifying `RIFF` signature, `WAVE` format, and `fmt ` subchunk.
- Validates sample rate, mono channel count, and bit depth.
- Calculates exact duration in seconds from frame count and sample rate; rejects recordings exceeding 30 seconds.
- Enforces maximum file size limit (10 MB).

### B. `app/services/gnani_prisma.py`
- Communicates with official endpoint `POST https://api.vachana.ai/stt/v3`.
- Authenticates using `X-API-Key-ID: <GNANI_API_KEY>`.
- Sends `audio_file` (multipart WAV) and single `language_code` (`te-IN` or `en-IN`).
- Handles response payloads, extracts `transcript`, `model`, and `request_id`.
- Safely handles authentication failures (401/403), credit exhaustion (402), and timeouts (504).

### C. `app/services/order_extractor.py`
- Deterministic regex and lexical pattern extraction for Telugu-English mixed speech.
- Extracts:
  - `customer_name`: Respects Telugu honorifics (`garu`, `gaaru`, `gari`, `babu`, `anna`) and direct titles.
  - `vehicle_or_asset`: Two-wheelers, three-wheelers, home appliances, plumbing fixtures.
  - `service_type`: Actionable repair services (brake pad replacement, oil change, wiring, leakage, etc.).
  - `delivery_date` & `delivery_time`: Natural phrases (`repu`, `eroju`, `sayantram`, `morning`, etc.).
  - `estimated_cost`: Numeric INR currency values.
- **Evon v3.3 Isolation:** The extractor adheres to a strict interface (`extract(transcript, language_code) -> ExtractedOrderInfo`), enabling seamless drop-in replacement with Evon v3.3 when open model weights become available without modifying API contracts or UI components.

### D. `app/services/gnani_timbre.py`
- Synthesizes spoken Telugu/English confirmations via `POST https://api.vachana.ai/api/v1/tts/inference`.
- Enforces official voice catalog per language (`te-IN`: Kaveri, Ananya, Chaitanya, Venu; `en-IN`: Maya, Aarav, Pooja, Rohan).
- Handles dual response formats: direct binary `audio/wav` stream and JSON base64-encoded audio.
- Employs an `asyncio.Lock` concurrency guard to prevent overlapping synthesis jobs.

---

## 4. Database Schema (`WorkOrder`)
Implemented via SQLAlchemy ORM with automatic schema initialization on startup:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer (PK) | Auto-incrementing primary key |
| `order_number` | String(50) (Unique, Index) | Unique formatted identifier: `VO-YYYYMMDD-XXXX` |
| `customer_name` | String(150) (Index) | Verified customer / contact name |
| `service_type` | String(200) | Primary repair or service category |
| `vehicle_or_asset` | String(150) (Nullable) | Vehicle model, asset, or equipment |
| `description` | Text (Nullable) | Problem description or special instructions |
| `delivery_date` | String(50) (Nullable) | Promised delivery date |
| `delivery_time` | String(50) (Nullable) | Promised delivery time |
| `estimated_cost` | Float (Nullable) | Price estimate in INR |
| `status` | String(50) (Index) | Status: `pending`, `in_progress`, `completed`, `cancelled` |
| `original_transcript` | Text (Nullable) | Raw speech transcript from Gnani Prisma |
| `language_code` | String(20) | Language code (`te-IN` or `en-IN`) |
| `created_at` | DateTime (UTC) | Creation timestamp |
| `updated_at` | DateTime (UTC) | Last updated timestamp |

---

## 5. Security & Isolation
- **No Client Secrets:** `GNANI_API_KEY` is strictly confined to the backend environment and never leaked in HTTP headers, responses, or bundle files.
- **Safe Key Masking:** Diagnostic endpoints expose only masked previews (e.g. `gn_...345`).
- **Input Sanitization:** String inputs are trimmed and bounded with Pydantic validations.
- **Audio Privacy:** Audio recordings are processed in-memory or streamed; raw voice files are not permanently stored on disk by default.

