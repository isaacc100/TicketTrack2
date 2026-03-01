'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TouchButton } from '@/components/ui/TouchButton';
import { Numpad } from '@/components/ui/Numpad';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { toast } from '@/components/ui/Toaster';
import { Permission } from '@/lib/permissions';
import { Percent, ArrowLeft, Split } from 'lucide-react';
import type { DiscountType } from '@/types';

interface CheckoutProps {
  tab: any;
  items: any[];
  subtotal: number;
  total: number;
  existingPayments?: any[];
  remaining?: number;
}

export function CheckoutSession({ tab, items, subtotal, total: initialTotal, existingPayments = [], remaining: initialRemaining }: CheckoutProps) {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | null>(null);
  const [tendered, setTendered] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipInput, setTipInput] = useState('');
  const [showTipEntry, setShowTipEntry] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType | null>(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountInput, setDiscountInput] = useState('');
  const [showDiscountEntry, setShowDiscountEntry] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitAmount, setSplitAmount] = useState('');
  const [balance, setBalance] = useState<any>(null);
  const router = useRouter();

  // Fetch balance for split bill support
  useEffect(() => {
    if (existingPayments.length > 0 || splitMode) {
      fetch(`/api/checkout/${tab.id}/balance`)
        .then(r => r.json())
        .then(setBalance)
        .catch(() => {});
    }
  }, [tab.id, existingPayments.length, splitMode]);

  // Calculate discounted total
  const calculateDiscountedTotal = () => {
    if (!discountType || !discountValue) return subtotal;
    if (discountType === 'PERCENT') {
      return subtotal * (1 - discountValue / 100);
    }
    return Math.max(0, subtotal - discountValue);
  };

  const discountedTotal = calculateDiscountedTotal();
  const remaining = balance ? balance.remaining : (initialRemaining ?? discountedTotal);
  const payableAmount = splitMode && splitAmount ? Number(splitAmount) / 100 : remaining;

  const handleApplyDiscount = () => {
    const val = Number(discountInput) / (discountType === 'PERCENT' ? 1 : 100);
    if (val <= 0) return;
    if (discountType === 'PERCENT' && val > 100) return;
    setDiscountValue(val);
    setShowDiscountEntry(false);
  };

  const handleApplyTip = () => {
    const val = Number(tipInput) / 100;
    if (val < 0) return;
    setTipAmount(val);
    setShowTipEntry(false);
  };

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    try {
      const amountToPay = splitMode ? payableAmount : discountedTotal;
      const res = await fetch(`/api/checkout/${tab.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: paymentMethod,
          amountTendered: paymentMethod === 'CASH' ? Number(tendered) / 100 : amountToPay,
          total: amountToPay,
          tipAmount: tipAmount || 0,
          discountType: discountType || undefined,
          discountValue: discountValue || undefined,
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.fullyClosed) {
          toast({ title: 'Payment complete — tab closed', variant: 'success' });
          router.push('/tables');
        } else {
          toast({ title: 'Partial payment recorded', variant: 'success' });
          // Refresh to show updated balance
          router.refresh();
          setPaymentMethod(null);
          setTendered('');
          setTipAmount(0);
          setSplitAmount('');
          // Refetch balance
          const balRes = await fetch(`/api/checkout/${tab.id}/balance`);
          setBalance(await balRes.json());
        }
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Payment failed', variant: 'error' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick cash amounts
  const quickCash = [5, 10, 20, 50].filter(v => v >= Math.ceil(payableAmount));

  // ─── Discount Entry Screen ──────────────────────────────────────────────────
  if (showDiscountEntry) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Apply {discountType === 'PERCENT' ? 'Percentage' : 'Fixed'} Discount
          </h2>
          <button onClick={() => setShowDiscountEntry(false)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="text-center text-4xl font-bold text-gray-800">
          {discountType === 'PERCENT' ? `${discountInput || '0'}%` : `£${(Number(discountInput || '0') / 100).toFixed(2)}`}
        </div>
        <Numpad
          currentValue={discountInput}
          onKeyPress={(k) => setDiscountInput(prev => prev + k)}
          onDelete={() => setDiscountInput(prev => prev.slice(0, -1))}
          onClear={() => setDiscountInput('')}
          onSubmit={handleApplyDiscount}
        />
        <TouchButton variant="outline" className="h-14 text-lg" onClick={() => { setShowDiscountEntry(false); setDiscountType(null); }}>
          Cancel Discount
        </TouchButton>
      </div>
    );
  }

  // ─── Tip Entry Screen ───────────────────────────────────────────────────────
  if (showTipEntry) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Add Tip</h2>
          <button onClick={() => setShowTipEntry(false)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="text-center text-4xl font-bold text-green-600">
          £{(Number(tipInput || '0') / 100).toFixed(2)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[10, 12.5, 15].map(pct => (
            <TouchButton
              key={pct}
              variant="outline"
              className="h-14 text-lg"
              onClick={() => {
                const tipVal = Math.round(discountedTotal * pct) ;
                setTipInput(String(tipVal));
              }}
            >
              {pct}%
            </TouchButton>
          ))}
        </div>
        <Numpad
          currentValue={tipInput}
          onKeyPress={(k) => setTipInput(prev => prev + k)}
          onDelete={() => setTipInput(prev => prev.slice(0, -1))}
          onClear={() => setTipInput('')}
          onSubmit={handleApplyTip}
        />
      </div>
    );
  }

  // ─── Payment Method Selection ───────────────────────────────────────────────
  if (!paymentMethod) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl flex flex-col gap-6">
        {/* Balance summary for split bills */}
        {balance && balance.paymentCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Split className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-blue-800">Split Bill Progress</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Total</span>
                <p className="font-bold">£{balance.orderTotal.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-500">Paid</span>
                <p className="font-bold text-green-600">£{balance.paidTotal.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-500">Remaining</span>
                <p className="font-bold text-red-600">£{balance.remaining.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        <h2 className="text-3xl font-bold text-center">
          {subtotal !== discountedTotal ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg text-gray-400 line-through">£{subtotal.toFixed(2)}</span>
              <span>Amount Due: £{remaining.toFixed(2)}</span>
            </div>
          ) : (
            `Amount Due: £${remaining.toFixed(2)}`
          )}
        </h2>

        {tipAmount > 0 && (
          <p className="text-center text-green-600 font-medium">+ £{tipAmount.toFixed(2)} tip</p>
        )}

        {/* Items list */}
        <div className="max-h-48 overflow-y-auto border p-4 rounded-xl">
          {items.map((item: any) => (
            <div key={item.id} className="flex justify-between py-1.5 border-b last:border-0">
              <span className="text-lg">{item.quantity}x {item.name}</span>
              <span className="text-lg font-medium">£{(Number(item.price) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          {discountType && discountValue > 0 && (
            <div className="flex justify-between py-1.5 text-green-600 font-medium">
              <span>Discount ({discountType === 'PERCENT' ? `${discountValue}%` : `£${discountValue.toFixed(2)}`})</span>
              <span>-£{(subtotal - discountedTotal).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Action buttons: Discount, Tip, Split */}
        <div className="flex gap-3">
          <PermissionGate required={Permission.APPLY_DISCOUNT}>
            <div className="flex gap-2 flex-1">
              <TouchButton
                variant="outline"
                className="flex-1 h-14 text-base gap-2"
                onClick={() => { setDiscountType('PERCENT'); setDiscountInput(''); setShowDiscountEntry(true); }}
              >
                <Percent className="w-5 h-5" /> %
              </TouchButton>
              <TouchButton
                variant="outline"
                className="flex-1 h-14 text-base gap-2"
                onClick={() => { setDiscountType('FIXED'); setDiscountInput(''); setShowDiscountEntry(true); }}
              >
                £ Off
              </TouchButton>
            </div>
          </PermissionGate>
          <TouchButton
            variant="outline"
            className="flex-1 h-14 text-base gap-2"
            onClick={() => { setTipInput(''); setShowTipEntry(true); }}
          >
            Tip
          </TouchButton>
          <TouchButton
            variant={splitMode ? 'default' : 'outline'}
            className={`flex-1 h-14 text-base gap-2 ${splitMode ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
            onClick={() => setSplitMode(!splitMode)}
          >
            <Split className="w-5 h-5" /> Split
          </TouchButton>
        </div>

        {/* Split amount entry */}
        {splitMode && (
          <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
            <label className="text-sm font-medium text-purple-700 block mb-2">Pay amount (partial payment)</label>
            <div className="flex gap-3 items-center">
              <span className="text-2xl font-bold text-purple-800">£{(Number(splitAmount || '0') / 100).toFixed(2)}</span>
              <div className="flex-1" />
              <div className="flex gap-2">
                {[2, 3, 4].map(n => (
                  <TouchButton
                    key={n}
                    variant="outline"
                    className="h-10 text-sm px-3"
                    onClick={() => setSplitAmount(String(Math.round(remaining / n * 100)))}
                  >
                    ÷{n}
                  </TouchButton>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Numpad
                currentValue={splitAmount}
                onKeyPress={(k) => setSplitAmount(prev => prev + k)}
                onDelete={() => setSplitAmount(prev => prev.slice(0, -1))}
                onClear={() => setSplitAmount('')}
                onSubmit={() => {}}
              />
            </div>
          </div>
        )}

        {/* Payment method selection */}
        <div className="grid grid-cols-2 gap-6">
          <TouchButton onClick={() => setPaymentMethod('CASH')} className="h-28 text-2xl font-bold bg-green-600 hover:bg-green-700">
            Cash
          </TouchButton>
          <TouchButton onClick={() => setPaymentMethod('CARD')} className="h-28 text-2xl font-bold bg-blue-600 hover:bg-blue-700">
            Card
          </TouchButton>
        </div>

        <TouchButton variant="outline" className="h-14 text-lg" onClick={() => router.push(`/orders/${tab.id}`)}>
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Order
        </TouchButton>
      </div>
    );
  }

  // ─── Card Payment ───────────────────────────────────────────────────────────
  if (paymentMethod === 'CARD') {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-xl text-center flex flex-col gap-8 items-center justify-center min-h-[400px]">
        <h2 className="text-3xl font-bold">Process Card Payment</h2>
        <p className="text-xl text-gray-600">
          Please take £{payableAmount.toFixed(2)} on the card terminal.
          {tipAmount > 0 && <span className="block text-green-600 mt-1">+ £{tipAmount.toFixed(2)} tip</span>}
        </p>

        <div className="flex gap-4 w-full px-8">
          <TouchButton variant="outline" className="flex-1 h-20 text-xl" onClick={() => setPaymentMethod(null)}>Cancel</TouchButton>
          <TouchButton disabled={isProcessing} className="flex-1 h-20 text-xl bg-blue-600 hover:bg-blue-700" onClick={handleProcessPayment}>
            {isProcessing ? 'Processing...' : 'Confirm Payment'}
          </TouchButton>
        </div>
      </div>
    );
  }

  // ─── Cash Payment ───────────────────────────────────────────────────────────
  const amt = Number(tendered) / 100;
  const change = amt - payableAmount;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-xl flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl text-gray-500 mb-2">Total Due: £{payableAmount.toFixed(2)}</h2>
        {tipAmount > 0 && <p className="text-green-600 font-medium mb-2">+ £{tipAmount.toFixed(2)} tip</p>}
        <div className={`text-4xl font-bold ${amt < payableAmount ? 'text-red-500' : 'text-green-500'}`}>
          Tendered: £{amt.toFixed(2)}
        </div>
        {amt >= payableAmount && <div className="text-xl text-blue-600 font-bold mt-2">Change: £{change.toFixed(2)}</div>}
      </div>

      {/* Quick cash buttons */}
      <div className="flex gap-3 justify-center">
        {quickCash.map(v => (
          <TouchButton key={v} variant="outline" className="h-14 px-6 text-lg" onClick={() => setTendered(String(v * 100))}>
            £{v}
          </TouchButton>
        ))}
        <TouchButton variant="outline" className="h-14 px-6 text-lg" onClick={() => setTendered(String(Math.ceil(payableAmount) * 100))}>
          Exact
        </TouchButton>
      </div>

      <Numpad
        currentValue={tendered}
        onKeyPress={(k) => setTendered(prev => prev + k)}
        onDelete={() => setTendered(prev => prev.slice(0, -1))}
        onClear={() => setTendered('')}
        onSubmit={handleProcessPayment}
      />
      <TouchButton variant="outline" className="h-16 text-xl text-red-500 w-full mt-2" onClick={() => setPaymentMethod(null)}>Cancel</TouchButton>
    </div>
  );
}
