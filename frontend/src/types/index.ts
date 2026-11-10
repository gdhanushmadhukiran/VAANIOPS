export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface WorkOrder {
  id: number;
  order_number: string;
  customer_name: string;
  service_type: string;
  vehicle_or_asset: string | null;
  description: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  estimated_cost: number | null;
  status: OrderStatus;
  original_transcript: string | null;
  language_code: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderCreatePayload {
  customer_name: string;
  service_type: string;
  vehicle_or_asset?: string | null;
  description?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  estimated_cost?: number | null;
  status?: OrderStatus;
  original_transcript?: string | null;
  language_code?: string;
}

export interface TranscribeResponse {
  success: boolean;
  request_id?: string | null;
  transcript: string;
  model: string;
  language_code: string;
}

export interface ExtractedOrderInfo {
  intent: string;
  customer_name: string | null;
  vehicle_or_asset: string | null;
  service_type: string | null;
  description: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  estimated_cost: number | null;
  status: OrderStatus;
  requires_confirmation: boolean;
}

export interface StatsResponse {
  total_orders: number;
  pending_orders: number;
  in_progress_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  today_orders: number;
  recent_orders: WorkOrder[];
}

export interface GnaniServiceStatus {
  configured: boolean;
  status: string;
  endpoint: string;
  details?: string | null;
}

export interface GnaniHealthResponse {
  status: string;
  api_key_configured: boolean;
  key_status?: string;
  api_key_preview: string | null;
  prisma_status: GnaniServiceStatus;
  timbre_status: GnaniServiceStatus;
  evon_status?: GnaniServiceStatus;
  message: string;
}

export interface ExtractedBusinessOrder {
  intent: string;
  language: string;
  customer_name: string | null;
  asset_type: string | null;
  asset_model: string | null;
  service_type: string | null;
  issue_description: string | null;
  estimated_cost: number | null;
  currency: string;
  delivery_date: string | null;
  delivery_time: string | null;
  status: string;
  missing_fields: string[];
  requires_confirmation: boolean;
  clarification_question: string | null;
  telugu_summary: string | null;
  provider: string;
}

export interface IntelligenceChatResponse {
  session_id: string;
  response_text: string;
  intent: string;
  extracted_info?: ExtractedBusinessOrder | null;
  missing_fields: string[];
  clarification_needed: boolean;
  clarification_question?: string | null;
  suggested_action?: string | null;
  tool_executed?: string | null;
  tool_result?: any;
  provider: string;
  latency_ms?: number | null;
}

export interface BusinessAnalyticsResponse {
  total_orders: number;
  pending_orders: number;
  in_progress_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  today_orders: number;
  total_estimated_value: number;
  completed_revenue: number;
  pending_estimated_value: number;
  top_services: Array<{ service: string; count: number }>;
  upcoming_deliveries: Array<{
    order_number: string;
    customer_name: string;
    service: string;
    delivery_date: string;
    delivery_time: string;
    status: string;
  }>;
  overdue_orders: Array<{
    order_number: string;
    customer_name: string;
    service: string;
    delivery_date: string;
    status: string;
  }>;
  operational_summary: string;
}

export interface ActionConfirmationResponse {
  success: boolean;
  order?: WorkOrder | null;
  message: string;
  spoken_confirmation_text?: string | null;
  duplicate_prevented: boolean;
}

export interface BackendHealthResponse {
  status: string;
  service: string;
  timestamp: string;
  environment: string;
}

export interface VoiceActivityItem {
  id: string;
  timestamp: string;
  transcript: string;
  customerName?: string | null;
  serviceType?: string | null;
  languageCode: string;
  model: string;
  status: 'saved' | 'discarded' | 'transcribed';
}

