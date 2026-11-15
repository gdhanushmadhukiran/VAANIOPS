from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas import TranscribeResponse, ExtractedOrderInfo, ExtractRequest
from app.services.audio_service import MAX_AUDIO_SIZE_BYTES
from app.services.gnani_prisma import prisma_service
from app.services.order_extractor import order_extractor

router = APIRouter(tags=["voice"])


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(..., description="WAV audio recording (max 30s, 10MB)"),
    language_code: str = Form("te-IN", description="Language code: te-IN or en-IN"),
):
    """Receive a bounded WAV upload and transcribe it using Gnani Prisma v2.5."""
    filename = (audio_file.filename or "").strip().lower()
    if not filename.endswith(".wav"):
        raise HTTPException(status_code=400, detail="Uploaded file must use the .wav extension.")

    # Read at most one byte beyond the configured limit so oversized uploads
    # are rejected before the complete file is buffered in application memory.
    audio_bytes = await audio_file.read(MAX_AUDIO_SIZE_BYTES + 1)
    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Audio upload exceeds the 10MB limit.")

    result = await prisma_service.transcribe(audio_bytes=audio_bytes, language_code=language_code)
    return TranscribeResponse(**result)


@router.post("/extract", response_model=ExtractedOrderInfo)
async def extract_business_info(request: ExtractRequest):
    """Extract structured business work-order fields from a transcript."""
    extracted = order_extractor.extract(
        transcript=request.transcript,
        language_code=request.language_code or "te-IN",
    )
    return extracted
