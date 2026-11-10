import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Server,
  Key,
  Volume2,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Radio,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { GnaniHealthResponse, BackendHealthResponse } from '../types';
import { api } from '../services/api';

interface SettingsViewProps {
  backendHealth: BackendHealthResponse | null;
  gnaniHealth: GnaniHealthResponse | null;
  isLoading: boolean;
  onRefreshHealth: () => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  backendHealth,
  gnaniHealth,
  isLoading,
  onRefreshHealth,
  selectedVoice,
  onVoiceChange,
}) => {
  const [testTtsText, setTestTtsText] = useState('నమస్కారం! వాణీ ఆప్స్ వాయిస్ సిస్టమ్ సిద్ధంగా ఉంది.');
  const [isTestingTts, setIsTestingTts] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const teluguVoices = ['Kaveri', 'Ananya', 'Chaitanya', 'Venu'];
  const englishVoices = ['Maya', 'Aarav', 'Pooja', 'Rohan'];

  const handleTestSynthesis = async () => {
    try {
      setIsTestingTts(true);
      setTestError(null);
      const url = await api.synthesizeSpeech(
        testTtsText,
        selectedVoice,
        'te-IN',
        1.0
      );
      setTestAudioUrl(url);
    } catch (err: unknown) {
      const error = err as Error;
      setTestError(error.message);
    } finally {
      setIsTestingTts(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
      case 'healthy':
      case 'AUTHENTICATION_SUCCESS':
      case 'CONNECTED':
      case 'INFERENCE_SUCCESSFUL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> CONNECTED
          </span>
        );
      case 'MODEL_LOADED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
            MODEL LOADED
          </span>
        );
      case 'GPU_SERVER_AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
            GPU ONLINE
          </span>
        );
      case 'INFERENCE_FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
            INFERENCE FAILED
          </span>
        );
      case 'MODEL_UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
            HOST OFFLINE
          </span>
        );
      case 'SCOPE_NOT_ALLOWED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
            SCOPE PENDING
          </span>
        );
      case 'missing_key':
      case 'no_key':
      case 'KEY_MISSING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            NOT CONFIGURED
          </span>
        );
      case 'AUTHENTICATION_FAILED':
      case 'unauthorized':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
            AUTH FAILED
          </span>
        );
      case 'KEY_PRESENT':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
            KEY PRESENT
          </span>
        );
      case 'credits_unavailable':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
            CREDITS EXHAUSTED
          </span>
        );
      case 'unreachable':
      case 'service_unavailable':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
            SERVICE UNREACHABLE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">System & API Diagnostics</h2>
          <p className="text-xs text-slate-500">Live inspection of FastAPI backend and official Gnani vachana endpoints</p>
        </div>
        <button
          onClick={onRefreshHealth}
          disabled={isLoading}
          className="inline-flex items-center space-x-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Run Diagnostic Check</span>
        </button>
      </div>

      {/* Diagnostics Grid: Backend, Prisma, Timbre, Evon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Backend FastAPI Status */}
        <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Server className="h-5 w-5" />
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                backendHealth?.status === 'healthy'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {backendHealth?.status === 'healthy' ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">FastAPI Backend</h3>
          <p className="text-xs text-slate-500 mt-1">Python 3.12 + SQLite</p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div>Environment: <span className="font-semibold">{backendHealth?.environment || 'unknown'}</span></div>
            <div>Health Route: <span className="font-mono text-slate-800">/api/health</span></div>
            <div>Status: <span className="font-bold text-emerald-700">Backend: CONNECTED</span></div>
          </div>
        </div>

        {/* Prisma v2.5 STT Status */}
        <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-accent">
              <Radio className="h-5 w-5" />
            </div>
            {getStatusBadge(gnaniHealth?.prisma_status.status || 'unknown')}
          </div>
          <h3 className="text-sm font-bold text-slate-900">Gnani Prisma v2.5</h3>
          <p className="text-xs text-slate-500 mt-1">Speech-to-Text Endpoint</p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div>Endpoint: <span className="font-mono text-slate-800 text-[10px]">api.vachana.ai/stt/v3</span></div>
            <div>
              Status: <span className="font-bold text-slate-800">
                Prisma: {gnaniHealth?.prisma_status?.status === 'ready' || gnaniHealth?.prisma_status?.status === 'AUTHENTICATION_SUCCESS' ? 'CONNECTED' : 'NOT CONFIGURED'}
              </span>
            </div>
            <div className="line-clamp-2 text-slate-500">{gnaniHealth?.prisma_status.details || 'Awaiting probe'}</div>
          </div>
        </div>

        {/* Timbre v2.5 TTS Status */}
        <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Volume2 className="h-5 w-5" />
            </div>
            {getStatusBadge(gnaniHealth?.timbre_status.status || 'unknown')}
          </div>
          <h3 className="text-sm font-bold text-slate-900">Gnani Timbre v2.5</h3>
          <p className="text-xs text-slate-500 mt-1">Text-to-Speech Endpoint</p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div>Endpoint: <span className="font-mono text-slate-800 text-[10px]">/api/v1/tts/inference</span></div>
            <div>
              Status: <span className="font-bold text-slate-800">
                Timbre: {gnaniHealth?.timbre_status?.status === 'ready' || gnaniHealth?.timbre_status?.status === 'AUTHENTICATION_SUCCESS' ? 'CONNECTED' : 'NOT CONFIGURED'}
              </span>
            </div>
            <div className="line-clamp-2 text-slate-500">{gnaniHealth?.timbre_status.details || 'Awaiting probe'}</div>
          </div>
        </div>

        {/* Evon v3.3 Reasoning Status */}
        <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
            {getStatusBadge(gnaniHealth?.evon_status?.status || 'SCOPE_NOT_ALLOWED')}
          </div>
          <h3 className="text-sm font-bold text-slate-900">Gnani Evon v3.3</h3>
          <p className="text-xs text-slate-500 mt-1">Indic Reasoning (30B MoE)</p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div>Model: <span className="font-mono text-slate-800 text-[10px]">evon-v3.3-30B-A3B</span></div>
            <div>
              Status: <span className="font-bold text-slate-800">
                {gnaniHealth?.evon_status?.status === 'CONNECTED' ? 'CONNECTED' : gnaniHealth?.evon_status?.status === 'SCOPE_NOT_ALLOWED' ? 'SCOPE PENDING' : 'STANDBY'}
              </span>
            </div>
            <div className="line-clamp-2 text-slate-500">{gnaniHealth?.evon_status?.details || 'Gateway scope verification'}</div>
          </div>
        </div>
      </div>

      {/* API Key Details Card */}
      <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Gnani API Key Configuration</h3>
            <p className="text-xs text-slate-500">Security: Raw secret keys are never exposed to the browser</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <div>
            <span className="font-semibold text-slate-500">Configuration Status:</span>
            <div className="mt-1 font-bold text-slate-900">
              {gnaniHealth?.api_key_configured ? (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Configured in Backend Environment
                </span>
              ) : (
                <span className="text-rose-700 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Not Configured (Add to backend/.env)
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="font-semibold text-slate-500">Key Masked Preview:</span>
            <div className="mt-1 font-mono font-bold text-slate-800">
              {gnaniHealth?.api_key_preview || 'None (Variable Empty)'}
            </div>
          </div>
        </div>
      </div>

      {/* Voice Selection & Live TTS Test Bench */}
      <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-accent">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Voice Options (Candidate Catalog)</h3>
            <p className="text-xs text-slate-500">
              Candidate voices for order confirmation. Availability is subject to verification against your current Gnani AI API tier.
            </p>
          </div>
        </div>

        {/* Telugu Voices */}
        <div className="space-y-3 mb-6">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Telugu (te-IN) Candidate Voices
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {teluguVoices.map((voice) => (
              <button
                key={voice}
                onClick={() => {
                  onVoiceChange(voice);
                  setTestError(null);
                }}
                className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-bold transition-all ${
                  selectedVoice === voice
                    ? 'border-violet-accent bg-violet-50 text-violet-accent shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{voice}</span>
                {selectedVoice === voice && <CheckCircle2 className="h-4 w-4 text-violet-accent" />}
              </button>
            ))}
          </div>
        </div>

        {/* English Voices */}
        <div className="space-y-3 mb-6">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            English India (en-IN) Candidate Voices
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {englishVoices.map((voice) => (
              <button
                key={voice}
                onClick={() => {
                  onVoiceChange(voice);
                  setTestError(null);
                }}
                className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-bold transition-all ${
                  selectedVoice === voice
                    ? 'border-violet-accent bg-violet-50 text-violet-accent shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{voice}</span>
                {selectedVoice === voice && <CheckCircle2 className="h-4 w-4 text-violet-accent" />}
              </button>
            ))}
          </div>
        </div>

        {/* Live TTS Synthesizer Test */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <label className="block text-xs font-bold text-slate-800">
            Synthesize Test Speech
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={testTtsText}
              onChange={(e) => setTestTtsText(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-violet-accent focus:outline-none"
            />
            <button
              onClick={handleTestSynthesis}
              disabled={isTestingTts}
              className="inline-flex items-center justify-center space-x-2 rounded-xl bg-violet-accent px-4 py-2 text-xs font-bold text-white hover:bg-violet-dark transition-all disabled:opacity-50"
            >
              {isTestingTts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              <span>Test Voice ({selectedVoice})</span>
            </button>
          </div>

          {testAudioUrl && (
            <div className="pt-2">
              <audio controls autoPlay src={testAudioUrl} className="w-full h-8" />
            </div>
          )}

          {testError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                <span>Voice Verification Notice ({selectedVoice})</span>
              </div>
              <p className="leading-relaxed">{testError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Integration Guide Box */}
      <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-3">
          <BookOpen className="h-5 w-5 text-violet-accent" />
          <h3 className="text-base font-bold text-slate-900">Gnani API Setup Reference</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          To obtain credentials, visit <span className="font-semibold text-slate-900">vachana.ai</span> and register for an API key. Add your key to <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800 font-mono">backend/.env</code> as <code className="font-mono text-violet-accent">GNANI_API_KEY</code> or in your Render service environment variables.
        </p>
      </div>
    </div>
  );
};
