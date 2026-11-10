import React from 'react';
import { Menu, Mic, Radio, Server, Volume2, Sparkles } from 'lucide-react';
import { NavTab } from './Sidebar';
import { GnaniHealthResponse } from '../types';

interface HeaderProps {
  activeTab: NavTab;
  onOpenMobile: () => void;
  onNewVoiceOrder: () => void;
  isBackendConnected: boolean;
  gnaniHealth: GnaniHealthResponse | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobile,
  onNewVoiceOrder,
  isBackendConnected,
  gnaniHealth,
}) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Business Overview',
          subtitle: 'Real-time metrics, workshop activity & recent orders',
        };
      case 'workspace':
        return {
          title: 'Voice Operations Studio',
          subtitle: 'Speak in Telugu or English to record & create work orders instantly',
        };
      case 'intelligence':
        return {
          title: 'Gnani Evon v3.3 Intelligence Studio',
          subtitle: 'Indic reasoning engine, contextual memory & conversational business assistant',
        };
      case 'orders':
        return {
          title: 'Work Orders Manager',
          subtitle: 'Track, filter, and update customer service jobs',
        };
      case 'settings':
        return {
          title: 'API Status & Configuration',
          subtitle: 'Prisma v2.5, Timbre v2.5 & Evon v3.3 endpoints and diagnostics',
        };
    }
  };

  const { title, subtitle } = getTabTitle();

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

  const prismaStatusLabel = isPrismaReady ? 'CONNECTED' : 'NOT CONFIGURED';
  const timbreStatusLabel = isTimbreReady ? 'CONNECTED' : 'NOT CONFIGURED';
  const evonStatusLabel = isEvonConnected
    ? 'CONNECTED'
    : isEvonScopePending
    ? 'SCOPE PENDING'
    : 'STANDBY';

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-surface-border bg-white/95 px-6 backdrop-blur-md">
      <div className="flex items-center space-x-4">
        <button
          onClick={onOpenMobile}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 hidden sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Connection States Pill Group */}
        <div className="hidden lg:flex items-center space-x-2 bg-slate-50 border border-slate-200/80 rounded-full px-3 py-1.5 text-xs">
          {/* Backend */}
          <div className="flex items-center space-x-1.5 pr-2 border-r border-slate-200">
            <Server className="h-3 w-3 text-slate-400" />
            <span className="text-slate-600 font-medium">Backend:</span>
            <span className={`font-bold ${isBackendConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
              {isBackendConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>

          {/* Prisma STT */}
          <div className="flex items-center space-x-1.5 pr-2 border-r border-slate-200">
            <Radio className="h-3 w-3 text-slate-400" />
            <span className="text-slate-600 font-medium">Prisma:</span>
            <span className={`font-bold ${isPrismaReady ? 'text-emerald-700' : 'text-amber-700'}`}>
              {prismaStatusLabel}
            </span>
          </div>

          {/* Timbre TTS */}
          <div className="flex items-center space-x-1.5 pr-2 border-r border-slate-200">
            <Volume2 className="h-3 w-3 text-slate-400" />
            <span className="text-slate-600 font-medium">Timbre:</span>
            <span className={`font-bold ${isTimbreReady ? 'text-emerald-700' : 'text-amber-700'}`}>
              {timbreStatusLabel}
            </span>
          </div>

          {/* Evon v3.3 Reasoning */}
          <div className="flex items-center space-x-1.5">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span className="text-slate-600 font-medium">Evon:</span>
            <span className={`font-bold ${isEvonConnected ? 'text-emerald-700' : isEvonScopePending ? 'text-indigo-600' : 'text-amber-700'}`}>
              {evonStatusLabel}
            </span>
          </div>
        </div>

        {/* Action Button: Quick Record */}
        {activeTab !== 'workspace' && (
          <button
            onClick={onNewVoiceOrder}
            className="flex items-center space-x-2 rounded-xl bg-violet-accent px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-violet-accent/25 hover:bg-violet-dark transition-all"
          >
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Voice Order</span>
            <Radio className="h-3.5 w-3.5 animate-pulse text-violet-200" />
          </button>
        )}
      </div>
    </header>
  );
};

