import io
import wave
from typing import Tuple

MAX_AUDIO_DURATION_SECONDS = 30.0
MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class AudioValidationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def validate_wav_audio(audio_bytes: bytes) -> Tuple[float, int, int]:
    """
    Validates WAV audio bytes:
    1. Non-empty and under size limit
    2. Valid RIFF/WAVE header and format structure
    3. Duration <= 30 seconds
    
    Returns:
        (duration_seconds, sample_rate, channels)
    """
    if not audio_bytes:
        raise AudioValidationError("Audio file is empty. Please record audio before uploading.")

    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise AudioValidationError(
            f"Audio file size ({len(audio_bytes) / (1024*1024):.2f}MB) exceeds maximum limit of 10MB."
        )

    # Basic magic number check for RIFF header
    if len(audio_bytes) < 44 or not audio_bytes.startswith(b"RIFF") or audio_bytes[8:12] != b"WAVE":
        raise AudioValidationError("Invalid audio format: File must be a valid RIFF/WAVE audio file.")

    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
            channels = wav_file.getnchannels()
            sample_rate = wav_file.getframerate()
            sample_width = wav_file.getsampwidth()
            num_frames = wav_file.getnframes()

            if sample_rate <= 0:
                raise AudioValidationError("Invalid WAV audio: sample rate must be greater than 0.")

            duration = num_frames / float(sample_rate)

            if duration > MAX_AUDIO_DURATION_SECONDS + 0.1:  # small tolerance for buffer boundaries
                raise AudioValidationError(
                    f"Audio duration ({duration:.2f} seconds) exceeds the maximum 30-second limit."
                )

            return duration, sample_rate, channels
    except AudioValidationError:
        raise
    except Exception as e:
        raise AudioValidationError(f"Could not parse WAV audio: {str(e)}")

