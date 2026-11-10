# VaaniOps — Voice Operating System for India's Small Businesses

> **Speak Naturally. Manage Intelligently.**  
> *తెలుగు-first AI voice business operations platform powered by genuine Gnani AI Prisma v2.5 and Timbre v2.5 models.*

---

## 1. Overview
Over 63 million micro and small service businesses in India—motorcycle mechanics, electricians, plumbers, and repair workshops—run their operations verbally. **VaaniOps** transforms spoken Telugu, English, and Telugu-dominant mixed speech into validated business job cards, stores them in SQLite, and generates natural spoken Telugu audio confirmations.

### Key Capabilities:
- **Genuine Gnani AI Integration:**
  - **STT:** Gnani Prisma v2.5 (`https://api.vachana.ai/stt/v3`)
  - **TTS:** Gnani Timbre v2.5 (`https://api.vachana.ai/api/v1/tts/inference`)
- **Browser-Side Audio Resampling:** Web Audio API decodes audio and resamples to **16 kHz Mono 16-bit linear PCM WAV** before upload.
- **Deterministic Information Extraction:** Extracts Customer Name (using Telugu honorifics `garu`, `gari`), Vehicle/Asset, Service Type, Delivery Timeline, and Estimated Cost without hallucination.
- **Audible Telugu Confirmation:** Synthesizes voice order status using official voices (`Kaveri`, `Ananya`, `Chaitanya`, `Venu`) so business owners don't have to read tiny screens.
- **API Diagnostics:** Built-in diagnostics distinguishing missing keys, unauthorized credentials, credit exhaustion, and network outages without leaking secret keys.

---

## 2. Project Architecture

```
ops/
├── backend/
│   ├── app/
│   │   ├── config.py           # Pydantic settings & endpoints
│   │   ├── database.py         # SQLAlchemy SQLite engine & session
│   │   ├── models.py           # WorkOrder database model
│   │   ├── schemas.py          # Pydantic v2 schemas
│   │   ├── services/
│   │   │   ├── audio_service.py    # WAV header & 30s duration validation
│   │   │   ├── gnani_prisma.py     # Prisma v2.5 STT client
│   │   │   ├── gnani_timbre.py     # Timbre v2.5 TTS client
│   │   │   └── order_extractor.py  # Telugu/English entity extractor
│   │   └── routers/            # /health, /transcribe, /orders, /speak, /stats
│   ├── tests/                  # 32 pytest test cases
│   ├── Dockerfile              # Production container definition
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/         # Dashboard, VoiceWorkspace, OrdersView, SettingsView
│   │   ├── utils/              # audioRecorder.ts (Web Audio API 16kHz WAV converter)
│   │   ├── services/           # api.ts (FastAPI client)
│   │   ├── types/              # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docs/
│   ├── API_INTEGRATION.md      # Gnani API setup & error reference
│   ├── ARCHITECTURE.md         # In-depth system design & diagrams
│   ├── TEST_REPORT.md          # 32 automated test results
│   ├── DEMO_SCRIPT.md          # Live walkthrough demo script
│   └── TEAM_CONTRIBUTIONS.md   # Engineering responsibilities
├── render.yaml                 # Render blueprint with persistent disk
└── README.md
```

---

## 3. Local Setup Instructions

### Prerequisites
- **Python 3.12+**
- **Node.js 18+ & npm**
- **Gnani AI API Key** (from [vachana.ai](https://vachana.ai))

### A. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   pip install "starlette>=0.37.0,<1.0.0"
   ```
4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `backend/.env`:
   ```env
   GNANI_API_KEY=your_gnani_api_key_here
   DATABASE_URL=sqlite:///./vaaniops.db
   FRONTEND_ORIGIN=http://localhost:5173
   APP_ENV=development
   GNANI_TIMEOUT_SECONDS=60
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   FastAPI Docs: `http://localhost:8000/docs`  
   Health Check: `http://localhost:8000/api/health`

### B. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Verify `frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 4. Running Automated Tests

Run the complete backend test suite:
```bash
cd backend
.\venv\Scripts\python.exe -m pytest -v
```

All 32 tests execute in under 5 seconds:
- Audio header & duration boundary tests
- Telugu entity extraction tests
- Gnani Prisma v2.5 STT response parsing & error handling
- Gnani Timbre v2.5 TTS response parsing & voice catalog tests
- Order lifecycle, unique numbering, and status update tests
- Live integration tests safely skipped when credentials are not supplied

To verify the frontend TypeScript and production build:
```bash
cd frontend
npm run build
```

---

## 5. Deployment Guide

### Backend: Render
1. Push source repository to GitHub.
2. In Render, select **New Blueprint Instance** and point to `render.yaml`.
3. Alternatively, create a **Web Service** using `backend/Dockerfile`.
4. Configure Environment Variables:
   - `GNANI_API_KEY`: `<Your Gnani API Key>` (Secret)
   - `DATABASE_URL`: `sqlite:////app/data/vaaniops.db`
   - `FRONTEND_ORIGIN`: `https://your-app.vercel.app`
   - `APP_ENV`: `production`
   - `GNANI_TIMEOUT_SECONDS`: `60`
5. Attach a **Persistent Disk** mounted at `/app/data` (size: 1 GB) so the SQLite database is retained across redeployments.
6. Set health check path to `/api/health`.

### Frontend: Vercel
1. In Vercel, import the repository and set the root directory to `frontend`.
2. Framework Preset: **Vite**.
3. Set Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-render-backend-url.onrender.com`
4. Deploy! *(Note: Never add `GNANI_API_KEY` to Vercel variables; API keys reside exclusively on Render).*

---

## 6. Official Gnani Endpoint Reference
- **Prisma v2.5 (STT):** `POST https://api.vachana.ai/stt/v3`
- **Timbre v2.5 (TTS):** `POST https://api.vachana.ai/api/v1/tts/inference`
- **Voice Catalog:**
  - Telugu: `Kaveri`, `Ananya`, `Chaitanya`, `Venu`
  - English India: `Maya`, `Aarav`, `Pooja`, `Rohan`

---

## 7. Documentation Index
- [Architecture & System Design](docs/ARCHITECTURE.md)
- [API Integration & Diagnostics Guide](docs/API_INTEGRATION.md)
- [Automated Test Report](docs/TEST_REPORT.md)
- [Live Demonstration Script](docs/DEMO_SCRIPT.md)
- [Team Contributions](docs/TEAM_CONTRIBUTIONS.md)

---

## 8. License
Apache 2.0 / Proprietary — Built for submission before November 10, 2026.

