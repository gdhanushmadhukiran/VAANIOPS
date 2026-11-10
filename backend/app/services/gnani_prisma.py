import logging
from typing import Dict, Any
import httpx
from fastapi import HTTPException
from app.config import settings
from app.services.audio_service import validate_wav_audio, AudioValidationError

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {"te-IN", "en-IN"}


class GnaniPrismaService:
    def __init__(self):
        self.endpoint = settings.PRISMA_ENDPOINT
        self.timeout = settings.GNANI_TIMEOUT_SECONDS

    def _get_api_key(self) -> str:
        api_key = settings.GNANI_API_KEY.strip()
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "GNANI_API_KEY_MISSING",
                    "message": "Gnani API key is not configured in backend environment. Please set GNANI_API_KEY.",
                },
            )
        return api_key

    async def transcribe(self, audio_bytes: bytes, language_code: str = "te-IN") -> Dict[str, Any]:
        """
        Transcribes WAV audio using Gnani Prisma v2.5 via official endpoint.
        """
        # 1. Validate language code
        if language_code not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language code '{language_code}'. Prisma v2.5 requires 'te-IN' or 'en-IN'.",
            )

        # 2. Validate audio WAV format, size and duration <= 30s
        try:
            duration, sample_rate, channels = validate_wav_audio(audio_bytes)
        except AudioValidationError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message)

        # 3. Retrieve API key
        api_key = self._get_api_key()

        # 4. Prepare request
        headers = {
            "X-API-Key-ID": api_key,
        }
        files = {
            "audio_file": ("recording.wav", audio_bytes, "audio/wav"),
        }
        data = {
            "language_code": language_code,
        }

        # 5. Execute request with HTTPX
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.endpoint,
                    headers=headers,
                    files=files,
                    data=data,
                )

            # 6. Handle response status codes
            if response.status_code == 401 or response.status_code == 403:
                error_body = response.text
                if "credit" in error_body.lower() or "quota" in error_body.lower() or "balance" in error_body.lower():
                    raise HTTPException(
                        status_code=402,
                        detail={
                            "error": "GNANI_CREDITS_EXHAUSTED",
                            "message": "Gnani AI API credits exhausted or subscription inactive for this key.",
                            "raw": error_body,
                        },
                    )
                raise HTTPException(
                    status_code=401,
                    detail={
                        "error": "GNANI_AUTH_FAILED",
                        "message": "Invalid Gnani API key or unauthorized access. Verify your GNANI_API_KEY.",
                        "raw": error_body,
                    },
                )
            elif response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "GNANI_RATE_LIMIT",
                        "message": "Gnani API rate limit reached. Please wait a moment before trying again.",
                    },
                )
            elif response.status_code >= 500:
                raise HTTPException(
                    status_code=503,
                    detail={
                        "error": "GNANI_SERVICE_UNAVAILABLE",
                        "message": f"Gnani Prisma service returned error ({response.status_code}). API may be temporarily unavailable.",
                    },
                )
            elif response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail={
                        "error": "GNANI_PRISMA_ERROR",
                        "message": f"Gnani Prisma request failed with status {response.status_code}: {response.text}",
                    },
                )

            # 7. Parse successful JSON response
            resp_json = response.json()
            logger.info("Gnani Prisma response received: %s", resp_json)

            # Expected fields: transcript (or text/transcription), request_id, model
            transcript = (
                resp_json.get("transcript")
                or resp_json.get("text")
                or resp_json.get("transcription")
                or (resp_json.get("data", {}).get("transcript") if isinstance(resp_json.get("data"), dict) else "")
                or ""
            )

            request_id = resp_json.get("request_id") or resp_json.get("id") or resp_json.get("req_id")
            model = resp_json.get("model", "prisma-v2.5")

            return {
                "success": True,
                "request_id": request_id,
                "transcript": transcript.strip(),
                "model": model,
                "language_code": language_code,
            }

        except httpx.ConnectError as e:
            logger.error("Connection error reaching Gnani Prisma: %s", str(e))
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "GNANI_UNREACHABLE",
                    "message": "Could not connect to Gnani Prisma API endpoint. Please check your network or Gnani status.",
                },
            )
        except httpx.TimeoutException:
            logger.error("Gnani Prisma request timed out after %s seconds", self.timeout)
            raise HTTPException(
                status_code=504,
                detail={
                    "error": "GNANI_TIMEOUT",
                    "message": f"Gnani Prisma request timed out after {self.timeout}s.",
                },
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error in Gnani Prisma transcription: %s", str(e))
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "PRISMA_INTERNAL_ERROR",
                    "message": f"Unexpected error during transcription: {str(e)}",
                },
            )


prisma_service = GnaniPrismaService()

