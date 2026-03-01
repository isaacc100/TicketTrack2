'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocketRefresh } from '@/hooks/useSocket';
import { toast } from '@/components/ui/Toaster';
import { CreateTabModal } from '@/components/tables/CreateTabModal';
import type { TableWithTabs } from '@/types';

export function TableGrid({ initialTables }: { initialTables: TableWithTabs[] }) {
  const [tables, setTables] = useState(initialTables);

  // Sync state when server data changes (e.g. after router.refresh())
  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);
  const [selectedTable, setSelectedTable] = useState<TableWithTabs | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();

  // Auto-refresh when any terminal changes table/tab state
  useSocketRefresh(['table:statusChanged', 'tab:opened', 'tab:closed', 'kds:orderComplete', 'pickup:served']);

  const handleTablePress = (table: TableWithTabs) => {
    if (table.tabs && table.tabs.length > 0) {
      // Navigate to existing tab's order builder
      router.push(`/orders/${table.tabs[0].id}`);
    } else {
      // Open create tab modal with allergen prompt
      setSelectedTable(table);
      setShowCreateModal(true);
    }
  };

  const handleCreateTab = async (data: { tableId: string; name?: string; allergens?: string[] }) => {
    try {
      const res = await fetch('/api/tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setShowCreateModal(false);
        router.push(`/orders/${result.tab.id}`);
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Failed to open tab', variant: 'error' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 border-green-500 text-green-900';
      case 'OCCUPIED': return 'bg-blue-100 border-blue-500 text-blue-900';
      case 'AWAITING_FOOD': return 'bg-orange-100 border-orange-500 text-orange-900';
      case 'READY': return 'bg-emerald-100 border-emerald-500 text-emerald-900';
      case 'PAID': return 'bg-purple-100 border-purple-500 text-purple-900';
      case 'RESERVED': return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      case 'DIRTY': return 'bg-gray-200 border-gray-400 text-gray-700';
      default: return 'bg-white border-gray-300';
    }
  };

  const getStatusLabel = (status: string, table: TableWithTabs) => {
    if (table.tabs?.[0]?.allergens?.length) {
      return '⚠️ Allergens';
    }
    const labels: Record<string, string> = {
      AVAILABLE: 'Available',
      OCCUPIED: 'Occupied',
      AWAITING_FOOD: 'Awaiting food',
      READY: 'Ready',
      PAID: 'Paid',
      RESERVED: 'Reserved',
      DIRTY: 'Dirty',
    };
    return labels[status] || status;
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {tables.map(table => (
          <button
            key={table.id}
            onClick={() => handleTablePress(table)}
            className={`h-32 md:h-40 rounded-2xl border-4 flex flex-col items-center justify-center p-4 transition active:scale-95 shadow-sm ${getStatusColor(table.status)}`}
          >
            <span className="text-3xl font-bold">T{table.number}</span>
            {table.name && <span className="text-sm font-medium mt-1">{table.name}</span>}
            <div className="mt-2 flex flex-col items-center gap-1">
              <span className="text-xs px-2 py-1 bg-white/50 rounded-full font-semibold">
                {table.seats} seats
              </span>
              <span className="text-xs font-medium opacity-70">
                {getStatusLabel(table.status, table)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {showCreateModal && selectedTable && (
        <CreateTabModal
          table={selectedTable}
          onConfirm={handleCreateTab}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  );
}
