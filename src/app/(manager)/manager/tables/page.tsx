'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface TableRecord {
  id: string;
  number: number;
  name: string | null;
  zone: string | null;
  seats: number;
  status: string;
  posX: number;
  posY: number;
}

interface TableForm {
  number: string;
  name: string;
  zone: string;
  seats: number;
  posX: number;
  posY: number;
}

const defaultForm: TableForm = {
  number: '', name: '', zone: '', seats: 2, posX: 0, posY: 0,
};

const INPUT_CLS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function TablesManagementPage() {
  const { rank, isAuthenticated } = useAuth();
  const router = useRouter();

  const [tables, setTables] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<TableRecord | null>(null);
  const [form, setForm] = useState<TableForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated && rank < 4) router.replace('/tables');
  }, [isAuthenticated, rank, router]);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tables');
      if (!res.ok) throw new Error('Failed to load tables');
      const data = await res.json();
      setTables(data.tables ?? data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  function openAdd() {
    setForm(defaultForm);
    setEditTarget(null);
    setShowModal(true);
  }

  function openEdit(table: TableRecord) {
    setForm({
      number: String(table.number),
      name: table.name ?? '',
      zone: table.zone ?? '',
      seats: table.seats,
      posX: table.posX,
      posY: table.posY,
    });
    setEditTarget(table);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.number) { alert('Table number is required'); return; }
    setSaving(true);
    try {
      const payload = {
        number: parseInt(form.number, 10),
        name: form.name || null,
        zone: form.zone || null,
        seats: form.seats,
        posX: form.posX,
        posY: form.posY,
      };
      if (editTarget) {
        const res = await fetch(`/api/tables/${editTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      } else {
        const res = await fetch('/api/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      }
      setShowModal(false);
      loadTables();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(table: TableRecord) {
    if (!confirm(`Delete table T${table.number}${table.name ? ` (${table.name})` : ''}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/tables/${table.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      loadTables();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Add Table
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['#', 'Name', 'Zone', 'Seats', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tables.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No tables yet</td>
                </tr>
              )}
              {tables.map((table) => (
                <tr key={table.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-gray-900">T{table.number}</td>
                  <td className="px-4 py-3 text-gray-700">{table.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{table.zone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{table.seats}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(table.status)}`}>
                      {table.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button onClick={() => openEdit(table)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(table)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                {editTarget ? `Edit T${editTarget.number}` : 'Add Table'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Table Number *</label>
                <input
                  type="number"
                  min="1"
                  className={INPUT_CLS}
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="e.g. 1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  className={INPUT_CLS}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Optional display name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Zone</label>
                <input
                  className={INPUT_CLS}
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  placeholder="e.g. Main Floor, Terrace"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Seats</label>
                <input
                  type="number"
                  min="1"
                  className={INPUT_CLS}
                  value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pos X</label>
                  <input
                    type="number"
                    className={INPUT_CLS}
                    value={form.posX}
                    onChange={(e) => setForm({ ...form, posX: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pos Y</label>
                  <input
                    type="number"
                    className={INPUT_CLS}
                    value={form.posY}
                    onChange={(e) => setForm({ ...form, posY: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div className="px-5 pb-4 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    AVAILABLE: 'bg-green-100 text-green-700',
    OCCUPIED: 'bg-blue-100 text-blue-700',
    AWAITING_FOOD: 'bg-orange-100 text-orange-700',
    READY: 'bg-emerald-100 text-emerald-700',
    PAID: 'bg-purple-100 text-purple-700',
    RESERVED: 'bg-yellow-100 text-yellow-700',
    DIRTY: 'bg-gray-200 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}
