'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AuditEntry {
  id: string;
  createdAt: string;
  staff: { name: string } | null;
  terminalId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  orderRef: string | null;
}

interface Filters {
  staffId: string;
  action: string;
  entityType: string;
  startDate: string;
  endDate: string;
}

const emptyFilters: Filters = {
  staffId: '',
  action: '',
  entityType: '',
  startDate: '',
  endDate: '',
};

const ENTITY_TYPES = [
  'ORDER', 'TAB', 'TABLE', 'PAYMENT', 'STAFF', 'MENU', 'CATEGORY',
  'ITEM', 'DAY_CLOSE', 'CONFIG', 'SESSION',
];

export default function AuditPage() {
  const { rank, isAuthenticated } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (isAuthenticated && rank < 4) router.replace('/tables');
  }, [isAuthenticated, rank, router]);

  useEffect(() => {
    fetch('/api/admin/staff')
      .then((r) => r.json())
      .then((d) => setStaffList(d.staff ?? []))
      .catch(() => {});
  }, []);

  const buildQuery = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams();
      if (filters.staffId) params.set('staffId', filters.staffId);
      if (filters.action) params.set('action', filters.action);
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      Object.entries(extra).forEach(([k, v]) => params.set(k, v));
      return params.toString();
    },
    [filters, page]
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/audit?${buildQuery()}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEntries(data.entries ?? data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  function handleFilterChange(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function handleExportCsv() {
    const q = buildQuery({ format: 'csv' });
    window.location.href = `/api/admin/audit?${q}`;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <button
          onClick={handleExportCsv}
          className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Staff</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.staffId}
            onChange={(e) => handleFilterChange('staffId', e.target.value)}
          >
            <option value="">All staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            placeholder="e.g. CREATE_ORDER"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Entity Type</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.entityType}
            onChange={(e) => handleFilterChange('entityType', e.target.value)}
          >
            <option value="">All types</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Timestamp', 'Staff', 'Terminal', 'Action', 'Entity Type', 'Entity ID', 'Order Ref'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No entries found</td>
                  </tr>
                )}
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 text-xs">
                      {new Date(e.createdAt).toLocaleString('en-GB')}
                    </td>
                    <td className="px-4 py-2">{e.staff?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{e.terminalId ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs text-blue-700">{e.action}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{e.entityType ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500 max-w-[120px] truncate">
                      {e.entityId ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{e.orderRef ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>{total} total entries</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="px-3 py-1">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
