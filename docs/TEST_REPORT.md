# VaaniOps — Comprehensive Test Report

## 1. Test Suite Summary
- **Test Framework:** pytest 9.2.0 + pytest-asyncio 1.4.1
- **Platform:** Windows / Python 3.12.10
- **Total Tests:** 32
- **Passed:** 31
- **Skipped:** 1 (Live credit-consuming integration test; executes only when `GNANI_API_KEY` is provided)
- **Failures:** 0
- **Duration:** 4.71s

---

## 2. Unit & Service Test Results

### A. Audio Service Tests (`tests/test_audio.py`)
| Test Case | Description | Result |
|-----------|-------------|--------|
| `test_valid_wav_audio` | Verifies in-memory 16kHz mono WAV header and frame duration | **PASSED** |
| `test_empty_audio_raises_error` | Verifies 0-byte upload is rejected with 400 validation error | **PASSED** |
| `test_invalid_header_raises_error` | Verifies non-WAV data is rejected | **PASSED** |
| `test_audio_exceeding_30_seconds_rejected` | Verifies 32s audio triggers duration boundary rejection | **PASSED** |
| `test_oversized_audio_rejected` | Verifies >10MB upload is rejected | **PASSED** |

### B. Business Information Extraction Tests (`tests/test_extractor.py`)
| Test Case | Description | Result |
|-----------|-------------|--------|
| `test_telugu_dominant_workshop_example` | Tests `"Ravi garu bike repair kosam icharu. Brake pads change cheyyali. Repu evening delivery."` | **PASSED** |
| `test_missing_customer_name_remains_none` | Verifies missing customer remains `None` without hallucination | **PASSED** |
| `test_cost_extraction` | Extracts `1500.0` from `"Total 1500 rupees cost estimate"` | **PASSED** |
| `test_electrician_service_extraction` | Tests fan wiring and switchboard repair extraction | **PASSED** |
| `test_empty_transcript_handling` | Returns empty schema with `requires_confirmation: True` | **PASSED** |

### C. Health & Gnani Diagnostics Tests (`tests/test_health.py`)
| Test Case | Description | Result |
|-----------|-------------|--------|
| `test_health_endpoint` | Verifies `/api/health` returns status `healthy` and service name | **PASSED** |
| `test_gnani_health_missing_key` | Verifies `/api/health/gnani` returns `no_key` when key is empty | **PASSED** |
| `test_gnani_health_configured_ready` | Verifies probe response parsing and key masking (`gn_...345`) | **PASSED** |
| `test_gnani_health_unauthorized` | Verifies invalid key is classified as `unauthorized` | **PASSED** |

### D. Gnani Prisma v2.5 STT Tests (`tests/test_prisma.py`)
| Test Case | Description | Result |
|-----------|-------------|--------|
| `test_transcribe_missing_api_key` | Returns HTTP 503 with `GNANI_API_KEY_MISSING` | **PASSED** |
| `test_transcribe_unsupported_language` | Rejects comma-separated lists (`te-IN,en-IN`) with HTTP 400 | **PASSED** |
| `test_transcribe_success_mocked` | Parses real Gnani JSON response: transcript, request_id, model | **PASSED** |
| `test_transcribe_credits_exhausted` | Maps credit exhaustion error to HTTP 402 `GNANI_CREDITS_EXHAUSTED` | **PASSED** |
| `test_transcribe_service_unavailable` | Maps upstream 503 to HTTP 503 `GNANI_SERVICE_UNAVAILABLE` | **PASSED** |

### E. Gnani Timbre v2.5 TTS Tests (`tests/test_timbre.py`)
| Test Case | Description | Result |
|-----------|-------------|--------|
| `test_timbre_missing_key` | Returns HTTP 503 with configuration error | **PASSED** |
| `test_timbre_invalid_voice_for_language` | Validates voice against catalog (`UnknownVoice` rejected with 400) | **PASSED** |
| `test_timbre_success_binary_wav` | Verifies direct binary `audio/wav` stream returned | **PASSED** |
| `test_timbre_success_json_base64` | Verifies JSON base64-encoded audio is decoded to valid WAV | **PASSED** |

### F. Work Order Lifecycle Tests (`tests/test_orders.py`)
| Test Case | Description | Result |
|-----------|-------------|--------|
| `test_create_work_order_success` | Creates order in SQLite with unique `VO-YYYYMMDD-XXXX` ID | **PASSED** |
| `test_create_work_order_missing_customer_name` | Rejects order without customer name with HTTP 422 | **PASSED** |
| `test_create_work_order_missing_service_type` | Rejects order without service type with HTTP 422 | **PASSED** |
| `test_unique_order_numbers` | Verifies consecutive orders receive distinct order numbers | **PASSED** |
| `test_list_and_filter_orders` | Queries orders by status and customer search query | **PASSED** |
| `test_update_order_status` | Updates status (`pending` -> `in_progress`); rejects invalid status | **PASSED** |
| `test_get_non_existent_order` | Returns HTTP 404 for missing order ID | **PASSED** |
| `test_stats_endpoint` | Verifies aggregated dashboard metrics reflect stored jobs | **PASSED** |

### G. Live Integration Tests (`tests/test_integration.py`)
| Test Case | Description | Result |
|-----------|-------------|--------|
| `test_live_gnani_timbre_synthesis` | Live synthesis against `api.vachana.ai` | **SKIPPED** (Safely skipped to protect credits during CI/unit testing) |

---

## 3. Frontend Production Build Verification
- **Command:** `npm.cmd run build` (tsc && vite build)
- **Status:** **PASSED (0 errors, 0 warnings)**
- **Output Artifacts:**
  - `dist/index.html` (1.13 kB)
  - `dist/assets/index-BmZnxEcV.css` (32.96 kB / gzip: 5.96 kB)
  - `dist/assets/index-CIqpocv5.js` (224.02 kB / gzip: 63.77 kB)

---

## 4. Manual End-to-End Workflow Verification Steps

1. **Launch Environment:** Start FastAPI on port 8000 and Vite dev server on port 5173.
2. **Access Dashboard:** Verify real-time metrics load (Total, Pending, Completed, Today's orders).
3. **Select Voice Workspace:** Navigate to Voice Workspace; verify `te-IN` is selected.
4. **Record Audio:**
   - Click the microphone button.
   - Speak: `"Ravi garu bike repair kosam icharu. Brake pads change cheyyali. Repu evening delivery."`
   - Observe real-time recording timer enforcing the 30-second boundary.
   - Click stop recording.
5. **Verify Audio Conversion:** Web Audio API resamples to 16 kHz mono 16-bit PCM WAV; audio preview player plays the converted WAV.
6. **Verify Transcription:** Transcript displays recognized speech with `prisma-v2.5` model badge and request ID.
7. **Verify Extraction:**
   - Customer: `Ravi`
   - Asset: `Bike`
   - Service: `Brake pad replacement`
   - Delivery Date: `Tomorrow`
   - Delivery Time: `evening`
8. **Edit Information:** User can adjust or enrich any field before confirming.
9. **Confirm Order:** Click "Confirm & Save Work Order". Unique order number (e.g. `VO-20261109-7412`) is generated and persisted in SQLite.
10. **Verify Spoken Confirmation:** Click "Play Telugu Confirmation". Timbre v2.5 synthesizes: `"రవి గారి బ్రేక్ ప్యాడ్స్ రీప్లేస్‌మెంట్ సర్వీస్ ఆర్డర్ క్రియేట్ అయ్యింది. డెలివరీ రేపు."` and plays via the browser speaker.
11. **Verify Orders Manager:** Order appears in All Orders table; status can be updated to `in_progress` or `completed`.

