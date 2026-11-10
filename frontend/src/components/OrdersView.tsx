import React, { useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  RefreshCw,
  ClipboardList,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import { WorkOrder, OrderStatus } from '../types';

interface OrdersViewProps {
  orders: WorkOrder[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectOrder: (order: WorkOrder) => void;
  onUpdateStatus: (orderId: number, status: OrderStatus) => Promise<void>;
  onNewVoiceOrder: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  isLoading,
  onRefresh,
  onSelectOrder,
  onUpdateStatus,
  onNewVoiceOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm.trim() ||
      order.order_number.toLowerCase().includes(term) ||
      order.customer_name.toLowerCase().includes(term) ||
      order.service_type.toLowerCase().includes(term) ||
      (order.vehicle_or_asset && order.vehicle_or_asset.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    try {
      setUpdatingId(orderId);
      await onUpdateStatus(orderId, newStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-surface-border bg-white p-5 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer, vehicle/asset, service, or order ID..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-800 focus:border-violet-accent focus:outline-none"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-slate-400 hidden md:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-violet-accent focus:outline-none"
          >
            <option value="all">All Statuses ({orders.length})</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Refresh Orders"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="rounded-2xl border border-surface-border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredOrders.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-surface-border">
                <tr>
                  <th className="px-5 py-4">Order ID</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Service & Asset</th>
                  <th className="px-5 py-4">Delivery Timeline</th>
                  <th className="px-5 py-4">Est. Cost</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border font-medium text-slate-700">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">
                      {order.order_number}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{order.customer_name}</div>
                      <div className="text-[11px] text-slate-400">
                        {order.language_code === 'te-IN' ? 'తెలుగు Order' : 'English Order'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-800">{order.service_type}</div>
                      {order.vehicle_or_asset && (
                        <div className="text-[11px] text-slate-500 font-semibold">
                          Asset: {order.vehicle_or_asset}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{order.delivery_date || 'Unspecified'}</span>
                      </div>
                      {order.delivery_time && (
                        <div className="text-[11px] text-slate-400 capitalize pl-5">
                          {order.delivery_time}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-800">
                      {order.estimated_cost !== null && order.estimated_cost !== undefined ? (
                        <div className="flex items-center gap-0.5">
                          <IndianRupee className="h-3 w-3 text-slate-400" />
                          <span>{order.estimated_cost.toLocaleString('en-IN')}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={order.status}
                        disabled={updatingId === order.id}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-violet-accent cursor-pointer"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => onSelectOrder(order)}
                        className="inline-flex items-center space-x-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-violet-50 hover:text-violet-accent transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center">
              <ClipboardList className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <h4 className="text-base font-bold text-slate-800">No matching orders found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search terms or filters.'
                  : 'Start by creating your first voice order.'}
              </p>
              <button
                onClick={onNewVoiceOrder}
                className="mt-5 inline-flex items-center space-x-2 rounded-xl bg-violet-accent px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-violet-accent/25 hover:bg-violet-dark transition-all"
              >
                Create Voice Order
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
