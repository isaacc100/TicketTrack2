'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Shape returned by the DayClose prisma model (values are serialised numbers from JSON)
interface DayClose {
  id: string;
  date: string;
  closedAt: string;
  openingCash: number | string;
  closingCash: number | string;
  expectedCash: number | string;
  variance: number | string;
  totalSales: number | string;
  totalRefunds: number | string;
  totalTips: number | string;
  totalVoids: number;
  orderCount: number;
  coverCount: number;
  reportData: {
    paymentBreakdown?: { method: string; count: number; amount: number }[];
  };
}

interface OpenOrder {
  id: string;
  orderNumber: number;
  status: string;
  tabId: string;
}

type Step = 'form' | 'open_orders' | 'done';

function fmt(v: number | string): string {
  return `£${(Number(v) / 100).toFixed(2)}`;
}

export default function CloseDayPage() {
  const { rank, isAuthenticated } = useAuth();
  const router = useRouter();

  const [alreadyClosed, setAlreadyClosed] = useState(false);
  const [dayClose, setDayClose] = useState<DayClose | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('form');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);

  useEffect(() => {
    if (isAuthenticated && rank < 4) router.replace('/tables');
  }, [isAuthenticated, rank, router]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/day-close');
      if (!res.ok) throw new Error('Failed to load day status');
      const data = await res.json();
      if (data.alreadyClosed && data.dayClose) {
        setAlreadyClosed(true);
        setDayClose(data.dayClose);
        setStep('done');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleClose() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/day-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingCash: Math.round(parseFloat(openingCash || '0') * 100),
          closingCash: Math.round(parseFloat(closingCash || '0') * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.openOrders?.length > 0) {
          setOpenOrders(data.openOrders);
          setStep('open_orders');
        } else {
          throw new Error(data.error || 'Close failed');
        }
        return;
      }
      setDayClose(data.dayClose);
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-gray-500 text-sm">Loading…</div>;
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Close Day</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {/* Step: close form */}
      {step === 'form' && !alreadyClosed && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Close Today&apos;s Trading</h2>
          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Opening Cash (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Closing Cash (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            {submitting ? 'Closing…' : 'Close Day'}
          </button>
        </div>
      )}

      {/* Step: open orders warning */}
      {step === 'open_orders' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-orange-700">
                {openOrders.length} open order{openOrders.length !== 1 ? 's' : ''} must be resolved
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Close or void all open orders before closing the day.
              </p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 mb-4 max-h-48 overflow-y-auto">
            {openOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium">Order #{o.orderNumber}</span>
                <span className="text-gray-500">{o.status}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setStep('form'); setOpenOrders([]); }}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 transition"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step: done / Z-report */}
      {step === 'done' && dayClose && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">{alreadyClosed ? '📋' : '✅'}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {alreadyClosed ? 'Already Closed Today' : 'Day Closed'}
              </h2>
              <p className="text-sm text-gray-500">
                {new Date(dayClose.date).toLocaleDateString('en-GB', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            <ZRow label="Orders" value={String(dayClose.orderCount)} />
            <ZRow label="Covers" value={String(dayClose.coverCount)} />
            <ZRow label="Total Sales" value={fmt(dayClose.totalSales)} />
            <ZRow label="Total Refunds" value={fmt(dayClose.totalRefunds)} />
            <ZRow label="Total Tips" value={fmt(dayClose.totalTips)} />
            <ZRow label="Total Voids" value={String(dayClose.totalVoids)} />
            <ZRow label="Opening Cash" value={fmt(dayClose.openingCash)} />
            <ZRow label="Expected Cash" value={fmt(dayClose.expectedCash)} />
            <ZRow label="Closing Cash" value={fmt(dayClose.closingCash)} />
            <ZRow
              label="Variance"
              value={fmt(dayClose.variance)}
              highlight={Number(dayClose.variance) !== 0}
            />
          </div>
          {dayClose.reportData?.paymentBreakdown && dayClose.reportData.paymentBreakdown.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment Breakdown</p>
              {dayClose.reportData.paymentBreakdown.map((pb) => (
                <ZRow key={pb.method} label={`${pb.method} (${pb.count})`} value={fmt(pb.amount)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ZRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
