import os
import pytest
from app.config import settings

LIVE_KEY = os.getenv("GNANI_API_KEY", "").strip() or settings.GNANI_API_KEY.strip()


@pytest.mark.skipif(not LIVE_KEY, reason="GNANI_API_KEY is not configured; skipping live credit-consuming tests")
def test_live_gnani_timbre_synthesis(client):
    """
    Runs only when GNANI_API_KEY is supplied.
    """
    response = client.post(
        "/api/speak",
        json={
            "text": "నమస్కారం! వాణీ ఆప్స్ లైవ్ సిస్టమ్ సిద్ధంగా ఉంది.",
            "voice": "Kaveri",
            "language": "te-IN",
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert len(response.content) > 100

