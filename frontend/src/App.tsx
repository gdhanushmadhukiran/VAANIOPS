import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { VoiceWorkspace } from './components/VoiceWorkspace';
import { OrdersView } from './components/OrdersView';
import { SettingsView } from './components/SettingsView';
import { IntelligenceStudio } from './components/IntelligenceStudio';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { api } from './services/api';
import {
  WorkOrder,
  StatsResponse,
  GnaniHealthResponse,
  BackendHealthResponse,
  OrderStatus,
  VoiceActivityItem,
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core Data
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null);
  const [gnaniHealth, setGnaniHealth] = useState<GnaniHealthResponse | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kaveri');

  // Loading States
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Selected Order for Details Modal
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);

  // Voice Quick Prompt passing
  const [quickPrompt, setQuickPrompt] = useState<string>('');

  // Voice Activity Feed items (derived from actual database records)
  const [voiceActivities, setVoiceActivities] = useState<VoiceActivityItem[]>([]);

  const fetchHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const bh = await api.getHealth();
      setBackendHealth(bh);
    } catch {
      setBackendHealth(null);
    }

    try {
      const gh = await api.getGnaniHealth();
      setGnaniHealth(gh);
    } catch {
      setGnaniHealth(null);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const fetched = await api.getOrders();
      setOrders(fetched);

      // Populate voice activities strictly from actual database records
      const actualActivities: VoiceActivityItem[] = fetched
        .filter((o) => o.original_transcript && o.original_transcript.trim().length > 0)
        .map((o) => ({
          id: `db-${o.id}`,
          timestamp:
            new Date(o.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) +
            ' ' +
            new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          transcript: o.original_transcript || '',
          customerName: o.customer_name,
          serviceType: o.service_type,
          languageCode: o.language_code,
          model: o.language_code === 'te-IN' ? 'Telugu Voice Order' : 'English Voice Order',
          status: 'saved',
        }));
      setVoiceActivities(actualActivities);
    } catch {
      // ignore
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const st = await api.getStats();
      setStats(st);
    } catch {
      // ignore
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchOrders();
    fetchStats();
  }, [fetchHealth, fetchOrders, fetchStats]);

  const handleOrderSaved = (newOrder: WorkOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
    fetchStats();

    // Append to voice activity
    const activityItem: VoiceActivityItem = {
      id: `act-${Date.now()}`,
      timestamp: 'Just now',
      transcript: newOrder.original_transcript || `${newOrder.customer_name} service order`,
      customerName: newOrder.customer_name,
      serviceType: newOrder.service_type,
      languageCode: newOrder.language_code,
      model: 'prisma-v2.5',
      status: 'saved',
    };
    setVoiceActivities((prev) => [activityItem, ...prev]);
  };

  const handleUpdateStatus = async (orderId: number, status: OrderStatus) => {
    const updated = await api.updateOrder(orderId, { status });
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(updated);
    }
    fetchStats();
  };

  const handleStartVoiceWithPrompt = (promptText?: string) => {
    if (promptText) {
      setQuickPrompt(promptText);
    }
    setActiveTab('workspace');
  };

  return (
    <div className="flex min-h-screen bg-surface-warm font-sans text-slate-800">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isBackendConnected={backendHealth?.status === 'healthy'}
        gnaniHealth={gnaniHealth}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          activeTab={activeTab}
          onOpenMobile={() => setIsMobileMenuOpen(true)}
          onNewVoiceOrder={() => setActiveTab('workspace')}
          isBackendConnected={backendHealth?.status === 'healthy'}
          gnaniHealth={gnaniHealth}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="mx-auto max-w-7xl">
            {activeTab === 'dashboard' && (
              <DashboardView
                stats={stats}
                isLoading={isLoadingStats}
                onRefresh={() => {
                  fetchStats();
                  fetchOrders();
                  fetchHealth();
                }}
                onSelectOrder={setSelectedOrder}
                onStartVoice={handleStartVoiceWithPrompt}
                voiceActivities={voiceActivities}
                isBackendConnected={backendHealth?.status === 'healthy'}
                gnaniHealth={gnaniHealth}
              />
            )}

            {activeTab === 'workspace' && (
              <VoiceWorkspace
                onOrderSaved={handleOrderSaved}
                initialPrompt={quickPrompt}
                onClearInitialPrompt={() => setQuickPrompt('')}
                selectedVoice={selectedVoice}
                gnaniHealth={gnaniHealth}
              />
            )}

            {activeTab === 'intelligence' && (
              <IntelligenceStudio
                gnaniHealth={gnaniHealth}
                onOrderCreated={handleOrderSaved}
                onOpenVoiceWorkspace={() => setActiveTab('workspace')}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersView
                orders={orders}
                isLoading={isLoadingOrders}
                onRefresh={fetchOrders}
                onSelectOrder={setSelectedOrder}
                onUpdateStatus={handleUpdateStatus}
                onNewVoiceOrder={() => setActiveTab('workspace')}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                backendHealth={backendHealth}
                gnaniHealth={gnaniHealth}
                isLoading={isLoadingHealth}
                onRefreshHealth={fetchHealth}
                selectedVoice={selectedVoice}
                onVoiceChange={setSelectedVoice}
              />
            )}
          </div>
        </main>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderUpdated={(updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          setSelectedOrder(updated);
          fetchStats();
        }}
        selectedVoice={selectedVoice}
      />
    </div>
  );
};

