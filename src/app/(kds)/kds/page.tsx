'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketContext } from '@/providers/SocketProvider';
import { useSocketEvent } from '@/hooks/useSocket';
import { toast } from '@/components/ui/Toaster';
import type { KdsOrder, KdsOrderItem, KdsStation, KdsItemStatus } from '@/types';

// ─── Colour helpers ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h${mins % 60}m`;
}

function ticketAgeColour(iso: string): string {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 5) return 'border-green-500';
  if (mins < 10) return 'border-yellow-500';
  if (mins < 15) return 'border-orange-500';
  return 'border-red-500';
}

function kdsStatusBg(status: KdsItemStatus): string {
  switch (status) {
    case 'PENDING': return '';
    case 'IN_PROGRESS': return 'bg-yellow-700/30';
    case 'DONE': return 'bg-green-700/30 line-through opacity-60';
    case 'SERVED': return 'bg-blue-700/30 opacity-40 line-through';
    default: return '';
  }
}

// ─── KDS Page Component ───────────────────────────────────────────────────────

export default function KdsPage() {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [stations, setStations] = useState<KdsStation[]>([]);
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [, setTick] = useState(0); // force re-render for time updates

  // Fetch stations
  useEffect(() => {
    fetch('/api/kds/stations')
      .then(r => r.json())
      .then(d => setStations(d.stations || []))
      .catch(() => {});
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const url = activeStation
        ? `/api/kds/orders?station=${encodeURIComponent(activeStation)}`
        : '/api/kds/orders';
      const r = await fetch(url);
      const d = await r.json();
      setOrders(d.orders || []);
    } catch {
      // silently fail — will retry
    } finally {
      setLoading(false);
    }
  }, [activeStation]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 10s + tick every second for time display
  useEffect(() => {
    const poll = setInterval(fetchOrders, 10000);
    const tick = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [fetchOrders]);

  // Socket listeners for real-time updates
  useSocketEvent('kds:newOrder', () => fetchOrders());
  useSocketEvent('kds:itemStarted', () => fetchOrders());
  useSocketEvent('kds:itemBumped', () => fetchOrders());
  useSocketEvent('kds:orderComplete', () => fetchOrders());
  useSocketEvent('kds:orderRecalled', () => fetchOrders());

  // ─── Actions ──────────────────────────────────────────────────────────────

  const doAction = async (itemId: string, action: 'start' | 'bump' | 'recall') => {
    try {
      const r = await fetch(`/api/kds/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: d.error || 'Action failed', variant: 'error' });
        return;
      }
      // Optimistic local update
      setOrders(prev =>
        prev
          .map(order => ({
            ...order,
            items: order.items.map(item =>
              item.id === itemId
                ? {
                    ...item,
                    kdsStatus: (action === 'start'
                      ? 'IN_PROGRESS'
                      : action === 'bump'
                      ? 'DONE'
                      : 'IN_PROGRESS') as KdsItemStatus,
                  }
                : item
            ),
          }))
          .filter(order => {
            // Remove orders where all items are DONE (unless recalled)
            if (action === 'bump' && d.orderComplete) {
              return order.items.some(i => i.id === itemId) ? false : true;
            }
            return true;
          })
      );

      // Full refresh to sync
      setTimeout(fetchOrders, 500);

      if (d.orderComplete) {
        toast({ title: `Order complete!`, variant: 'success' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const bumpAllOrder = async (order: KdsOrder) => {
    const pendingItems = order.items.filter(i => i.kdsStatus !== 'DONE' && i.kdsStatus !== 'SERVED');
    for (const item of pendingItems) {
      await doAction(item.id, 'bump');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <header className="bg-gray-800 h-16 px-6 flex items-center justify-between shrink-0 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">🍳 Kitchen Display</h1>
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => setActiveStation(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeStation === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {stations.filter(s => s.isActive).map(s => (
              <button
                key={s.id}
                onClick={() => setActiveStation(s.name)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeStation === s.name
                    ? 'text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                style={activeStation === s.name && s.colour ? { backgroundColor: s.colour } : undefined}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Orders grid */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-lg">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-4xl mb-3">✓</p>
              <p className="text-lg">All caught up!</p>
              <p className="text-sm mt-1">No pending orders</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 h-full">
            {orders.map(order => (
              <KdsTicket
                key={order.id}
                order={order}
                onItemAction={doAction}
                onBumpAll={() => bumpAllOrder(order)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KDS Ticket Card ──────────────────────────────────────────────────────────

function KdsTicket({
  order,
  onItemAction,
  onBumpAll,
}: {
  order: KdsOrder;
  onItemAction: (itemId: string, action: 'start' | 'bump' | 'recall') => void;
  onBumpAll: () => void;
}) {
  const allDone = order.items.every(i => i.kdsStatus === 'DONE' || i.kdsStatus === 'SERVED');
  const hasAllergens = order.allergens.length > 0;

  return (
    <div
      className={`w-72 shrink-0 bg-gray-800 rounded-xl border-t-4 flex flex-col overflow-hidden ${ticketAgeColour(
        order.submittedAt
      )} ${order.priority ? 'ring-2 ring-red-500' : ''}`}
    >
      {/* Ticket header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">
              #{order.orderNumber}
            </span>
            {order.priority && (
              <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                RUSH
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            {order.tableNumber ? `T${order.tableNumber}` : 'Takeaway'}
            {order.tableName && ` — ${order.tableName}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono font-bold text-gray-300">
            {timeAgo(order.submittedAt)}
          </div>
        </div>
      </div>

      {/* Allergen warning */}
      {hasAllergens && (
        <div className="bg-red-900/60 px-4 py-2 border-b border-red-700">
          <div className="text-xs font-bold text-red-300 uppercase mb-1">⚠ Allergens</div>
          <div className="flex flex-wrap gap-1">
            {order.allergens.map(a => (
              <span key={a} className="text-xs bg-red-800 text-red-200 px-2 py-0.5 rounded-full">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="bg-yellow-900/40 px-4 py-2 border-b border-yellow-700/50">
          <span className="text-xs text-yellow-300">📝 {order.notes}</span>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {order.items.map(item => (
          <KdsItemRow key={item.id} item={item} onAction={onItemAction} />
        ))}
      </div>

      {/* Bump All button */}
      {!allDone && (
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={onBumpAll}
            className="w-full py-3 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold rounded-xl text-lg transition"
          >
            BUMP ORDER
          </button>
        </div>
      )}
    </div>
  );
}

// ─── KDS Item Row ─────────────────────────────────────────────────────────────

function KdsItemRow({
  item,
  onAction,
}: {
  item: KdsOrderItem;
  onAction: (itemId: string, action: 'start' | 'bump' | 'recall') => void;
}) {
  const handleTap = () => {
    switch (item.kdsStatus) {
      case 'PENDING':
        onAction(item.id, 'start');
        break;
      case 'IN_PROGRESS':
        onAction(item.id, 'bump');
        break;
      case 'DONE':
        onAction(item.id, 'recall');
        break;
    }
  };

  return (
    <button
      onClick={handleTap}
      className={`w-full text-left py-2 px-3 rounded-lg transition active:scale-[0.98] ${kdsStatusBg(
        item.kdsStatus
      )}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white/80 w-6">{item.quantity}×</span>
          <span className="text-sm font-medium text-white">{item.name}</span>
        </div>
        <KdsStatusBadge status={item.kdsStatus} />
      </div>

      {/* Modifiers */}
      {item.modifiers && (item.modifiers as any[]).length > 0 && (
        <div className="ml-8 mt-0.5">
          {(item.modifiers as any[]).map((mod, i) => (
            <div key={i} className="text-xs text-gray-400">
              {mod.groupName}: {mod.selections?.map((s: any) => s.name).join(', ')}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div className="ml-8 mt-0.5 text-xs text-yellow-400">📝 {item.notes}</div>
      )}

      {/* Station badge */}
      {item.kdsStation && (
        <div className="ml-8 mt-0.5">
          <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
            {item.kdsStation}
          </span>
        </div>
      )}
    </button>
  );
}

function KdsStatusBadge({ status }: { status: KdsItemStatus }) {
  switch (status) {
    case 'PENDING':
      return <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full">Pending</span>;
    case 'IN_PROGRESS':
      return <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded-full">Working</span>;
    case 'DONE':
      return <span className="text-xs bg-green-600 text-green-100 px-2 py-0.5 rounded-full">Done</span>;
    case 'SERVED':
      return <span className="text-xs bg-blue-600 text-blue-100 px-2 py-0.5 rounded-full">Served</span>;
    default:
      return null;
  }
}
