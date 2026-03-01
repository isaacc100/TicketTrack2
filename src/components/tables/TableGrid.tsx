'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type TableWithTabs = {
  id: string;
  number: number;
  name: string | null;
  status: string;
  seats: number;
  tabs: any[];
};

export function TableGrid({ initialTables }: { initialTables: TableWithTabs[] }) {
  const [tables, setTables] = useState(initialTables);
  const router = useRouter();

  const handleTablePress = async (table: TableWithTabs) => {
    if (table.tabs && table.tabs.length > 0) {
      // Navigate to existing tab's order builder
      router.push(`/orders/${table.tabs[0].id}`);
    } else {
      // Create a new tab
      try {
        const res = await fetch('/api/tabs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: table.id })
        });
        if (res.ok) {
          const data = await res.json();
          router.push(`/orders/${data.tab.id}`);
        }
      } catch (err) {
        console.error('Failed to create tab', err);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 border-green-500 text-green-900';
      case 'OCCUPIED': return 'bg-blue-100 border-blue-500 text-blue-900';
      case 'DIRTY': return 'bg-gray-200 border-gray-400 text-gray-700';
      default: return 'bg-white border-gray-300';
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
      {tables.map(table => (
        <button
          key={table.id}
          onClick={() => handleTablePress(table)}
          className={`h-32 md:h-40 rounded-2xl border-4 flex flex-col items-center justify-center p-4 transition active:scale-95 shadow-sm ${getStatusColor(table.status)}`}
        >
          <span className="text-3xl font-bold">T{table.number}</span>
          {table.name && <span className="text-sm font-medium mt-1">{table.name}</span>}
          <div className="mt-2 flex gap-1">
            <span className="text-xs px-2 py-1 bg-white/50 rounded-full font-semibold">
              {table.seats} seats
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
