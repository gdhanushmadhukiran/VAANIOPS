import asyncio
import base64
import logging
from typing import Dict, Set
import httpx
from fastapi import HTTPException
from app.config import settings

logger = logging.getLogger(__name__)

# Official voice catalog per language
VOICE_CATALOG: Dict[str, Set[str]] = {
    "te-IN": {"Kaveri", "Ananya", "Chaitanya", "Venu"},
    "en-IN": {"Maya", "Aarav", "Pooja", "Rohan"},
}

DEFAULT_VOICE = {
    "te-IN": "Kaveri",
    "en-IN": "Maya",
}


class GnaniTimbreService:
    def __init__(self):
        self.endpoint = settings.TIMBRE_ENDPOINT
        self.timeout = settings.GNANI_TIMEOUT_SECONDS
        self._synthesis_lock = asyncio.Lock()

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

    def validate_voice(self, language: str, voice: str) -> str:
        lang_voices = VOICE_CATALOG.get(language)
        if not lang_voices:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language '{language}' for Timbre TTS. Supported: te-IN, en-IN.",
            )
        if voice not in lang_voices:
            valid_list = ", ".join(sorted(lang_voices))
            raise HTTPException(
                status_code=400,
                detail=f"Voice '{voice}' is not valid for language '{language}'. Available voices: {valid_list}",
            )
        return voice

    async def synthesize(
        self,
        text: str,
        voice: str = "Kaveri",
        language: str = "te-IN",
        speed: float = 1.0,
    ) -> bytes:
        """
        Synthesizes speech using Gnani Timbre v2.5.
        Prevents overlapping synthesis requests and supports both direct binary WAV
        and JSON-wrapped base64 responses.
        """
        cleaned_text = text.strip()
        if not cleaned_text:
            raise HTTPException(status_code=400, detail="Text to synthesize cannot be empty.")

        # Validate voice & language against official catalog
        self.validate_voice(language, voice)

        api_key = self._get_api_key()

        payload = {
            "text": cleaned_text,
            "voice": voice,
            "model": "timbre-v2.5",
            "language": language,
            "speed": max(0.5, min(2.0, speed)),
            "audio_config": {
                "encoding": "linear_pcm",
                "container": "wav",
                "num_channels": 1,
                "sample_rate": 48000,
                "sample_width": 2,
            },
        }

        headers = {
            "X-API-Key-ID": api_key,
            "Content-Type": "application/json",
        }

        # Prevent overlapping synthesis requests using lock
        async with self._synthesis_lock:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        self.endpoint,
                        headers=headers,
                        json=payload,
                    )

                if response.status_code == 401 or response.status_code == 403:
                    error_body = response.text
                    if "credit" in error_body.lower() or "quota" in error_body.lower():
                        raise HTTPException(
                            status_code=402,
                            detail={
                                "error": "GNANI_CREDITS_EXHAUSTED",
                                "message": "Gnani AI API credits exhausted or subscription inactive for Timbre.",
                                "raw": error_body,
                            },
                        )
                    raise HTTPException(
                        status_code=401,
                        detail={
                            "error": "GNANI_AUTH_FAILED",
                            "message": "Invalid Gnani API key or unauthorized access to Timbre TTS.",
                            "raw": error_body,
                        },
                    )
                elif response.status_code == 400:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "error": "GNANI_TIMBRE_BAD_REQUEST",
                            "message": f"Gnani Timbre rejected synthesis request: {response.text}",
                        },
                    )
                elif response.status_code == 429:
                    raise HTTPException(
                        status_code=429,
                        detail={
                            "error": "GNANI_RATE_LIMIT",
                            "message": "Gnani Timbre rate limit reached. Please wait a moment.",
                        },
                    )
                elif response.status_code >= 500:
                    raise HTTPException(
                        status_code=503,
                        detail={
                            "error": "GNANI_SERVICE_UNAVAILABLE",
                            "message": f"Gnani Timbre service returned server error ({response.status_code}).",
                        },
                    )
                elif response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail={
                            "error": "GNANI_TIMBRE_ERROR",
                            "message": f"Gnani Timbre synthesis failed ({response.status_code}): {response.text}",
                        },
                    )

                content_type = response.headers.get("content-type", "").lower()

                # Case A: Directly returned audio/wav or binary stream
                if "audio" in content_type or "octet-stream" in content_type or response.content.startswith(b"RIFF"):
                    return response.content

                # Case B: JSON returned with base64 encoded audio
                try:
                    resp_json = response.json()
                    b64_audio = (
                        resp_json.get("audio_content")
                        or resp_json.get("audio")
                        or resp_json.get("audio_base64")
                        or resp_json.get("audioContent")
                        or resp_json.get("data")
                    )

                    if isinstance(b64_audio, dict):
                        b64_audio = b64_audio.get("audio") or b64_audio.get("audio_content")

                    if b64_audio and isinstance(b64_audio, str):
                        wav_bytes = base64.b64decode(b64_audio)
                        return wav_bytes
                except Exception as json_err:
                    logger.warning("Could not parse JSON audio from Timbre response: %s", str(json_err))

                # If binary response was returned without explicit audio content type
                if response.content.startswith(b"RIFF"):
                    return response.content

                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "UNRECOGNIZED_AUDIO_PAYLOAD",
                        "message": "Gnani Timbre returned an unrecognized payload format without valid WAV audio.",
                    },
                )

            except httpx.ConnectError:
                raise HTTPException(
                    status_code=503,
                    detail={
                        "error": "GNANI_UNREACHABLE",
                        "message": "Could not connect to Gnani Timbre API endpoint. Check internet connection.",
                    },
                )
            except httpx.TimeoutException:
                raise HTTPException(
                    status_code=504,
                    detail={
                        "error": "GNANI_TIMEOUT",
                        "message": f"Gnani Timbre request timed out after {self.timeout}s.",
                    },
                )


timbre_service = GnaniTimbreService()

