import React, { useState } from 'react';
import {
  X,
  Volume2,
  FileText,
  Save,
  Loader2,
  IndianRupee,
} from 'lucide-react';
import { WorkOrder, OrderStatus } from '../types';
import { api } from '../services/api';

interface OrderDetailsModalProps {
  order: WorkOrder | null;
  onClose: () => void;
  onOrderUpdated: (updated: WorkOrder) => void;
  selectedVoice?: string;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  onClose,
  onOrderUpdated,
  selectedVoice = 'Kaveri',
}) => {
  if (!order) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: order.customer_name,
    service_type: order.service_type,
    vehicle_or_asset: order.vehicle_or_asset || '',
    description: order.description || '',
    delivery_date: order.delivery_date || '',
    delivery_time: order.delivery_time || '',
    estimated_cost: order.estimated_cost !== null ? String(order.estimated_cost) : '',
    status: order.status,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMsg(null);
      const updated = await api.updateOrder(order.id, {
        customer_name: formData.customer_name.trim(),
        service_type: formData.service_type.trim(),
        vehicle_or_asset: formData.vehicle_or_asset.trim() || null,
        description: formData.description.trim() || null,
        delivery_date: formData.delivery_date.trim() || null,
        delivery_time: formData.delivery_time.trim() || null,
        estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : null,
        status: formData.status as OrderStatus,
      });
      onOrderUpdated(updated);
      setIsEditing(false);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Failed to update order.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlayVoiceSummary = async () => {
    try {
      setIsSynthesizing(true);
      setErrorMsg(null);
      const text =
        order.language_code === 'te-IN'
          ? `${order.customer_name} గారి ${order.service_type} ఆర్డర్. స్టేటస్: ${order.status}. డెలివరీ: ${order.delivery_date || 'రేపు'}.`
          : `Order for ${order.customer_name}: ${order.service_type}. Status is ${order.status}.`;

      const url = await api.synthesizeSpeech(text, selectedVoice, order.language_code, 1.0);
      setAudioUrl(url);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(`Voice synthesis error: ${error.message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4 bg-slate-50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-base font-extrabold text-slate-900">
                {order.order_number}
              </span>
              <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                {order.language_code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {new Date(order.created_at).toLocaleDateString()} at{' '}
              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {isEditing ? 'Cancel Edit' : 'Edit Order'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 text-rose-800 rounded-xl border border-rose-200">
              {errorMsg}
            </div>
          )}

          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer Name</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-violet-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Vehicle / Asset</label>
                <input
                  type="text"
                  value={formData.vehicle_or_asset}
                  onChange={(e) => setFormData({ ...formData, vehicle_or_asset: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-violet-accent focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Service Type</label>
                <input
                  type="text"
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-violet-accent focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-violet-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Delivery Date</label>
                <input
                  type="text"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-violet-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Delivery Time</label>
                <input
                  type="text"
                  value={formData.delivery_time}
                  onChange={(e) => setFormData({ ...formData, delivery_time: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-violet-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Estimated Cost (INR)</label>
                <input
                  type="number"
                  value={formData.estimated_cost}
                  onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-violet-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as OrderStatus })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-violet-accent focus:outline-none bg-white"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-400 font-medium">Customer:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{order.customer_name}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-400 font-medium">Vehicle / Asset:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {order.vehicle_or_asset || 'Not specified'}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                <span className="text-slate-400 font-medium">Service Needed:</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{order.service_type}</div>
                {order.description && (
                  <p className="mt-2 text-slate-600 leading-relaxed">{order.description}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-400 font-medium">Delivery:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {order.delivery_date || 'Pending'}
                  </div>
                  {order.delivery_time && (
                    <div className="text-[11px] text-slate-500 capitalize">{order.delivery_time}</div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-400 font-medium">Est. Cost:</span>
                  <div className="font-bold text-slate-900 font-mono mt-0.5 flex items-center">
                    {order.estimated_cost ? (
                      <>
                        <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
                        <span>{order.estimated_cost.toLocaleString('en-IN')}</span>
                      </>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-400 font-medium">Current Status:</span>
                  <div className="mt-0.5 font-bold capitalize text-violet-accent">
                    {order.status}
                  </div>
                </div>
              </div>

              {/* Raw Transcript */}
              {order.original_transcript && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-700 mb-1">
                    <FileText className="h-3.5 w-3.5 text-violet-accent" />
                    <span>Original Prisma Voice Transcript:</span>
                  </div>
                  <p className="text-slate-600 italic">"{order.original_transcript}"</p>
                </div>
              )}
            </div>
          )}

          {/* Audio Player for Voice Summary */}
          {audioUrl && (
            <div className="p-3 bg-violet-50 rounded-xl border border-violet-100 space-y-1">
              <span className="text-xs font-bold text-violet-800">Spoken Telugu Confirmation:</span>
              <audio controls autoPlay src={audioUrl} className="w-full h-8" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-surface-border px-6 py-4 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handlePlayVoiceSummary}
            disabled={isSynthesizing}
            className="inline-flex items-center space-x-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-50 transition-all disabled:opacity-50"
          >
            {isSynthesizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
            <span>Play Spoken Summary</span>
          </button>

          {isEditing && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center space-x-2 rounded-xl bg-violet-accent px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-accent/25 hover:bg-violet-dark transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Changes</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
