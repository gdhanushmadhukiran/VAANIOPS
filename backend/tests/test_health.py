from unittest.mock import patch, AsyncMock
import httpx
from app.config import settings


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "VaaniOps Backend"
    assert "timestamp" in data


def test_gnani_health_missing_key(client, monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "")
    response = client.get("/api/health/gnani")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "KEY_MISSING"
    assert data["key_status"] == "KEY_MISSING"
    assert data["api_key_configured"] is False
    assert data["api_key_preview"] is None
    assert data["prisma_status"]["status"] == "KEY_MISSING"
    assert data["timbre_status"]["status"] == "KEY_MISSING"


def test_gnani_health_configured_authenticated(client, monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "gn_test_secret_12345")

    # Mock probe responses for both Prisma and Timbre: returning 400 (auth passed header check)
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = httpx.Response(status_code=400, json={"error": "missing audio"})
        mock_post.return_value = mock_response

        response = client.get("/api/health/gnani")
        assert response.status_code == 200
        data = response.json()
        assert data["api_key_configured"] is True
        assert data["key_status"] == "KEY_PRESENT"
        assert "gn_...345" in data["api_key_preview"]
        assert data["prisma_status"]["status"] == "AUTHENTICATION_SUCCESS"
        assert data["timbre_status"]["status"] == "AUTHENTICATION_SUCCESS"
        assert data["status"] == "AUTHENTICATION_SUCCESS"


def test_gnani_health_unauthorized(client, monkeypatch):
    monkeypatch.setattr(settings, "GNANI_API_KEY", "invalid_key_value")

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = httpx.Response(status_code=401, text="Unauthorized key")
        mock_post.return_value = mock_response

        response = client.get("/api/health/gnani")
        assert response.status_code == 200
        data = response.json()
        assert data["api_key_configured"] is True
        assert data["key_status"] == "KEY_PRESENT"
        assert data["prisma_status"]["status"] == "AUTHENTICATION_FAILED"
        assert data["timbre_status"]["status"] == "AUTHENTICATION_FAILED"
        assert data["status"] == "AUTHENTICATION_FAILED"


def test_gnani_health_not_connected_merely_because_key_present(client, monkeypatch):
    # Proves requirement 8: Do not report CONNECTED merely because a credential exists.
    monkeypatch.setattr(settings, "GNANI_API_KEY", "dummy_existing_key_string")

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = httpx.Response(status_code=401, text="Invalid credential")
        mock_post.return_value = mock_response

        response = client.get("/api/health/gnani")
        assert response.status_code == 200
        data = response.json()
        assert data["key_status"] == "KEY_PRESENT"
        assert data["status"] != "AUTHENTICATION_SUCCESS"
        assert data["status"] == "AUTHENTICATION_FAILED"

