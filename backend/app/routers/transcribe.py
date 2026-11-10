from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas import TranscribeResponse, ExtractedOrderInfo, ExtractRequest
from app.services.gnani_prisma import prisma_service
from app.services.order_extractor import order_extractor

router = APIRouter(tags=["voice"])


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(..., description="WAV audio recording (max 30s)"),
    language_code: str = Form("te-IN", description="Language code: te-IN or en-IN"),
):
    """
    Receives recorded mono WAV audio and transcribes using Gnani Prisma v2.5.
    """
    if not audio_file.filename or not audio_file.filename.lower().endswith(".wav"):
        if audio_file.content_type and "wav" not in audio_file.content_type.lower():
            raise HTTPException(
                status_code=400,
                detail="Uploaded file must be a WAV audio file (.wav). Other formats are not supported.",
            )

    audio_bytes = await audio_file.read()
    result = await prisma_service.transcribe(audio_bytes=audio_bytes, language_code=language_code)
    return TranscribeResponse(**result)


@router.post("/extract", response_model=ExtractedOrderInfo)
async def extract_business_info(request: ExtractRequest):
    """
    Extracts structured business work order fields from raw speech transcript.
    """
    extracted = order_extractor.extract(
        transcript=request.transcript,
        language_code=request.language_code or "te-IN",
    )
    return extracted

