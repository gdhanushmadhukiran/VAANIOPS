from unittest.mock import patch
import httpx
import pytest
from app.config import settings


def test_transcribe_missing_api_key(client, monkeypatch, generate_wav):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "")
    wav_bytes = generate_wav(duration_seconds=2.0)

    response = client.post(
        "/api/transcribe",
        files={"audio_file": ("test.wav", wav_bytes, "audio/wav")},
        data={"language_code": "te-IN"},
    )
    assert response.status_code == 503
    assert "GNANI_API_KEY_MISSING" in response.text


def test_transcribe_unsupported_language(client, monkeypatch, generate_wav):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "dummy_key")
    wav_bytes = generate_wav(duration_seconds=1.0)

    response = client.post(
        "/api/transcribe",
        files={"audio_file": ("test.wav", wav_bytes, "audio/wav")},
        data={"language_code": "te-IN,en-IN"},  # Comma-separated not supported on v2.5
    )
    assert response.status_code == 400
    assert "Unsupported language code" in response.text


def test_transcribe_success_mocked(client, monkeypatch, generate_wav):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "valid_test_key")
    wav_bytes = generate_wav(duration_seconds=3.0)

    mock_prisma_payload = {
        "success": True,
        "request_id": "gnani-req-987654",
        "transcript": "రవి గారు బైక్ రిపేర్ కోసం ఇచ్చారు",
        "model": "prisma-v2.5",
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=200,
            json=mock_prisma_payload,
            request=httpx.Request("POST", settings.PRISMA_ENDPOINT),
        )

        response = client.post(
            "/api/transcribe",
            files={"audio_file": ("audio.wav", wav_bytes, "audio/wav")},
            data={"language_code": "te-IN"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["request_id"] == "gnani-req-987654"
        assert data["transcript"] == "రవి గారు బైక్ రిపేర్ కోసం ఇచ్చారు"
        assert data["model"] == "prisma-v2.5"
        assert data["language_code"] == "te-IN"


def test_transcribe_credits_exhausted(client, monkeypatch, generate_wav):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "valid_key_no_credits")
    wav_bytes = generate_wav(duration_seconds=2.0)

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=403,
            text="User quota exceeded or insufficient credits",
            request=httpx.Request("POST", settings.PRISMA_ENDPOINT),
        )

        response = client.post(
            "/api/transcribe",
            files={"audio_file": ("audio.wav", wav_bytes, "audio/wav")},
            data={"language_code": "te-IN"},
        )
        assert response.status_code == 402
        assert "GNANI_CREDITS_EXHAUSTED" in response.text


def test_transcribe_service_unavailable(client, monkeypatch, generate_wav):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "test_key")
    wav_bytes = generate_wav(duration_seconds=2.0)

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=503,
            text="Backend cluster down",
            request=httpx.Request("POST", settings.PRISMA_ENDPOINT),
        )

        response = client.post(
            "/api/transcribe",
            files={"audio_file": ("audio.wav", wav_bytes, "audio/wav")},
            data={"language_code": "te-IN"},
        )
        assert response.status_code == 503
        assert "GNANI_SERVICE_UNAVAILABLE" in response.text

