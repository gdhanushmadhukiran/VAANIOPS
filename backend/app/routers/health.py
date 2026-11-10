from datetime import datetime, timezone
import httpx
from fastapi import APIRouter
from app.config import settings
from app.schemas import GnaniHealthResponse, GnaniServiceStatus
from app.services.gnani_evon import evon_service

router = APIRouter(tags=["health"])


def _mask_api_key(key: str) -> str:
    if not key:
        return "None"
    clean = key.strip()
    if len(clean) <= 6:
        return "***"
    return f"{clean[:3]}...{clean[-3:]}"


@router.get("/health")
def get_health():
    return {
        "status": "healthy",
        "service": "VaaniOps Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": settings.APP_ENV,
    }


@router.get("/health/gnani", response_model=GnaniHealthResponse)
async def check_gnani_health():
    api_key = settings.GNANI_API_KEY.strip()
    is_configured = bool(api_key)

    if not is_configured:
        return GnaniHealthResponse(
            status="KEY_MISSING",
            api_key_configured=False,
            key_status="KEY_MISSING",
            api_key_preview=None,
            prisma_status=GnaniServiceStatus(
                configured=False,
                status="KEY_MISSING",
                endpoint=settings.PRISMA_ENDPOINT,
                details="GNANI_API_KEY environment variable is empty. Add key to backend/.env",
            ),
            timbre_status=GnaniServiceStatus(
                configured=False,
                status="KEY_MISSING",
                endpoint=settings.TIMBRE_ENDPOINT,
                details="GNANI_API_KEY environment variable is empty. Add key to backend/.env",
            ),
            evon_status=GnaniServiceStatus(
                configured=False,
                status="KEY_MISSING",
                endpoint=settings.EVON_BASE_URL,
                details="GNANI_API_KEY / EVON_API_KEY environment variable is empty.",
            ),
            message="Gnani AI API key is not configured. Key status: KEY_MISSING.",
        )

    # Key is configured (KEY_PRESENT). Probe official endpoints to verify actual authentication.
    # We do NOT report CONNECTED or AUTHENTICATION_SUCCESS merely because key is present.
    headers = {"X-API-Key-ID": api_key}
    timeout = min(5.0, settings.GNANI_TIMEOUT_SECONDS)

    prisma_status = "UNKNOWN"
    prisma_details = ""
    timbre_status = "UNKNOWN"
    timbre_details = ""

    # Probe Prisma endpoint
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(
                settings.PRISMA_ENDPOINT,
                headers=headers,
                files={"audio_file": ("probe.wav", b"", "audio/wav")},
                data={"language_code": "te-IN"},
            )
            if res.status_code in {401, 403}:
                body = res.text.lower()
                if "credit" in body or "quota" in body:
                    prisma_status = "CREDITS_EXHAUSTED"
                    prisma_details = "Credits exhausted or account subscription inactive."
                else:
                    prisma_status = "AUTHENTICATION_FAILED"
                    prisma_details = "Invalid API key or account not authorized for Prisma v2.5."
            elif res.status_code in {200, 400, 422}:
                # The auth succeeded past headers, reached parameter validation
                prisma_status = "AUTHENTICATION_SUCCESS"
                prisma_details = "Prisma v2.5 authenticated successfully and accepting requests."
            elif res.status_code >= 500:
                prisma_status = "SERVICE_UNAVAILABLE"
                prisma_details = f"Prisma returned status {res.status_code}. Service may be under maintenance."
            else:
                prisma_status = f"HTTP_{res.status_code}"
                prisma_details = f"Unexpected response code: {res.status_code}"
    except httpx.ConnectError:
        prisma_status = "UNREACHABLE"
        prisma_details = "Could not connect to api.vachana.ai (network or DNS resolution issue)."
    except httpx.TimeoutException:
        prisma_status = "TIMEOUT"
        prisma_details = f"Diagnostic probe timed out after {timeout}s."
    except Exception as e:
        prisma_status = "ERROR"
        prisma_details = str(e)

    # Probe Timbre endpoint
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(
                settings.TIMBRE_ENDPOINT,
                headers=headers,
                json={"probe": True},  # will hit auth check before input validation
            )
            if res.status_code in {401, 403}:
                body = res.text.lower()
                if "credit" in body or "quota" in body:
                    timbre_status = "CREDITS_EXHAUSTED"
                    timbre_details = "Credits exhausted or account subscription inactive."
                else:
                    timbre_status = "AUTHENTICATION_FAILED"
                    timbre_details = "Invalid API key or account not authorized for Timbre v2.5."
            elif res.status_code in {200, 400, 422}:
                # The auth succeeded past headers, rejected missing fields
                timbre_status = "AUTHENTICATION_SUCCESS"
                timbre_details = "Timbre v2.5 authenticated successfully and accepting synthesis jobs."
            elif res.status_code >= 500:
                timbre_status = "SERVICE_UNAVAILABLE"
                timbre_details = f"Timbre returned status {res.status_code}."
            else:
                timbre_status = f"HTTP_{res.status_code}"
                timbre_details = f"Response code: {res.status_code}"
    except httpx.ConnectError:
        timbre_status = "UNREACHABLE"
        timbre_details = "Could not connect to Timbre endpoint."
    except httpx.TimeoutException:
        timbre_status = "TIMEOUT"
        timbre_details = f"Diagnostic probe timed out after {timeout}s."
    except Exception as e:
        timbre_status = "ERROR"
        timbre_details = str(e)

    # Probe Evon v3.3 endpoint
    evon_health = await evon_service.check_health()
    evon_status = GnaniServiceStatus(
        configured=evon_health.get("configured", False),
        status=evon_health.get("status", "UNKNOWN"),
        endpoint=evon_health.get("endpoint", settings.EVON_BASE_URL),
        details=evon_health.get("details"),
    )

    if prisma_status == "AUTHENTICATION_SUCCESS" and timbre_status == "AUTHENTICATION_SUCCESS":
        overall_status = "AUTHENTICATION_SUCCESS"
    elif prisma_status == "AUTHENTICATION_FAILED" or timbre_status == "AUTHENTICATION_FAILED":
        overall_status = "AUTHENTICATION_FAILED"
    elif prisma_status == "UNREACHABLE" or timbre_status == "UNREACHABLE":
        overall_status = "UNREACHABLE"
    elif prisma_status == "AUTHENTICATION_SUCCESS" or timbre_status == "AUTHENTICATION_SUCCESS":
        overall_status = "PARTIALLY_AUTHENTICATED"
    else:
        overall_status = "KEY_PRESENT"

    return GnaniHealthResponse(
        status=overall_status,
        api_key_configured=True,
        key_status="KEY_PRESENT",
        api_key_preview=_mask_api_key(api_key),
        prisma_status=GnaniServiceStatus(
            configured=True,
            status=prisma_status,
            endpoint=settings.PRISMA_ENDPOINT,
            details=prisma_details,
        ),
        timbre_status=GnaniServiceStatus(
            configured=True,
            status=timbre_status,
            endpoint=settings.TIMBRE_ENDPOINT,
            details=timbre_details,
        ),
        evon_status=evon_status,
        message=f"Key status: KEY_PRESENT. Diagnostic probes - Prisma: {prisma_status}, Timbre: {timbre_status}, Evon: {evon_status.status}.",
    )

