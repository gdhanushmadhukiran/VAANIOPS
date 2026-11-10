import React from 'react';
import { LayoutDashboard, Mic, ClipboardList, Settings, Sparkles, X, Server, Radio, Volume2 } from 'lucide-react';
import { GnaniHealthResponse } from '../types';

export type NavTab = 'dashboard' | 'workspace' | 'intelligence' | 'orders' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isBackendConnected: boolean;
  gnaniHealth: GnaniHealthResponse | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpenMobile,
  onCloseMobile,
  isBackendConnected,
  gnaniHealth,
}) => {
  const isPrismaConnected =
    gnaniHealth?.prisma_status?.status === 'ready' ||
    gnaniHealth?.prisma_status?.status === 'AUTHENTICATION_SUCCESS';
  const isTimbreConnected =
    gnaniHealth?.timbre_status?.status === 'ready' ||
    gnaniHealth?.timbre_status?.status === 'AUTHENTICATION_SUCCESS';
  const isEvonConnected =
    gnaniHealth?.evon_status?.status === 'CONNECTED' ||
    gnaniHealth?.evon_status?.status === 'INFERENCE_SUCCESSFUL';
  const isEvonScopePending = gnaniHealth?.evon_status?.status === 'SCOPE_NOT_ALLOWED';

  const getPrismaLabel = () => {
    if (isPrismaConnected) return 'CONNECTED';
    if (!gnaniHealth?.api_key_configured || gnaniHealth?.prisma_status?.status === 'missing_key' || gnaniHealth?.prisma_status?.status === 'KEY_MISSING') return 'NOT CONFIGURED';
    if (gnaniHealth?.prisma_status?.status === 'unauthorized' || gnaniHealth?.prisma_status?.status === 'AUTHENTICATION_FAILED') return 'UNAUTHORIZED';
    return 'NOT CONFIGURED';
  };

  const getTimbreLabel = () => {
    if (isTimbreConnected) return 'CONNECTED';
    if (!gnaniHealth?.api_key_configured || gnaniHealth?.timbre_status?.status === 'missing_key' || gnaniHealth?.timbre_status?.status === 'KEY_MISSING') return 'NOT CONFIGURED';
    if (gnaniHealth?.timbre_status?.status === 'unauthorized' || gnaniHealth?.timbre_status?.status === 'AUTHENTICATION_FAILED') return 'UNAUTHORIZED';
    return 'NOT CONFIGURED';
  };

  const getEvonLabel = () => {
    if (isEvonConnected) return 'CONNECTED';
    if (isEvonScopePending) return 'SCOPE PENDING';
    if (!gnaniHealth?.api_key_configured || gnaniHealth?.evon_status?.status === 'KEY_MISSING') return 'NOT CONFIGURED';
    if (gnaniHealth?.evon_status?.status === 'AUTHENTICATION_FAILED') return 'AUTH FAILED';
    return 'STANDBY';
  };

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      teluguLabel: 'డాష్‌బోర్డ్',
      icon: LayoutDashboard,
    },
    {
      id: 'workspace' as NavTab,
      label: 'Voice Workspace',
      teluguLabel: 'వాయిస్ వర్క్‌స్పేస్',
      icon: Mic,
      badge: isPrismaConnected ? 'Prisma v2.5' : 'Demo / Studio',
    },
    {
      id: 'intelligence' as NavTab,
      label: 'Intelligence Studio',
      teluguLabel: 'ఇంటెలిజెన్స్ స్టూడియో',
      icon: Sparkles,
      badge: 'Evon v3.3',
    },
    {
      id: 'orders' as NavTab,
      label: 'All Orders',
      teluguLabel: 'అన్ని ఆర్డర్లు',
      icon: ClipboardList,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings & APIs',
      teluguLabel: 'సెట్టింగ్స్',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col bg-navy-900 text-slate-200 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between border-b border-navy-700/60 px-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-accent to-purple-600 shadow-lg shadow-violet-accent/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-black tracking-tight text-white">Vaani<span className="text-violet-bright">Ops</span></span>
                <span className="rounded bg-violet-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-bright">v2.5</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">తెలుగు Voice Business OS</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-navy-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-violet-accent text-white shadow-md shadow-violet-accent/30'
                    : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <div className="text-left">
                    <div className="leading-tight">{item.label}</div>
                    <div className={`text-[10px] ${isActive ? 'text-violet-200' : 'text-slate-500'}`}>
                      {item.teluguLabel}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : isPrismaConnected
                        ? 'bg-navy-800 text-violet-bright border border-violet-bright/30'
                        : 'bg-navy-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 3 Separate Connection States in Bottom Card */}
        <div className="p-4">
          <div className="rounded-xl border border-navy-700/60 bg-navy-800/80 p-3.5 text-xs space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Connection Status</span>
              <span className="text-[9px] text-slate-500 font-normal">Real-time</span>
            </div>

            {/* 1. Backend Status */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center space-x-1.5 text-slate-300">
                <Server className="h-3 w-3 text-slate-400" />
                <span>Backend</span>
              </span>
              <span className="flex items-center space-x-1 font-bold">
                <span className={`h-1.5 w-1.5 rounded-full ${isBackendConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                <span className={isBackendConnected ? 'text-emerald-400' : 'text-rose-400'}>
                  {isBackendConnected ? 'CONNECTED' : 'OFFLINE'}
                </span>
              </span>
            </div>

            {/* 2. Prisma STT Status */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center space-x-1.5 text-slate-300">
                <Radio className="h-3 w-3 text-slate-400" />
                <span>Prisma STT</span>
              </span>
              <span className="flex items-center space-x-1 font-bold">
                <span className={`h-1.5 w-1.5 rounded-full ${isPrismaConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={isPrismaConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {getPrismaLabel()}
                </span>
              </span>
            </div>

            {/* 3. Timbre TTS Status */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center space-x-1.5 text-slate-300">
                <Volume2 className="h-3 w-3 text-slate-400" />
                <span>Timbre TTS</span>
              </span>
              <span className="flex items-center space-x-1 font-bold">
                <span className={`h-1.5 w-1.5 rounded-full ${isTimbreConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={isTimbreConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {getTimbreLabel()}
                </span>
              </span>
            </div>

            {/* 4. Evon v3.3 Reasoning Status */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center space-x-1.5 text-slate-300">
                <Sparkles className="h-3 w-3 text-violet-400" />
                <span>Evon v3.3</span>
              </span>
              <span className="flex items-center space-x-1 font-bold">
                <span className={`h-1.5 w-1.5 rounded-full ${isEvonConnected ? 'bg-emerald-400' : isEvonScopePending ? 'bg-indigo-400' : 'bg-amber-400'}`} />
                <span className={isEvonConnected ? 'text-emerald-400' : isEvonScopePending ? 'text-indigo-400' : 'text-amber-400'}>
                  {getEvonLabel()}
                </span>
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

