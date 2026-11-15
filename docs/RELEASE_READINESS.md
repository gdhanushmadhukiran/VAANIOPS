# VaaniOps — Release Readiness & Known Limitations

**Reviewed:** 15 November 2026  
**Production frontend:** https://vaaniops.vercel.app  
**Production API:** https://vaaniops-backend.onrender.com

## Verified capabilities reported by the project team

- Vercel frontend and Render FastAPI backend are reachable.
- Frontend-to-backend CORS preflight was verified.
- Gnani Prisma v2.5 transcription and Timbre v2.5 speech synthesis were exercised against production endpoints.
- Work-order create, retrieve, and status-update operations were exercised.
- The frontend bundle was checked for backend provider credentials.
- Evon v3.3 is not provisioned for the current Gnani API key and must remain clearly marked as unavailable/standby.

These are team-reported acceptance results. Re-run the automated test suite and inspect the latest hosting deployment after every release commit.

## Corrections included in the 15 Nov hardening pass

1. Evon is disabled by default. It must be explicitly enabled only after a working, authenticated vLLM endpoint is configured.
2. Rule-based extraction and multi-turn flows now identify their provider as "local-rule-engine"; they no longer claim Evon v3.3 inference or fabricate a fixed latency.
3. Audio uploads are restricted to ".wav" filenames and read with a 10 MB upper bound before forwarding to Prisma.
4. The Render Blueprint now specifies the actual Vercel origin instead of a wildcard CORS origin.
5. Diagnostics no longer return even a masked fragment of the Gnani API key. The Settings screen displays only whether a key is configured.
6. Regression tests were added for invalid audio extensions, oversized uploads, truthful provider attribution, and credential redaction.

## Release blockers before real customer data or commercial use

### P0 — Authentication and tenant isolation are not implemented

The current API exposes work orders, conversations, operational analytics, and order mutations without user authentication or tenant scoping. Anyone who can reach the public API may be able to read or modify demo records.

**Required before real customer use:** implement an identity provider, authenticated API authorization, per-business tenant IDs on every business record, and server-side authorization checks on every read/write route. Do not put a shared privileged API key in the Vite frontend.

**Submission/demo safeguard:** use synthetic demonstration records only. Do not enter real customer names, phone numbers, addresses, vehicle identifiers, or other personal/business-confidential information.

### P1 — Evon v3.3 is not live

The current Gnani key has no Evon LLM scope. The deployed application currently uses local deterministic extraction and conversation rules. Evon GPU serving has a deployment package, but a real GPU pod and successful inference have not been verified.

Do not describe the product as having active Evon reasoning until a live inference request succeeds and its provider/latency metadata is returned from that request.

### P1 — Database evolution and operational scale

The application initializes tables with SQLAlchemy create_all; this is not a schema migration strategy. SQLite on a Render persistent disk is suitable for a small single-instance demo, not a multi-tenant/high-concurrency production workload.

Before scaling: add Alembic migrations, automated backups/restore tests, database health checks, and migrate to managed PostgreSQL with tenant-aware constraints.

### P2 — Operational hardening

- Add API rate limiting and abuse protection to public routes.
- Add structured request IDs and privacy-safe logs; avoid logging raw transcripts or provider payloads containing customer data.
- Add retention/deletion controls for stored transcripts and conversation history.
- Add CI that runs backend tests and frontend type-check/build on every pull request.
- Add browser-level end-to-end tests for microphone capture, playback, and order confirmation.

## Submission checklist

- [ ] Confirm latest Render deploy is live and /api/health returns healthy.
- [ ] Confirm latest Vercel deployment is ready and the production bundle points to the Render API.
- [ ] Run python -m pytest -q from backend/.
- [ ] Run npm ci && npm run build from frontend/.
- [ ] Test one synthetic Telugu voice order end-to-end.
- [ ] Test one synthetic English voice order end-to-end.
- [ ] Confirm the saved order appears in Orders and survives a backend restart.
- [ ] Confirm Evon is shown as pending/standby, not connected.
- [ ] Use synthetic data only in the public demo until authentication and tenant isolation are implemented.
- [ ] Capture a short screen recording and include repository, live URL, architecture, test results, and known limitations in the submission.

## Accurate project status

VaaniOps is a deployed working prototype with verified speech-service integrations and core work-order flows. It is **not yet safe for real customer data or commercial production** until authentication/tenant isolation, database migration/backup strategy, and Evon deployment are completed.
