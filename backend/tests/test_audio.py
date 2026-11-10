import pytest
from app.services.audio_service import validate_wav_audio, AudioValidationError


def test_valid_wav_audio(generate_wav):
    audio_bytes = generate_wav(duration_seconds=5.0, sample_rate=16000)
    duration, sample_rate, channels = validate_wav_audio(audio_bytes)
    assert 4.9 <= duration <= 5.1
    assert sample_rate == 16000
    assert channels == 1


def test_empty_audio_raises_error():
    with pytest.raises(AudioValidationError) as exc:
        validate_wav_audio(b"")
    assert "empty" in exc.value.message.lower()


def test_invalid_header_raises_error():
    with pytest.raises(AudioValidationError) as exc:
        validate_wav_audio(b"ID3\x03\x00\x00\x00not a wav file header content at all")
    assert "invalid audio format" in exc.value.message.lower()


def test_audio_exceeding_30_seconds_rejected(generate_wav):
    # 32 seconds audio
    long_audio = generate_wav(duration_seconds=32.0, sample_rate=16000)
    with pytest.raises(AudioValidationError) as exc:
        validate_wav_audio(long_audio)
    assert "exceeds the maximum 30-second limit" in exc.value.message


def test_oversized_audio_rejected():
    oversized = b"RIFF" + (b"\x00" * (11 * 1024 * 1024))
    with pytest.raises(AudioValidationError) as exc:
        validate_wav_audio(oversized)
    assert "exceeds maximum limit" in exc.value.message

