'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { toast } from '@/components/ui/Toaster';
import type { PickupOrder, PickupItem } from '@/types';

export default function PickupPage() {
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      const r = await fetch('/api/kds/pickup');
      const d = await r.json();
      setOrders(d.orders || []);
    } catch {
      // silently fail, will retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh
  useEffect(() => {
    const poll = setInterval(fetchOrders, 10000);
    const tick = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [fetchOrders]);

  // Socket listeners
  useSocketEvent('pickup:ready', () => fetchOrders());
  useSocketEvent('pickup:served', () => fetchOrders());
  useSocketEvent('kds:orderRecalled', () => fetchOrders());

  const handleServe = async (orderId: string) => {
    try {
      const r = await fetch('/api/kds/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!r.ok) {
        const d = await r.json();
        toast({ title: d.error || 'Failed to serve', variant: 'error' });
        return;
      }
      // Optimistic removal
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast({ title: 'Order served!', variant: 'success' });
      setTimeout(fetchOrders, 500);
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 h-16 px-6 flex items-center justify-between shrink-0 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">🔔 Food Pickup</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{orders.length} ready</span>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Orders grid */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-lg">Loading...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-lg">No orders ready for pickup</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {orders.map(order => (
              <PickupCard key={order.id} order={order} onServe={() => handleServe(order.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pickup Card ──────────────────────────────────────────────────────────────

function PickupCard({ order, onServe }: { order: PickupOrder; onServe: () => void }) {
  return (
    <div
      className={`bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden ${
        order.priority ? 'ring-2 ring-red-500' : ''
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between bg-green-900/30">
        <div>
          <span className="text-lg font-bold text-white">
            #{order.orderNumber}
          </span>
          {order.priority && (
            <span className="ml-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              RUSH
            </span>
          )}
        </div>
        <span className="text-sm text-gray-400">
          {order.tableNumber ? `T${order.tableNumber}` : 'Takeaway'}
        </span>
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-2 space-y-1">
        {order.items.map(item => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <span className="font-bold text-gray-400 w-6">{item.quantity}×</span>
            <span className={`text-white ${item.servedAt ? 'line-through opacity-50' : ''}`}>
              {item.name}
            </span>
          </div>
        ))}
      </div>

      {/* Serve button */}
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={onServe}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl text-base transition"
        >
          ✓ SERVED
        </button>
      </div>
    </div>
  );
}
