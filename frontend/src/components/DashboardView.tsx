import React from 'react';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Calendar,
  Mic,
  ArrowRight,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Server,
  Radio,
  Volume2,
} from 'lucide-react';
import { StatsResponse, VoiceActivityItem, WorkOrder, GnaniHealthResponse } from '../types';

interface DashboardViewProps {
  stats: StatsResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSelectOrder: (order: WorkOrder) => void;
  onStartVoice: (suggestedText?: string) => void;
  voiceActivities: VoiceActivityItem[];
  isBackendConnected: boolean;
  gnaniHealth: GnaniHealthResponse | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  isLoading,
  onRefresh,
  onSelectOrder,
  onStartVoice,
  voiceActivities,
  isBackendConnected,
  gnaniHealth,
}) => {
  const isPrismaReady =
    gnaniHealth?.prisma_status?.status === 'AUTHENTICATION_SUCCESS' ||
    gnaniHealth?.prisma_status?.status === 'ready';
  const isTimbreReady =
    gnaniHealth?.timbre_status?.status === 'AUTHENTICATION_SUCCESS' ||
    gnaniHealth?.timbre_status?.status === 'ready';
  const isEvonConnected =
    gnaniHealth?.evon_status?.status === 'CONNECTED' ||
    gnaniHealth?.evon_status?.status === 'INFERENCE_SUCCESSFUL';
  const isEvonScopePending = gnaniHealth?.evon_status?.status === 'SCOPE_NOT_ALLOWED';

  const prismaLabel = isPrismaReady ? 'CONNECTED' : 'NOT CONFIGURED';
  const timbreLabel = isTimbreReady ? 'CONNECTED' : 'NOT CONFIGURED';
  const evonLabel = isEvonConnected ? 'CONNECTED' : isEvonScopePending ? 'SCOPE PENDING' : 'ACTIVE';
  const statCards = [
    {
      title: 'Total Work Orders',
      telugu: 'మొత్తం ఆర్డర్లు',
      value: stats?.total_orders ?? 0,
      icon: ClipboardList,
      color: 'from-blue-600 to-indigo-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Pending / In Progress',
      telugu: 'పెండింగ్ ఆర్డర్లు',
      value: (stats?.pending_orders ?? 0) + (stats?.in_progress_orders ?? 0),
      icon: Clock,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Completed Orders',
      telugu: 'పూర్తయినవి',
      value: stats?.completed_orders ?? 0,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: "Today's Orders",
      telugu: 'ఈ రోజు ఆర్డర్లు',
      value: stats?.today_orders ?? 0,
      icon: Calendar,
      color: 'from-violet-accent to-purple-600',
      textColor: 'text-violet-accent',
      bgColor: 'bg-violet-50',
    },
  ];

  const quickPrompts = [
    {
      domain: 'Automobile Repair',
      badge: 'బైక్ రిపేర్',
      telugu: 'రవి గారు బైక్ రిపేర్ కోసం ఇచ్చారు. బ్రేక్ ప్యాడ్స్ మార్చాలి. రేపు ఈవెనింగ్ డెలివరీ.',
      english: 'Ravi garu bike repair kosam icharu. Brake pads change cheyyali. Repu evening delivery.',
    },
    {
      domain: 'Electrician Service',
      badge: 'ఎలక్ట్రీషియన్',
      telugu: 'సురేష్ గారి ఇంట్లో ఫ్యాన్ వైరింగ్ ప్రాబ్లమ్. స్విచ్ బోర్డు చెక్ చేయాలి. రేపు మార్నింగ్.',
      english: 'Suresh gari intlo fan wiring problem. Switchboard check cheyyali. Repu morning.',
    },
    {
      domain: 'Plumbing Service',
      badge: 'ప్లంబింగ్',
      telugu: 'వెంకటేష్ గారు పైప్ లీకేజీ రిపేర్ కోసం చెప్పారు. ఈ రోజు సాయంత్రం కంప్లీట్ చేయాలి. ఎస్టిమేట్ 800 రూపాయలు.',
      english: 'Venkatesh garu pipe leakage repair kosam chepparu. Ee roju evening delivery. Estimate 800 rupees.',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Completed</span>;
      case 'in_progress':
        return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">In Progress</span>;
      case 'cancelled':
        return <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">Cancelled</span>;
      default:
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Pending</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 via-navy-800 to-violet-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-violet-200 backdrop-blur-md mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {isPrismaReady && isTimbreReady
                ? 'Gnani AI Prisma v2.5 & Timbre v2.5 Voice Pipeline Connected'
                : 'AI Status: Voice Pipeline Pending Configuration (GNANI_API_KEY Required)'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Speak Naturally. Manage Intelligently.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Local service operations in Telugu and English. Record voice orders directly from your phone or desktop, convert to structured job cards automatically, and verify with audio confirmation.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onStartVoice()}
              className="inline-flex items-center space-x-2 rounded-xl bg-violet-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-accent/40 hover:bg-violet-dark transition-all"
            >
              <Mic className="h-4 w-4" />
              <span>Record Voice Work Order</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center space-x-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Three Separate Connection States Card */}
      <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            System & AI Connection Status
          </span>
          <span className="text-xs text-slate-400">Live Backend Diagnostic</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Backend */}
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex items-center space-x-2.5">
              <Server className="h-4 w-4 text-slate-500" />
              <div>
                <div className="text-xs font-bold text-slate-800">Backend API</div>
                <div className="text-[10px] text-slate-400">FastAPI & SQLite</div>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isBackendConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isBackendConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>

          {/* Prisma STT */}
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex items-center space-x-2.5">
              <Radio className="h-4 w-4 text-violet-accent" />
              <div>
                <div className="text-xs font-bold text-slate-800">Prisma v2.5 STT</div>
                <div className="text-[10px] text-slate-400">Speech Recognition</div>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isPrismaReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {prismaLabel}
            </span>
          </div>

          {/* Timbre TTS */}
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex items-center space-x-2.5">
              <Volume2 className="h-4 w-4 text-emerald-600" />
              <div>
                <div className="text-xs font-bold text-slate-800">Timbre v2.5 TTS</div>
                <div className="text-[10px] text-slate-400">Voice Synthesis</div>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isTimbreReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {timbreLabel}
            </span>
          </div>

          {/* Evon Reasoning */}
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="h-4 w-4 text-violet-accent" />
              <div>
                <div className="text-xs font-bold text-slate-800">Evon v3.3 Reasoning</div>
                <div className="text-[10px] text-slate-400">Context & NLU</div>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isEvonConnected ? 'bg-emerald-100 text-emerald-800' : isEvonScopePending ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {evonLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="rounded-2xl border border-surface-border bg-white p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {card.title}
                  </p>
                  <p className="text-[11px] font-medium text-slate-400">{card.telugu}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.bgColor}`}>
                  <Icon className={`h-6 w-6 ${card.textColor}`} />
                </div>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {card.value}
                </span>
                <span className="ml-2 text-xs font-medium text-slate-400">orders</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Telugu Voice Scenarios */}
      <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900">Spoken Telugu Scenarios</h3>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                SAMPLE DATA
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Sample test phrases for demonstration. Click 'Use In Workspace' to test voice or demo extraction.
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isPrismaReady
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {isPrismaReady ? 'Prisma v2.5 Connected' : 'Prisma: NOT CONFIGURED (Demo Mode)'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickPrompts.map((p, idx) => (
            <div
              key={idx}
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 hover:border-violet-accent/60 hover:bg-violet-50/20 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">{p.domain}</span>
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                    {p.badge}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-700 leading-relaxed italic mb-1.5 font-sans">
                  "{p.english}"
                </p>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  "{p.telugu}"
                </p>
              </div>
              <button
                onClick={() => onStartVoice(p.english)}
                className="mt-4 inline-flex items-center space-x-1.5 text-xs font-semibold text-violet-accent group-hover:text-violet-dark"
              >
                <span>Use In Workspace</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Recent Orders & Voice Activity */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Orders Table (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-surface-border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-border p-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Work Orders</h3>
              <p className="text-xs text-slate-500">Latest jobs captured via voice and saved to SQLite</p>
            </div>
            <button
              onClick={onRefresh}
              className="text-xs font-semibold text-violet-accent hover:text-violet-dark"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            {stats?.recent_orders && stats.recent_orders.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-surface-border">
                  <tr>
                    <th className="px-5 py-3.5">Order #</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Service</th>
                    <th className="px-5 py-3.5">Delivery</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border font-medium">
                  {stats.recent_orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">
                        {order.order_number}
                      </td>
                      <td className="px-5 py-4 text-slate-800">
                        <div className="font-semibold">{order.customer_name}</div>
                        {order.vehicle_or_asset && (
                          <div className="text-[11px] text-slate-500">{order.vehicle_or_asset}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {order.service_type}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <div>{order.delivery_date || 'Not set'}</div>
                        {order.delivery_time && (
                          <div className="text-[11px] text-slate-400 capitalize">{order.delivery_time}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => onSelectOrder(order)}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-accent transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <AlertCircle className="mx-auto h-9 w-9 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-700">No work orders saved yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click 'Record Voice Work Order' to capture your first order in Telugu or English.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Voice Activity Feed (1 col) */}
        <div className="rounded-2xl border border-surface-border bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-surface-border p-5">
            <h3 className="text-base font-bold text-slate-900">Voice Activity Feed</h3>
            <p className="text-xs text-slate-500">Live speech recognitions & TTS events</p>
          </div>

          <div className="p-5 flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[420px]">
            {voiceActivities.length > 0 ? (
              voiceActivities.map((act) => (
                <div key={act.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                      {act.model}
                    </span>
                    <span className="text-[10px] text-slate-400">{act.timestamp}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-800 line-clamp-2">
                    "{act.transcript}"
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {act.customerName ? `Customer: ${act.customerName}` : 'Auto-extracted'}
                    </span>
                    <span className="capitalize font-semibold text-emerald-600">
                      {act.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                <Mic className="mx-auto h-7 w-7 text-slate-300 mb-2 opacity-50" />
                No voice sessions recorded in this session.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

