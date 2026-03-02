'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type ReportType = 'Z-Report' | 'Sales' | 'Staff Performance' | 'Items' | 'Tables';

const REPORT_TYPES: ReportType[] = ['Z-Report', 'Sales', 'Staff Performance', 'Items', 'Tables'];

const REPORT_TYPE_MAP: Record<ReportType, string> = {
  'Z-Report': 'z-report',
  'Sales': 'sales',
  'Staff Performance': 'staff',
  'Items': 'items',
  'Tables': 'tables',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Column definitions per report type
const COLUMNS: Record<ReportType, string[]> = {
  'Z-Report': ['Date', 'Orders', 'Revenue', 'Cash', 'Card', 'Other', 'Opening Cash', 'Closing Cash', 'Variance'],
  'Sales': ['Date', 'Orders', 'Revenue', 'Discounts', 'Tips', 'Net'],
  'Staff Performance': ['Staff', 'Orders', 'Revenue', 'Tips', 'Avg Order'],
  'Items': ['Item', 'Category', 'Qty Sold', 'Revenue'],
  'Tables': ['Table', 'Covers', 'Orders', 'Revenue', 'Avg Spend'],
};

type Row = Record<string, string | number>;

export default function ReportsPage() {
  const { rank, isAuthenticated } = useAuth();
  const router = useRouter();

  const [reportType, setReportType] = useState<ReportType>('Sales');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (isAuthenticated && rank < 4) router.replace('/tables');
  }, [isAuthenticated, rank, router]);

  function buildQuery(extra: Record<string, string> = {}) {
    const params = new URLSearchParams({
      type: REPORT_TYPE_MAP[reportType],
      startDate,
      endDate,
      ...extra,
    });
    return params.toString();
  }

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setGenerated(false);
    try {
      const res = await fetch(`/api/admin/reports?${buildQuery()}`);
      if (!res.ok) throw new Error('Failed to generate report');
      const data = await res.json();
      const result: Row[] = data.rows ?? data.data ?? data.report ?? [];
      setRows(result);
      setGenerated(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function handleExportCsv() {
    window.location.href = `/api/admin/reports?${buildQuery({ format: 'csv' })}`;
  }

  const columns = COLUMNS[reportType];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        {generated && rows.length > 0 && (
          <button
            onClick={handleExportCsv}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Report Type</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={reportType}
            onChange={(e) => { setReportType(e.target.value as ReportType); setGenerated(false); }}
          >
            {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setGenerated(false); }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setGenerated(false); }}
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {generated && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                    No data for selected range
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {columns.map((col) => {
                      const key = col.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                      // Try multiple key formats
                      const val = row[col] ?? row[key] ?? row[col.toLowerCase()] ?? '—';
                      return (
                        <td key={col} className="px-4 py-2 text-gray-700">
                          {String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
