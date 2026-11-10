import {
  WorkOrder,
  WorkOrderCreatePayload,
  TranscribeResponse,
  ExtractedOrderInfo,
  StatsResponse,
  GnaniHealthResponse,
  BackendHealthResponse,
  ExtractedBusinessOrder,
  IntelligenceChatResponse,
  BusinessAnalyticsResponse,
  ActionConfirmationResponse,
  GnaniServiceStatus,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail?.message || errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(errorDetail || `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async getHealth(): Promise<BackendHealthResponse> {
    const res = await fetch(`${BASE_URL}/api/health`);
    return handleResponse<BackendHealthResponse>(res);
  },

  async getGnaniHealth(): Promise<GnaniHealthResponse> {
    const res = await fetch(`${BASE_URL}/api/health/gnani`);
    return handleResponse<GnaniHealthResponse>(res);
  },

  async transcribeAudio(wavBlob: Blob, languageCode: string = 'te-IN'): Promise<TranscribeResponse> {
    const formData = new FormData();
    formData.append('audio_file', wavBlob, 'recording.wav');
    formData.append('language_code', languageCode);

    const res = await fetch(`${BASE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<TranscribeResponse>(res);
  },

  async extractInfo(transcript: string, languageCode: string = 'te-IN'): Promise<ExtractedOrderInfo> {
    const res = await fetch(`${BASE_URL}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, language_code: languageCode }),
    });
    return handleResponse<ExtractedOrderInfo>(res);
  },

  async createOrder(payload: WorkOrderCreatePayload): Promise<WorkOrder> {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<WorkOrder>(res);
  },

  async getOrders(params?: { status?: string; q?: string }): Promise<WorkOrder[]> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') {
      query.append('status', params.status);
    }
    if (params?.q && params.q.trim()) {
      query.append('q', params.q.trim());
    }
    const res = await fetch(`${BASE_URL}/api/orders?${query.toString()}`);
    return handleResponse<WorkOrder[]>(res);
  },

  async getOrder(orderId: number): Promise<WorkOrder> {
    const res = await fetch(`${BASE_URL}/api/orders/${orderId}`);
    return handleResponse<WorkOrder>(res);
  },

  async updateOrder(orderId: number, data: Partial<WorkOrder>): Promise<WorkOrder> {
    const res = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<WorkOrder>(res);
  },

  async getStats(): Promise<StatsResponse> {
    const res = await fetch(`${BASE_URL}/api/stats`);
    return handleResponse<StatsResponse>(res);
  },

  async synthesizeSpeech(
    text: string,
    voice: string = 'Kaveri',
    language: string = 'te-IN',
    speed: number = 1.0
  ): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, language, speed }),
    });

    if (!res.ok) {
      let errorDetail = '';
      try {
        const errJson = await res.json();
        errorDetail = errJson.detail?.message || errJson.detail || JSON.stringify(errJson);
      } catch {
        errorDetail = await res.text();
      }
      throw new Error(errorDetail || `Synthesis failed: ${res.status}`);
    }

    const audioBlob = await res.blob();
    return URL.createObjectURL(audioBlob);
  },

  // Gnani Evon v3.3 Intelligence API Methods
  async chatIntelligence(
    message: string,
    sessionId?: string,
    languageCode: string = 'te-IN',
    customerName?: string
  ): Promise<IntelligenceChatResponse> {
    const res = await fetch(`${BASE_URL}/api/intelligence/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        language_code: languageCode,
        customer_name: customerName,
      }),
    });
    return handleResponse<IntelligenceChatResponse>(res);
  },

  async extractOrderIntelligence(
    transcript: string,
    languageCode: string = 'te-IN',
    sessionId?: string
  ): Promise<ExtractedBusinessOrder> {
    const res = await fetch(`${BASE_URL}/api/intelligence/extract-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        language_code: languageCode,
        session_id: sessionId,
      }),
    });
    return handleResponse<ExtractedBusinessOrder>(res);
  },

  async confirmAction(
    sessionId: string,
    idempotencyKey: string,
    orderData: WorkOrderCreatePayload
  ): Promise<ActionConfirmationResponse> {
    const res = await fetch(`${BASE_URL}/api/intelligence/confirm-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        action_type: 'create_work_order',
        idempotency_key: idempotencyKey,
        order_data: orderData,
      }),
    });
    return handleResponse<ActionConfirmationResponse>(res);
  },

  async getBusinessAnalytics(): Promise<BusinessAnalyticsResponse> {
    const res = await fetch(`${BASE_URL}/api/intelligence/analytics`);
    return handleResponse<BusinessAnalyticsResponse>(res);
  },

  async getEvonStatus(): Promise<GnaniServiceStatus> {
    const res = await fetch(`${BASE_URL}/api/intelligence/status`);
    return handleResponse<GnaniServiceStatus>(res);
  },
};

