import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional
import httpx
from fastapi import HTTPException
from app.config import settings

logger = logging.getLogger(__name__)


class GnaniEvonService:
    """
    Client service for Gnani Evon v3.3 (30B MoE Indic Reasoning LLM).
    Communicates via OpenAI-compatible API specifications verified from the
    official gnani/gnani-evon-v3.3-30B-A3B model runtime contract.
    """

    def __init__(self):
        self.base_url = settings.EVON_BASE_URL.rstrip("/")
        self.model = settings.EVON_MODEL
        self.timeout = settings.EVON_TIMEOUT_SECONDS
        self.enabled = settings.EVON_ENABLED

    def _get_api_key(self) -> str:
        return settings.effective_evon_api_key

    def _get_headers(self) -> Dict[str, str]:
        key = self._get_api_key()
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if key:
            headers["X-API-Key-ID"] = key
            headers["Authorization"] = f"Bearer {key}"
        return headers

    async def check_health(self) -> Dict[str, Any]:
        """
        Safely probes the GPU host and vLLM service.
        Implements strict Phase 7 diagnostic distinction:
        1. GPU_SERVER_AVAILABLE (Server answers HTTP probe, but model not verified)
        2. MODEL_LOADED (/v1/models reports model loaded in VRAM)
        3. INFERENCE_SUCCESSFUL (Real test inference request executed successfully)
        4. INFERENCE_FAILED (Server responds but inference execution throws error/OOM)
        5. MODEL_UNAVAILABLE (Host unreachable, connection refused, or 502/503)

        RULE: Never reports CONNECTED / INFERENCE_SUCCESSFUL merely because
        the server responds to HTTP. A live inference request must succeed.
        """
        api_key = self._get_api_key()
        if not api_key:
            return {
                "configured": False,
                "status": "KEY_MISSING",
                "endpoint": f"{self.base_url}/chat/completions",
                "model": self.model,
                "latency_ms": None,
                "details": "EVON_API_KEY is not configured.",
            }

        headers = self._get_headers()
        probe_timeout = min(5.0, self.timeout)

        # 1. Primary probe: Execute live inference request to verify actual model operation
        # RULE: Never report CONNECTED / INFERENCE_SUCCESSFUL merely because server responds to HTTP.
        endpoint = f"{self.base_url}/chat/completions"
        probe_payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
            "chat_template_kwargs": {"enable_thinking": False},
        }

        start_time = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=probe_timeout) as client:
                res = await client.post(endpoint, headers=headers, json=probe_payload)
                latency = round((time.perf_counter() - start_time) * 1000, 1)

                if res.status_code == 200:
                    return {
                        "configured": True,
                        "status": "INFERENCE_SUCCESSFUL",
                        "endpoint": endpoint,
                        "model": self.model,
                        "latency_ms": latency,
                        "details": f"Evon v3.3 live GPU inference verified ({latency}ms).",
                    }
                elif res.status_code in {401, 403}:
                    body = res.text.lower()
                    if "scope_not_allowed" in body or "service 'none' not in allowed scopes" in body or "allowed scopes" in body:
                        return {
                            "configured": True,
                            "status": "SCOPE_NOT_ALLOWED",
                            "endpoint": endpoint,
                            "model": self.model,
                            "latency_ms": latency,
                            "details": (
                                "Gnani API Gateway: Key authenticated for Vachana STT/TTS, but account does not have "
                                "Evon v3.3 LLM scope in allowed scopes. Requires Evon scope approval from Gnani.ai or local vLLM URL."
                            ),
                        }
                    return {
                        "configured": True,
                        "status": "AUTHENTICATION_FAILED",
                        "endpoint": endpoint,
                        "model": self.model,
                        "latency_ms": latency,
                        "details": "Invalid API key or unauthorized for GPU reverse proxy (401/403).",
                    }
                elif res.status_code == 429:
                    return {
                        "configured": True,
                        "status": "INFERENCE_FAILED",
                        "endpoint": endpoint,
                        "model": self.model,
                        "latency_ms": latency,
                        "details": "GPU server rate limit exceeded (429).",
                    }
                elif res.status_code >= 500:
                    # Model might be loaded in VRAM but experiencing execution error or OOM
                    model_loaded = False
                    try:
                        res_m = await client.get(f"{self.base_url}/models", headers=headers)
                        if res_m.status_code == 200:
                            model_loaded = True
                    except Exception:
                        pass
                    return {
                        "configured": True,
                        "status": "MODEL_LOADED" if model_loaded else "INFERENCE_FAILED",
                        "endpoint": endpoint,
                        "model": self.model,
                        "latency_ms": latency,
                        "details": f"GPU inference execution error (HTTP {res.status_code}): {res.text[:100]}",
                    }
                else:
                    return {
                        "configured": True,
                        "status": "INFERENCE_FAILED",
                        "endpoint": endpoint,
                        "model": self.model,
                        "latency_ms": latency,
                        "details": f"Unexpected response code: {res.status_code}",
                    }
        except httpx.ConnectError:
            # Check if base server or /health port answers even if inference endpoint refused
            server_available = False
            try:
                async with httpx.AsyncClient(timeout=2.0) as check_client:
                    h_url = f"{self.base_url.rsplit('/v1', 1)[0]}/health" if "/v1" in self.base_url else f"{self.base_url}/health"
                    res_h = await check_client.get(h_url)
                    if res_h.status_code < 500:
                        server_available = True
            except Exception:
                pass

            if server_available:
                return {
                    "configured": True,
                    "status": "GPU_SERVER_AVAILABLE",
                    "endpoint": endpoint,
                    "model": self.model,
                    "latency_ms": None,
                    "details": "GPU server host responded, but inference endpoint connection was refused.",
                }
            return {
                "configured": True,
                "status": "MODEL_UNAVAILABLE",
                "endpoint": endpoint,
                "model": self.model,
                "latency_ms": None,
                "details": f"Could not connect to {self.base_url}. Verify GPU instance status.",
            }
        except httpx.TimeoutException:
            return {
                "configured": True,
                "status": "INFERENCE_FAILED",
                "endpoint": endpoint,
                "model": self.model,
                "latency_ms": None,
                "details": f"Inference probe timed out after {probe_timeout}s.",
            }
        except Exception as e:
            return {
                "configured": True,
                "status": "INFERENCE_FAILED",
                "endpoint": endpoint,
                "model": self.model,
                "latency_ms": None,
                "details": str(e),
            }
        except httpx.ConnectError:
            if server_available:
                return {
                    "configured": True,
                    "status": "GPU_SERVER_AVAILABLE",
                    "endpoint": endpoint,
                    "model": self.model,
                    "latency_ms": None,
                    "details": "GPU server port responded, but inference endpoint connection was refused.",
                }
            return {
                "configured": True,
                "status": "MODEL_UNAVAILABLE",
                "endpoint": endpoint,
                "model": self.model,
                "latency_ms": None,
                "details": f"Could not connect to {self.base_url}. Verify GPU instance status.",
            }
        except httpx.TimeoutException:
            return {
                "configured": True,
                "status": "INFERENCE_FAILED",
                "endpoint": endpoint,
                "model": self.model,
                "latency_ms": None,
                "details": f"Inference probe timed out after {probe_timeout}s.",
            }
        except Exception as e:
            return {
                "configured": True,
                "status": "INFERENCE_FAILED",
                "endpoint": endpoint,
                "model": self.model,
                "latency_ms": None,
                "details": str(e),
            }

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.6,
        top_p: float = 0.95,
        max_tokens: int = 2048,
        tools: Optional[List[Dict[str, Any]]] = None,
        enable_thinking: bool = False,
    ) -> Dict[str, Any]:
        """
        Sends an inference request to Evon v3.3 following OpenAI-compatible vLLM/SGLang specification.
        Includes retries on transient errors and parses structured responses.
        """
        if not self.enabled:
            raise HTTPException(
                status_code=503,
                detail={"error": "EVON_DISABLED", "message": "Evon intelligence service is disabled in settings."},
            )

        api_key = self._get_api_key()
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail={"error": "EVON_API_KEY_MISSING", "message": "Evon API key is not configured in backend."},
            )

        endpoint = f"{self.base_url}/chat/completions"
        headers = self._get_headers()

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": max(0.0, min(1.5, temperature)),
            "top_p": max(0.0, min(1.0, top_p)),
            "max_tokens": max_tokens,
            "chat_template_kwargs": {"enable_thinking": enable_thinking},
            "stream": False,
        }

        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        max_retries = 2
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                start_time = time.perf_counter()
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(endpoint, headers=headers, json=payload)
                    latency_ms = round((time.perf_counter() - start_time) * 1000, 1)

                if response.status_code == 200:
                    data = response.json()
                    data["_latency_ms"] = latency_ms
                    data["_provider"] = "evon-v3.3"
                    choice = data.get("choices", [{}])[0] if data.get("choices") else {}
                    msg = choice.get("message", {})
                    data["_content"] = msg.get("content", "")
                    data["_reasoning"] = msg.get("reasoning_content") or msg.get("thinking")
                    return data

                elif response.status_code in {401, 403}:
                    error_text = response.text
                    if "scope_not_allowed" in error_text.lower() or "allowed scopes" in error_text.lower():
                        raise HTTPException(
                            status_code=403,
                            detail={
                                "error": "EVON_SCOPE_NOT_ALLOWED",
                                "message": "Account API key does not have Evon v3.3 LLM scope granted by Gnani gateway.",
                                "raw": error_text,
                            },
                        )
                    raise HTTPException(
                        status_code=401,
                        detail={
                            "error": "EVON_AUTH_FAILED",
                            "message": "Invalid API key or unauthorized for Evon v3.3.",
                            "raw": error_text,
                        },
                    )

                elif response.status_code == 429:
                    raise HTTPException(
                        status_code=429,
                        detail={"error": "EVON_RATE_LIMITED", "message": "Evon v3.3 rate limit reached."},
                    )

                elif response.status_code in {502, 503, 504} and attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue

                else:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail={
                            "error": "EVON_UPSTREAM_ERROR",
                            "message": f"Evon v3.3 returned status {response.status_code}.",
                            "raw": response.text[:500],
                        },
                    )

            except httpx.ConnectError as e:
                last_error = e
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise HTTPException(
                    status_code=503,
                    detail={
                        "error": "EVON_UNREACHABLE",
                        "message": f"Could not connect to Evon API at {self.base_url}.",
                    },
                )
            except httpx.TimeoutException as e:
                last_error = e
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise HTTPException(
                    status_code=504,
                    detail={
                        "error": "EVON_TIMEOUT",
                        "message": f"Evon API request timed out after {self.timeout}s.",
                    },
                )

        raise HTTPException(
            status_code=503,
            detail={"error": "EVON_SERVICE_ERROR", "message": str(last_error)},
        )


evon_service = GnaniEvonService()
