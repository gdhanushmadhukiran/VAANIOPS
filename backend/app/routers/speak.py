from fastapi import APIRouter, Response
from app.schemas import TTSRequest
from app.services.gnani_timbre import timbre_service

router = APIRouter(tags=["voice"])


@router.post("/speak")
async def generate_spoken_audio(request: TTSRequest):
    """
    Synthesizes text into spoken Telugu or English audio using Gnani Timbre v2.5.
    Returns playable audio/wav.
    """
    audio_bytes = await timbre_service.synthesize(
        text=request.text,
        voice=request.voice or "Kaveri",
        language=request.language or "te-IN",
        speed=request.speed or 1.0,
    )

    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": "inline; filename=confirmation.wav",
            "Cache-Control": "no-cache",
        },
    )

