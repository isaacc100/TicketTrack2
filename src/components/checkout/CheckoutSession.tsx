'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TouchButton } from '@/components/ui/TouchButton';
import { Numpad } from '@/components/ui/Numpad';

export function CheckoutSession({ tab, items, subtotal, total }: any) {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | null>(null);
  const [tendered, setTendered] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/checkout/${tab.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: paymentMethod,
          amountTendered: paymentMethod === 'CASH' ? Number(tendered) / 100 : total,
          total
        })
      });

      if (res.ok) {
        router.push('/tables');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!paymentMethod) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl flex flex-col gap-8">
        <h2 className="text-3xl font-bold text-center">Amount Due: £{total.toFixed(2)}</h2>
        
        <div className="max-h-64 overflow-y-auto border p-4 rounded-xl">
          {items.map((item: any) => (
             <div key={item.id} className="flex justify-between py-2 border-b last:border-0">
               <span className="text-xl">{item.quantity}x {item.name}</span>
               <span className="text-xl font-medium">£{(Number(item.price) * item.quantity).toFixed(2)}</span>
             </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <TouchButton onClick={() => setPaymentMethod('CASH')} className="h-32 text-2xl font-bold bg-green-600 hover:bg-green-700">
            Cash
          </TouchButton>
          <TouchButton onClick={() => setPaymentMethod('CARD')} className="h-32 text-2xl font-bold bg-blue-600 hover:bg-blue-700">
            Card
          </TouchButton>
        </div>
      </div>
    );
  }

  if (paymentMethod === 'CARD') {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-xl text-center flex flex-col gap-8 items-center justify-center min-h-[400px]">
        <h2 className="text-3xl font-bold">Process Card Payment</h2>
        <p className="text-xl text-gray-600">Please take £{total.toFixed(2)} on the card terminal.</p>
        
        <div className="flex gap-4 w-full px-8">
          <TouchButton variant="outline" className="flex-1 h-20 text-xl" onClick={() => setPaymentMethod(null)}>Cancel</TouchButton>
          <TouchButton disabled={isProcessing} className="flex-1 h-20 text-xl bg-blue-600 hover:bg-blue-700" onClick={handleProcessPayment}>
            Confirm Payment
          </TouchButton>
        </div>
      </div>
    );
  }

  const amt = Number(tendered) / 100;
  const change = amt - total;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-xl flex flex-col gap-6">
       <div className="text-center">
         <h2 className="text-2xl text-gray-500 mb-2">Total Due: £{total.toFixed(2)}</h2>
         <div className={`text-4xl font-bold ${amt < total ? 'text-red-500' : 'text-green-500'}`}>
           Tendered: £{amt.toFixed(2)}
         </div>
         {amt >= total && <div className="text-xl text-blue-600 font-bold mt-2">Change: £{change.toFixed(2)}</div>}
       </div>

       <Numpad 
         currentValue={tendered}
         onKeyPress={(k) => setTendered(prev => prev + k)}
         onDelete={() => setTendered(prev => prev.slice(0, -1))}
         onClear={() => setTendered('')}
         onSubmit={handleProcessPayment}
       />
       <TouchButton variant="outline" className="h-16 text-xl text-red-500 w-full mt-4" onClick={() => setPaymentMethod(null)}>Cancel</TouchButton>
    </div>
  );
}
