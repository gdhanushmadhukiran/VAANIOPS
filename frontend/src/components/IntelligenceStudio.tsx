import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  AlertTriangle,
  RotateCcw,
  Volume2,
  Loader2,
  IndianRupee,
  TrendingUp,
  Search,
  Check,
  Radio,
  ArrowRight,
  ShieldCheck,
  Mic,
} from 'lucide-react';
import {
  GnaniHealthResponse,
  IntelligenceChatResponse,
  BusinessAnalyticsResponse,
  WorkOrder,
  WorkOrderCreatePayload,
} from '../types';
import { api } from '../services/api';

interface IntelligenceStudioProps {
  gnaniHealth: GnaniHealthResponse | null;
  onOrderCreated: (order: WorkOrder) => void;
  onOpenVoiceWorkspace: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  intent?: string;
  extracted?: any;
  toolExecuted?: string | null;
  timestamp: string;
  audioUrl?: string | null;
}

export const IntelligenceStudio: React.FC<IntelligenceStudioProps> = ({
  gnaniHealth,
  onOrderCreated,
  onOpenVoiceWorkspace,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'analytics' | 'customers'>('chat');
  const [sessionId, setSessionId] = useState<string>(() => `sess_${Date.now().toString(36)}`);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'నమస్కారం! నేను వాణీ ఆప్స్ ఇంటెలిజెన్స్ అసిస్టెంట్ (Evon v3.3). వర్క్‌షాప్ ఆర్డర్లు, కస్టమర్ రికార్డులు లేదా వ్యాపార లెక్కల గురించి మాట్లాడండి.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState<string | null>(null);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<BusinessAnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Customer search state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  useEffect(() => {
    if (activeSubTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeSubTab]);

  const fetchAnalytics = async () => {
    try {
      setIsLoadingAnalytics(true);
      const data = await api.getBusinessAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    setInputText('');
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const res: IntelligenceChatResponse = await api.chatIntelligence(text, sessionId, 'te-IN');
      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: res.response_text,
        intent: res.intent,
        extracted: res.extracted_info,
        toolExecuted: res.tool_executed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: `క్షమించండి, అభ్యర్థన ప్రాసెస్ చేయడంలో లోపం: ${err.message || 'Error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmOrder = async (extracted: any) => {
    if (!extracted || isConfirmingOrder) return;
    try {
      setIsConfirmingOrder(true);
      const payload: WorkOrderCreatePayload = {
        customer_name: extracted.customer_name || 'Customer',
        service_type: extracted.service_type || 'General Service',
        vehicle_or_asset: extracted.asset_model || extracted.vehicle_or_asset || null,
        description: extracted.issue_description || extracted.description || null,
        delivery_date: extracted.delivery_date || null,
        delivery_time: extracted.delivery_time || null,
        estimated_cost: extracted.estimated_cost || null,
        status: 'pending',
        language_code: extracted.language || 'te-IN',
      };

      const idempotencyKey = `idemp_${sessionId}_${Date.now()}`;
      const res = await api.confirmAction(sessionId, idempotencyKey, payload);

      if (res.success && res.order) {
        onOrderCreated(res.order);
        // Add assistant confirmation message
        setMessages((prev) => [
          ...prev,
          {
            id: `conf_${Date.now()}`,
            sender: 'assistant',
            text: res.spoken_confirmation_text || `${res.order?.customer_name} గారి వర్క్ ఆర్డర్ #${res.order?.order_number} విజయవంతంగా క్రియేట్ చేయబడింది!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      alert(`Order confirmation failed: ${err.message}`);
    } finally {
      setIsConfirmingOrder(false);
    }
  };

  const handleSpeakText = async (messageId: string, text: string) => {
    try {
      setIsSynthesizing(messageId);
      const url = await api.synthesizeSpeech(text, 'Kaveri', 'te-IN', 1.0);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error('Audio playback failed:', err);
    } finally {
      setIsSynthesizing(null);
    }
  };

  const handleCustomerSearch = async () => {
    if (!customerSearchQuery.trim()) return;
    try {
      setIsSearchingCustomer(true);
      const res = await api.chatIntelligence(
        `search customer ${customerSearchQuery}`,
        sessionId
      );
      if (res.tool_result?.customers) {
        setCustomerSearchResults(res.tool_result.customers);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const isEvonConnected =
    gnaniHealth?.evon_status?.status === 'CONNECTED' ||
    gnaniHealth?.evon_status?.status === 'INFERENCE_SUCCESSFUL';
  const isEvonScopePending = gnaniHealth?.evon_status?.status === 'SCOPE_NOT_ALLOWED';

  const quickQuestions = [
    'ఈరోజు ఎన్ని ఆర్డర్లు వచ్చాయి? (Today orders)',
    'పెండింగ్‌లో ఉన్న ఆర్డర్లు ఏవి? (Pending orders)',
    'ఈరోజు వర్క్‌షాప్ సమ్మరీ ఇవ్వండి (Daily summary)',
    'ఎక్కువగా ఏ సర్వీస్ అడుగుతున్నారు? (Top services)',
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner & Status */}
      <div className="rounded-2xl border border-violet-800/40 bg-gradient-to-r from-violet-950 via-slate-900 to-navy-950 p-4 sm:p-5 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-violet-200 border border-violet-400/30">
              <Sparkles className="h-3 w-3 text-violet-300" />
              <span>Gnani Evon v3.3 Indic Intelligence Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">AI Reasoning & Multi-Turn Operations</h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Natural Telugu-English understanding, contextual memory, entity extraction with Asia/Kolkata date resolution, and controlled database business tools.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="rounded-xl border border-white/15 bg-black/40 backdrop-blur-sm px-3.5 py-2 text-right shadow-inner">
              <div className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">Evon Engine Status</div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isEvonConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : isEvonScopePending ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs font-bold text-white">
                  {isEvonConnected ? 'HOSTED CONNECTED' : isEvonScopePending ? 'SCOPE PENDING' : 'ACTIVE PIPELINE'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setSessionId(`sess_${Date.now().toString(36)}`);
                setMessages([
                  {
                    id: 'new_welcome',
                    sender: 'assistant',
                    text: 'కొత్త సెషన్ ప్రారంభించబడింది. మీరు ఏ కస్టమర్ ఆర్డర్ లేదా సమాచారం నమోదు చేయాలనుకుంటున్నారు?',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-600/30 hover:bg-violet-600/50 px-3 py-2 text-xs font-semibold hover:border-violet-300 transition-all text-white shadow-sm"
              title="Reset conversation context"
            >
              <RotateCcw className="h-3.5 w-3.5 text-violet-200" />
              <span>New Session</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 flex border-b border-white/15 gap-2 sm:gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`pb-2 px-3 text-xs font-bold transition-colors border-b-2 whitespace-nowrap ${
              activeSubTab === 'chat'
                ? 'border-violet-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Conversational Assistant
          </button>
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`pb-2 px-3 text-xs font-bold transition-colors border-b-2 whitespace-nowrap ${
              activeSubTab === 'analytics'
                ? 'border-violet-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Business & Financial Reporting
          </button>
          <button
            onClick={() => setActiveSubTab('customers')}
            className={`pb-2 px-3 text-xs font-bold transition-colors border-b-2 whitespace-nowrap ${
              activeSubTab === 'customers'
                ? 'border-violet-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Customer Intelligence
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeSubTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chat Stream (Left 2 cols) */}
          <div className="lg:col-span-2 flex flex-col h-[520px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-accent" />
                <span className="font-bold text-slate-800">Multi-Turn Context Engine</span>
                <span className="text-slate-400 font-mono text-[11px]">({sessionId})</span>
              </div>
              <span className="text-slate-500 text-[11px]">Telugu / English Mixed Speech</span>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-violet-accent text-white rounded-tr-none'
                        : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {msg.sender === 'user' ? 'Workshop User' : 'Evon v3.3 Intelligence'}
                      </span>
                      <span className="text-[10px] opacity-60">{msg.timestamp}</span>
                    </div>

                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                    {/* Extracted Work Order Preview Card */}
                    {msg.extracted && msg.extracted.service_type && (
                      <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3.5 text-xs text-slate-800 space-y-2">
                        <div className="flex items-center justify-between font-bold text-violet-900 border-b border-violet-200/60 pb-1.5">
                          <span>Extracted Work Order Details</span>
                          <span className="text-[10px] bg-violet-200/80 text-violet-800 px-2 py-0.5 rounded-full">
                            {msg.extracted.asset_type || 'Service Order'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500">Customer:</span>{' '}
                            <span className="font-bold">{msg.extracted.customer_name || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Asset/Model:</span>{' '}
                            <span className="font-bold">{msg.extracted.asset_model || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Service:</span>{' '}
                            <span className="font-bold">{msg.extracted.service_type || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Estimate:</span>{' '}
                            <span className="font-bold">
                              {msg.extracted.estimated_cost ? `₹${msg.extracted.estimated_cost}` : '—'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-500">Delivery:</span>{' '}
                            <span className="font-bold text-violet-800">
                              {msg.extracted.delivery_date || 'Unspecified'} ({msg.extracted.delivery_time || 'Anytime'})
                            </span>
                          </div>
                        </div>

                        {/* Missing fields alert if any */}
                        {msg.extracted.missing_fields && msg.extracted.missing_fields.length > 0 && (
                          <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 rounded-lg p-1.5 text-[10px]">
                            <AlertTriangle className="h-3 w-3 text-amber-600 flex-shrink-0" />
                            <span>Missing mandatory: {msg.extracted.missing_fields.join(', ')}</span>
                          </div>
                        )}

                        {/* Confirmation Button */}
                        {(!msg.extracted.missing_fields || msg.extracted.missing_fields.length === 0) && (
                          <div className="pt-1.5 flex items-center justify-between">
                            <button
                              onClick={() => handleConfirmOrder(msg.extracted)}
                              disabled={isConfirmingOrder}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-sm"
                            >
                              {isConfirmingOrder ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              <span>Confirm & Create Order</span>
                            </button>
                            <span className="text-[10px] text-slate-500">Idempotency Protected</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Telugu Timbre Spoken Audio Button */}
                    {msg.sender === 'assistant' && (
                      <div className="mt-2 flex items-center justify-end">
                        <button
                          onClick={() => handleSpeakText(msg.id, msg.text)}
                          disabled={isSynthesizing === msg.id}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-accent hover:text-violet-dark transition-colors"
                        >
                          {isSynthesizing === msg.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                          <span>Speak Telugu (Timbre)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-accent" />
                  <span>Evon v3.3 is reasoning and validating context...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={onOpenVoiceWorkspace}
                  title="Speak Telugu or English via Prisma v2.5 Voice Pipeline"
                  className="rounded-xl border border-violet-200 bg-violet-50 p-2.5 text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type in Telugu or English: 'Ravi Honda Activa brake repair repu delivery'..."
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs focus:border-violet-accent focus:outline-none focus:ring-1 focus:ring-violet-accent"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isProcessing}
                  className="rounded-xl bg-violet-accent p-2.5 text-white hover:bg-violet-dark disabled:opacity-50 transition-all shadow-md shadow-violet-accent/20"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Quick Prompts & Context Insights (Right 1 col) */}
          <div className="space-y-4">
            {/* Quick Prompts */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Quick Intelligence Queries
              </h3>
              <div className="space-y-2">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="w-full text-left rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs text-slate-700 hover:border-violet-200 hover:bg-violet-50/60 hover:text-violet-900 transition-all flex items-center justify-between group"
                  >
                    <span className="line-clamp-1">{q}</span>
                    <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-violet-accent transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Workspace Shortcut */}
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50/50 p-5 space-y-3">
              <div className="flex items-center gap-2 text-violet-900 font-bold text-xs">
                <Radio className="h-4 w-4 text-violet-accent" />
                <span>Voice Pipeline Integration</span>
              </div>
              <p className="text-xs text-slate-600">
                Record directly using Gnani Prisma v2.5 STT in Telugu or English. Transcripts flow automatically into Evon intelligence.
              </p>
              <button
                onClick={onOpenVoiceWorkspace}
                className="w-full rounded-xl bg-violet-accent px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-accent/25 hover:bg-violet-dark transition-all"
              >
                Open Voice Workspace
              </button>
            </div>

            {/* Architecture Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2.5 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Controlled Tool Registry</span>
              </h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                All business actions execute through strict SQLAlchemy database services with transaction safety and audit logging. LLM has zero direct SQL or shell access.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics & Business Reporting SubTab */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          {isLoadingAnalytics ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-accent" />
            </div>
          ) : analytics ? (
            <>
              {/* Financial & Status KPI Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Collected Revenue</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-2 flex items-center">
                    <IndianRupee className="h-5 w-5" />
                    <span>{analytics.completed_revenue.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">From completed & delivered work orders</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Pipeline</div>
                  <div className="text-2xl font-bold text-violet-accent mt-2 flex items-center">
                    <IndianRupee className="h-5 w-5" />
                    <span>{analytics.pending_estimated_value.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Estimated value of active jobs</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Pending Jobs</div>
                  <div className="text-2xl font-bold text-amber-600 mt-2">
                    {analytics.pending_orders + analytics.in_progress_orders}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Pending inspection & in-progress</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's New Orders</div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {analytics.today_orders}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Total recorded: {analytics.total_orders}</p>
                </div>
              </div>

              {/* Operational Summary Banner */}
              <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5">
                <h3 className="text-xs font-bold text-violet-900 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-accent" />
                  <span>AI Operational Overview (Real SQLite Data)</span>
                </h3>
                <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                  {analytics.operational_summary}
                </p>
              </div>

              {/* Top Services & Upcoming Deliveries Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Demanded Services */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800">Most Demanded Services</h3>
                  <div className="space-y-3">
                    {analytics.top_services.length === 0 ? (
                      <p className="text-xs text-slate-400">No service orders recorded yet.</p>
                    ) : (
                      analytics.top_services.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                          <span className="font-semibold text-slate-700">{item.service}</span>
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                            {item.count} orders
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Upcoming Deliveries in 48h */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800">Upcoming Deliveries (Next 48 Hours)</h3>
                  <div className="space-y-2.5">
                    {analytics.upcoming_deliveries.length === 0 ? (
                      <p className="text-xs text-slate-400">No deliveries scheduled for today or tomorrow.</p>
                    ) : (
                      analytics.upcoming_deliveries.map((d, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                          <div>
                            <div className="font-bold text-slate-800">{d.customer_name} ({d.service})</div>
                            <div className="text-[11px] text-slate-500 font-mono">#{d.order_number}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-violet-800">{d.delivery_date}</div>
                            <div className="text-[11px] text-slate-400">{d.delivery_time}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Customer Intelligence SubTab */}
      {activeSubTab === 'customers' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Customer History Lookup</h3>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="Enter customer name e.g. Ravi, Suresh..."
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs focus:border-violet-accent focus:outline-none"
              />
              <button
                onClick={handleCustomerSearch}
                disabled={isSearchingCustomer || !customerSearchQuery.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-violet-accent px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-dark transition-all disabled:opacity-50"
              >
                {isSearchingCustomer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span>Search</span>
              </button>
            </div>

            {/* Results Table */}
            {customerSearchResults.length > 0 && (
              <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Customer Name</th>
                      <th className="px-4 py-3 text-left">Total Orders</th>
                      <th className="px-4 py-3 text-left">Last Recorded Visit</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {customerSearchResults.map((cust, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-bold text-slate-800">{cust.customer_name}</td>
                        <td className="px-4 py-3 text-slate-600">{cust.total_orders} visits</td>
                        <td className="px-4 py-3 text-slate-500">{cust.last_visit ? new Date(cust.last_visit).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setActiveSubTab('chat');
                              handleSendMessage(`Show full history of ${cust.customer_name}`);
                            }}
                            className="text-violet-accent font-semibold hover:underline"
                          >
                            View History &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
