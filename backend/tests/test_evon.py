import pytest
from unittest.mock import patch, AsyncMock
import httpx
from fastapi import HTTPException

from app.config import settings
from app.services.gnani_evon import GnaniEvonService


@pytest.mark.asyncio
async def test_evon_health_missing_key(monkeypatch):
    monkeypatch.setattr(settings, "EVON_API_KEY", "")
    monkeypatch.setattr(settings, "GNANI_API_KEY", "")
    service = GnaniEvonService()
    res = await service.check_health()
    assert res["status"] == "KEY_MISSING"
    assert res["configured"] is False


@pytest.mark.asyncio
async def test_evon_health_connected(monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "test_key_123")
    service = GnaniEvonService()

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(status_code=200, json={"choices": []})
        res = await service.check_health()
        assert res["status"] in {"INFERENCE_SUCCESSFUL", "CONNECTED"}
        assert res["configured"] is True
        assert res["latency_ms"] is not None


@pytest.mark.asyncio
async def test_evon_health_model_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "test_key_123")
    service = GnaniEvonService()

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Connection refused")), \
         patch("httpx.AsyncClient.get", side_effect=httpx.ConnectError("Connection refused")):
        res = await service.check_health()
        assert res["status"] in {"MODEL_UNAVAILABLE", "UNREACHABLE"}


@pytest.mark.asyncio
async def test_evon_health_never_connected_without_inference(monkeypatch):
    """
    Phase 7 requirement:
    Never mark Evon CONNECTED just because the GPU server responds to HTTP.
    Perform an actual inference request before reporting successful model operation.
    """
    monkeypatch.setattr(settings, "GNANI_API_KEY", "test_key_123")
    service = GnaniEvonService()

    # Suppose base HTTP returns 200, but POST /chat/completions fails (e.g. 500 CUDA OOM)
    with patch("httpx.AsyncClient.get") as mock_get, patch("httpx.AsyncClient.post") as mock_post:
        mock_get.return_value = httpx.Response(status_code=200, json={"data": [{"id": "model"}]})
        mock_post.return_value = httpx.Response(status_code=500, text="CUDA out of memory")

        res = await service.check_health()
        assert res["status"] != "INFERENCE_SUCCESSFUL"
        assert res["status"] != "CONNECTED"
        assert res["status"] in {"MODEL_LOADED", "INFERENCE_FAILED", "GPU_SERVER_AVAILABLE"}


@pytest.mark.asyncio
async def test_evon_health_scope_not_allowed(monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "test_key_123")
    service = GnaniEvonService()

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=403,
            text='{"detail":{"error_code":"SCOPE_NOT_ALLOWED","message":"Service \'None\' not in allowed scopes"}}',
        )
        res = await service.check_health()
        assert res["status"] == "SCOPE_NOT_ALLOWED"
        assert "allowed scopes" in res["details"].lower()


@pytest.mark.asyncio
async def test_evon_health_auth_failed(monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "invalid_key")
    service = GnaniEvonService()

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(status_code=401, text="Unauthorized")
        res = await service.check_health()
        assert res["status"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_evon_chat_completion_success(monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "valid_key")
    service = GnaniEvonService()

    mock_resp = {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "choices": [{"message": {"role": "assistant", "content": "Namaskaram! How can I help?"}}],
        "usage": {"total_tokens": 25},
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(status_code=200, json=mock_resp)
        data = await service.chat_completion(
            messages=[{"role": "user", "content": "Hello"}],
            temperature=0.6,
        )
        assert data["choices"][0]["message"]["content"] == "Namaskaram! How can I help?"
        assert data["_provider"] == "evon-v3.3"


@pytest.mark.asyncio
async def test_evon_chat_scope_error_handling(monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "valid_key")
    service = GnaniEvonService()

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=403,
            text='{"detail":{"error_code":"SCOPE_NOT_ALLOWED","message":"Service \'None\' not in allowed scopes"}}',
        )
        with pytest.raises(HTTPException) as exc_info:
            await service.chat_completion(messages=[{"role": "user", "content": "Hi"}])
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["error"] == "EVON_SCOPE_NOT_ALLOWED"

