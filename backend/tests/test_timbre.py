import base64
from unittest.mock import patch
import httpx
import pytest
from app.config import settings


def test_timbre_missing_key(client, monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "")
    response = client.post(
        "/api/speak",
        json={"text": "Ravi gari order confirmed", "voice": "Kaveri", "language": "te-IN"},
    )
    assert response.status_code == 503
    assert "GNANI_API_KEY_MISSING" in response.text


def test_timbre_invalid_voice_for_language(client, monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "valid_key")
    response = client.post(
        "/api/speak",
        json={"text": "Hello", "voice": "UnknownVoice", "language": "te-IN"},
    )
    assert response.status_code == 400
    assert "not valid for language" in response.text


def test_timbre_success_binary_wav(client, monkeypatch, generate_wav):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "valid_key")
    raw_wav = generate_wav(duration_seconds=1.5)

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=200,
            content=raw_wav,
            headers={"Content-Type": "audio/wav"},
            request=httpx.Request("POST", settings.TIMBRE_ENDPOINT),
        )

        response = client.post(
            "/api/speak",
            json={"text": "రవి గారి సర్వీస్ ఆర్డర్ క్రియేట్ అయ్యింది.", "voice": "Kaveri", "language": "te-IN"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
        assert response.content == raw_wav


def test_timbre_success_json_base64(client, monkeypatch, generate_wav):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "valid_key")
    raw_wav = generate_wav(duration_seconds=1.0)
    b64_str = base64.b64encode(raw_wav).decode("utf-8")

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=200,
            json={"audio_content": b64_str, "status": "success"},
            headers={"Content-Type": "application/json"},
            request=httpx.Request("POST", settings.TIMBRE_ENDPOINT),
        )

        response = client.post(
            "/api/speak",
            json={"text": "Order confirmed.", "voice": "Maya", "language": "en-IN"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
        assert response.content == raw_wav

