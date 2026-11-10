import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  FileCheck,
  RotateCcw,
  Languages,
  Info,
} from 'lucide-react';
import { AudioRecordingSession, RecordedAudioResult } from '../utils/audioRecorder';
import { api } from '../services/api';
import {
  ExtractedOrderInfo,
  TranscribeResponse,
  WorkOrder,
  WorkOrderCreatePayload,
  GnaniHealthResponse,
} from '../types';

interface VoiceWorkspaceProps {
  onOrderSaved: (order: WorkOrder) => void;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
  selectedVoice?: string;
  gnaniHealth: GnaniHealthResponse | null;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'ready' | 'saving' | 'error';

export const VoiceWorkspace: React.FC<VoiceWorkspaceProps> = ({
  onOrderSaved,
  initialPrompt,
  onClearInitialPrompt,
  selectedVoice = 'Kaveri',
  gnaniHealth,
}) => {
  const isPrismaConnected =
    gnaniHealth?.prisma_status?.status === 'AUTHENTICATION_SUCCESS' ||
    gnaniHealth?.prisma_status?.status === 'ready';
  const isTimbreConnected =
    gnaniHealth?.timbre_status?.status === 'AUTHENTICATION_SUCCESS' ||
    gnaniHealth?.timbre_status?.status === 'ready';

  const [languageCode, setLanguageCode] = useState<'te-IN' | 'en-IN'>('te-IN');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemoManualInput, setIsDemoManualInput] = useState<boolean>(false);

  // Audio Recording result
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudioResult | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Transcription & Extraction state
  const [transcribeResult, setTranscribeResult] = useState<TranscribeResponse | null>(null);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [savedOrder, setSavedOrder] = useState<WorkOrder | null>(null);

  // Editable Form fields
  const [formData, setFormData] = useState<ExtractedOrderInfo>({
    intent: 'create_work_order',
    customer_name: '',
    vehicle_or_asset: '',
    service_type: '',
    description: '',
    delivery_date: '',
    delivery_time: '',
    estimated_cost: null,
    status: 'pending',
    requires_confirmation: true,
  });

  const sessionRef = useRef<AudioRecordingSession | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Handle passed initial prompt (e.g. from Dashboard quick scenarios)
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      handleManualExtract(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt]);

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setSavedOrder(null);
      setTtsAudioUrl(null);
      setElapsedSeconds(0);

      const session = new AudioRecordingSession(30);
      sessionRef.current = session;

      await session.start(
        (elapsed) => setElapsedSeconds(elapsed),
        () => stopRecording()
      );

      setRecordingState('recording');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Could not start audio recording.');
      setRecordingState('error');
    }
  };

  const stopRecording = async () => {
    if (!sessionRef.current) return;

    try {
      setRecordingState('processing');
      const result = await sessionRef.current.stop();
      sessionRef.current = null;
      setRecordedAudio(result);
      setAudioUrl(result.url);

      // 1. Send converted 16kHz mono WAV to FastAPI /api/transcribe
      const transRes = await api.transcribeAudio(result.blob, languageCode);
      setIsDemoManualInput(false);
      setTranscribeResult(transRes);
      setTranscriptText(transRes.transcript);

      // 2. Extract structured business fields via Evon / Intelligence service
      let extracted: any;
      try {
        const intel = await api.extractOrderIntelligence(transRes.transcript, languageCode);
        extracted = {
          ...intel,
          vehicle_or_asset: intel.asset_model || '',
          description: intel.issue_description || transRes.transcript,
        };
      } catch {
        extracted = await api.extractInfo(transRes.transcript, languageCode);
      }
      setFormData({
        ...extracted,
        customer_name: extracted.customer_name || '',
        vehicle_or_asset: extracted.vehicle_or_asset || '',
        service_type: extracted.service_type || 'General Inspection',
        description: extracted.description || transRes.transcript,
        delivery_date: extracted.delivery_date || '',
        delivery_time: extracted.delivery_time || '',
      });

      setRecordingState('ready');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Processing failed. Check API key or network.');
      setRecordingState('error');
    }
  };

  const handleManualExtract = async (text: string) => {
    try {
      setRecordingState('processing');
      setErrorMessage(null);
      setIsDemoManualInput(true);
      setTranscriptText(text);
      setTranscribeResult({
        success: true,
        request_id: 'DEMO-MANUAL-INPUT',
        transcript: text,
        model: 'DEMO MODE — NO GNANI STT',
        language_code: languageCode,
      });

      let extracted: any;
      try {
        const intel = await api.extractOrderIntelligence(text, languageCode);
        extracted = {
          ...intel,
          vehicle_or_asset: intel.asset_model || '',
          description: intel.issue_description || text,
        };
      } catch {
        extracted = await api.extractInfo(text, languageCode);
      }
      setFormData({
        ...extracted,
        customer_name: extracted.customer_name || '',
        vehicle_or_asset: extracted.vehicle_or_asset || '',
        service_type: extracted.service_type || 'General Inspection',
        description: extracted.description || text,
        delivery_date: extracted.delivery_date || '',
        delivery_time: extracted.delivery_time || '',
      });
      setRecordingState('ready');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Extraction failed.');
      setRecordingState('error');
    }
  };

  const handleSaveOrder = async () => {
    if (!formData.customer_name || !formData.customer_name.trim()) {
      setErrorMessage('Customer name is required. Please fill in the missing customer field.');
      return;
    }
    if (!formData.service_type || !formData.service_type.trim()) {
      setErrorMessage('Service type is required.');
      return;
    }

    try {
      setRecordingState('saving');
      setErrorMessage(null);

      const payload: WorkOrderCreatePayload = {
        customer_name: formData.customer_name.trim(),
        service_type: formData.service_type.trim(),
        vehicle_or_asset: formData.vehicle_or_asset?.trim() || null,
        description: formData.description?.trim() || null,
        delivery_date: formData.delivery_date?.trim() || null,
        delivery_time: formData.delivery_time?.trim() || null,
        estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : null,
        status: 'pending',
        original_transcript: transcriptText || null,
        language_code: languageCode,
      };

      const order = await api.createOrder(payload);
      setSavedOrder(order);
      setRecordingState('ready');
      onOrderSaved(order);

      // Automatically synthesize spoken Telugu confirmation
      handlePlayConfirmation(order);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Failed to save order to SQLite.');
      setRecordingState('ready');
    }
  };

  const handlePlayConfirmation = async (targetOrder?: WorkOrder) => {
    const orderToSpeak = targetOrder || savedOrder;
    const customer = orderToSpeak?.customer_name || formData.customer_name || 'Customer';
    const service = orderToSpeak?.service_type || formData.service_type || 'service';
    const delivery = orderToSpeak?.delivery_date || formData.delivery_date || 'repu';

    // Construct spoken Telugu confirmation phrase
    const teluguConfirmationText =
      languageCode === 'te-IN'
        ? `${customer} గారి ${service} సర్వీస్ ఆర్డర్ క్రియేట్ అయ్యింది. డెలివరీ ${delivery}.`
        : `Service order for ${customer} has been confirmed. Delivery is ${delivery}.`;

    try {
      setIsSynthesizing(true);
      const audioUrl = await api.synthesizeSpeech(
        teluguConfirmationText,
        selectedVoice,
        languageCode,
        1.0
      );
      setTtsAudioUrl(audioUrl);

      // Play audio automatically
      setTimeout(() => {
        if (ttsAudioRef.current) {
          ttsAudioRef.current.play().catch(() => {
            // Autoplay might be restricted until user interaction
          });
        }
      }, 100);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(`TTS Spoken confirmation error: ${error.message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleReset = () => {
    if (sessionRef.current) {
      sessionRef.current.cancel();
      sessionRef.current = null;
    }
    setRecordingState('idle');
    setElapsedSeconds(0);
    setRecordedAudio(null);
    setAudioUrl(null);
    setTranscribeResult(null);
    setTranscriptText('');
    setTtsAudioUrl(null);
    setSavedOrder(null);
    setErrorMessage(null);
    setIsDemoManualInput(false);
    setFormData({
      intent: 'create_work_order',
      customer_name: '',
      vehicle_or_asset: '',
      service_type: '',
      description: '',
      delivery_date: '',
      delivery_time: '',
      estimated_cost: null,
      status: 'pending',
      requires_confirmation: true,
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Language Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-surface-border bg-white p-5 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-accent">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Voice Language Model</h3>
            <p className="text-xs text-slate-500">
              Prisma v2.5 processes single-language input with mixed-speech recognition
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setLanguageCode('te-IN')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              languageCode === 'te-IN'
                ? 'bg-violet-accent text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            తెలుగు (te-IN)
          </button>
          <button
            onClick={() => setLanguageCode('en-IN')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              languageCode === 'en-IN'
                ? 'bg-violet-accent text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English India (en-IN)
          </button>
        </div>
      </div>

      {/* Main Workspace Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Voice Recording Studio (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm flex flex-col items-center text-center">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Voice Recording Studio
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isPrismaConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                Prisma: {isPrismaConnected ? 'CONNECTED' : 'NOT CONFIGURED'}
              </span>
            </div>

            {/* Recording Button */}
            <div className="my-6 relative flex items-center justify-center">
              {recordingState === 'recording' && (
                <div className="absolute h-36 w-36 rounded-full bg-violet-accent/20 voice-recording-glow" />
              )}
              <button
                onClick={recordingState === 'recording' ? stopRecording : startRecording}
                disabled={recordingState === 'processing' || recordingState === 'saving'}
                className={`relative z-10 flex h-28 w-28 items-center justify-center rounded-full transition-all transform active:scale-95 shadow-xl ${
                  recordingState === 'recording'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                    : recordingState === 'processing'
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-tr from-violet-accent to-purple-600 hover:from-violet-dark hover:to-purple-700 text-white shadow-violet-accent/35'
                }`}
              >
                {recordingState === 'recording' ? (
                  <Square className="h-10 w-10 fill-white" />
                ) : recordingState === 'processing' ? (
                  <Loader2 className="h-10 w-10 animate-spin text-white" />
                ) : (
                  <Mic className="h-12 w-12" />
                )}
              </button>
            </div>

            {/* Status and Timer */}
            <div className="space-y-1 mb-4">
              <div className="text-xl font-extrabold text-slate-900">
                {recordingState === 'recording' ? (
                  <span className="text-rose-600 font-mono">
                    00:{elapsedSeconds < 10 ? `0${elapsedSeconds}` : elapsedSeconds} / 00:30
                  </span>
                ) : recordingState === 'processing' ? (
                  <span className="text-violet-accent flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing Audio...
                  </span>
                ) : recordingState === 'ready' ? (
                  <span className="text-emerald-600 flex items-center justify-center gap-1.5 text-base">
                    <CheckCircle2 className="h-5 w-5" /> Audio Ready & Transcribed
                  </span>
                ) : (
                  <span>Ready to Record</span>
                )}
              </div>
              <p className="text-xs text-slate-500 max-w-xs">
                {recordingState === 'recording'
                  ? 'Speak clearly in Telugu or English. Enforces 30s max limit.'
                  : 'Click the microphone and speak naturally (e.g. "Ravi garu bike repair kosam icharu...")'}
              </p>
            </div>

            {!isPrismaConnected && (
              <div className="mt-1 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-left text-[11px] text-amber-800 leading-relaxed">
                <span className="font-bold">Notice:</span> Prisma STT is <span className="font-bold underline">NOT CONFIGURED</span>. Microphone recordings cannot reach the speech API until <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">GNANI_API_KEY</code> is configured. Test order extraction below using Demo Mode.
              </div>
            )}

            {/* Audio Preview if recorded */}
            {audioUrl && (
              <div className="w-full mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Converted WAV (16 kHz, Mono)</span>
                  <span className="text-slate-400">{recordedAudio?.durationSeconds.toFixed(1)}s</span>
                </div>
                <audio controls src={audioUrl} className="w-full h-8" />
              </div>
            )}

            {/* Reset / Clear Button */}
            {(recordedAudio || transcriptText || errorMessage) && (
              <button
                onClick={handleReset}
                className="mt-5 inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset & Start Over</span>
              </button>
            )}
          </div>

          {/* Quick Manual Test Input for Demonstration */}
          <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h4 className="text-xs font-bold text-slate-900">Direct Transcript Input</h4>
              </div>
              <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 tracking-wide uppercase">
                DEMO MODE — NO GNANI SPEECH API USED
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              DEMO MODE — NO GNANI SPEECH API USED. Type or paste a speech transcript to test business information extraction directly:
            </p>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Ravi garu bike repair kosam icharu. Brake pads change cheyyali. Repu evening delivery."
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:border-violet-accent focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    handleManualExtract(e.currentTarget.value.trim());
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  if (input && input.value.trim()) {
                    handleManualExtract(input.value.trim());
                    input.value = '';
                  }
                }}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition-all"
              >
                Extract
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Transcript & Extracted Order Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">Execution Notice</div>
                <div className="mt-0.5 leading-relaxed">{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Transcript Panel */}
          <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <FileCheck className={`h-4 w-4 ${isDemoManualInput ? 'text-amber-500' : 'text-violet-accent'}`} />
                <h3 className="text-sm font-bold text-slate-900">
                  {isDemoManualInput
                    ? 'Typed Transcript (DEMO MODE — NO GNANI SPEECH API USED)'
                    : 'Gnani Prisma v2.5 Transcript'}
                </h3>
              </div>
              {transcribeResult && (
                <div className="flex items-center space-x-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      isDemoManualInput
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-violet-100 text-violet-700'
                    }`}
                  >
                    {transcribeResult.model}
                  </span>
                  {!isDemoManualInput && transcribeResult.request_id && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {transcribeResult.request_id.slice(0, 10)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 min-h-[90px] flex flex-col justify-center">
              {transcriptText ? (
                <>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed font-sans">
                    "{transcriptText}"
                  </p>
                  {isDemoManualInput && (
                    <div className="mt-2 text-[11px] text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      DEMO MODE — NO GNANI SPEECH API USED. This text was entered manually and parsed with local extraction rules.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Transcript will appear here once audio recording is completed and processed by Gnani Prisma.
                </p>
              )}
            </div>
          </div>

          {/* Extracted Work-Order Form */}
          <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Extracted Work Order Information</h3>
                <p className="text-xs text-slate-500">
                  Review and verify extracted fields before saving to SQLite database
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Pydantic Validated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer_name || ''}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="e.g. Ravi"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none ${
                    !formData.customer_name && transcriptText
                      ? 'border-amber-400 bg-amber-50/40 focus:border-amber-500'
                      : 'border-slate-200 focus:border-violet-accent'
                  }`}
                />
                {!formData.customer_name && transcriptText && (
                  <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Customer name missing from speech; please enter manually.
                  </p>
                )}
              </div>

              {/* Vehicle / Asset */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vehicle / Asset Model
                </label>
                <input
                  type="text"
                  value={formData.vehicle_or_asset || ''}
                  onChange={(e) => setFormData({ ...formData, vehicle_or_asset: e.target.value })}
                  placeholder="e.g. Bike, Honda Activa, Ceiling Fan"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-violet-accent focus:outline-none"
                />
              </div>

              {/* Service Type */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service Type <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.service_type || ''}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  placeholder="e.g. Brake pad replacement"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-violet-accent focus:outline-none"
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Issue Details
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed instructions or reported problems"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-violet-accent focus:outline-none"
                />
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Promised Delivery Date
                </label>
                <input
                  type="text"
                  value={formData.delivery_date || ''}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  placeholder="e.g. Tomorrow, Repu, 10th Nov"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-violet-accent focus:outline-none"
                />
              </div>

              {/* Delivery Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Promised Delivery Time
                </label>
                <input
                  type="text"
                  value={formData.delivery_time || ''}
                  onChange={(e) => setFormData({ ...formData, delivery_time: e.target.value })}
                  placeholder="e.g. evening, 5 PM, morning"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-violet-accent focus:outline-none"
                />
              </div>

              {/* Estimated Cost */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estimated Cost (INR ₹)
                </label>
                <input
                  type="number"
                  value={formData.estimated_cost !== null && formData.estimated_cost !== undefined ? formData.estimated_cost : ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimated_cost: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="e.g. 1500"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-violet-accent focus:outline-none"
                />
              </div>

              {/* Order Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-violet-accent focus:outline-none bg-white"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSaveOrder}
                  disabled={recordingState === 'saving' || !formData.customer_name}
                  className="inline-flex items-center space-x-2 rounded-xl bg-violet-accent px-5 py-3 text-xs font-bold text-white shadow-md shadow-violet-accent/25 hover:bg-violet-dark transition-all disabled:opacity-50"
                >
                  {recordingState === 'saving' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Confirm & Save Work Order</span>
                </button>

                {/* Spoken Confirmation Generator */}
                <button
                  onClick={() => handlePlayConfirmation()}
                  disabled={isSynthesizing || (!savedOrder && !formData.customer_name)}
                  className="inline-flex items-center space-x-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-all disabled:opacity-50"
                >
                  {isSynthesizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                  <span>
                    {isTimbreConnected ? 'Play Telugu Confirmation' : 'Play Telugu Confirmation (Timbre Pending)'}
                  </span>
                </button>
              </div>

              {savedOrder && (
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Saved: {savedOrder.order_number}</span>
                </div>
              )}
            </div>

            {/* Hidden audio element for spoken confirmation playback */}
            {ttsAudioUrl && (
              <audio ref={ttsAudioRef} src={ttsAudioUrl} className="hidden" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
