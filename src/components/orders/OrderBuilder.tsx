'use client';

import { useState } from 'react';
import { useOrderStore } from '@/stores/orderStore';
import { TouchButton } from '@/components/ui/TouchButton';
import { Plus, Minus, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function OrderBuilder({ tab, categories, draftOrder, submittedOrders }: any) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id);
  const { items, addItem, removeItem, updateQuantity, clear, subtotal } = useOrderStore();
  const router = useRouter();

  const activeCategory = categories.find((c: any) => c.id === activeCategoryId);

  const handleItemPress = (item: any) => {
    // For phase 1 we just add directly. Phase 2: modifiers modal.
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      quantity: 1,
    });
  };

  const submitOrder = async () => {
    if (items.length === 0) return;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabId: tab.id,
          items: items.map(i => ({ ...i, price: Number(i.price) }))
        })
      });

      if (res.ok) {
        clear();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckout = () => {
    router.push(`/checkout/${tab.id}`);
  };

  return (
    <div className="flex h-full">
      {/* Left Panel: Ticket */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col relative h-full">
        {/* Previous Items */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {submittedOrders.flatMap((o: any) => o.items).map((item: any) => (
            <div key={item.id} className="flex justify-between items-start opacity-60">
              <div>
                <span className="font-semibold text-lg">{item.quantity}x {item.name}</span>
              </div>
              <span className="text-lg">£{(Number(item.price) * item.quantity).toFixed(2)}</span>
            </div>
          ))}

          {/* Divider if mixed */}
          {submittedOrders.length > 0 && items.length > 0 && <hr className="my-4 border-dashed border-gray-300" />}

          {/* Current Draft Items */}
          {items.map((item) => (
            <div key={item.id} className="bg-blue-50 p-2 rounded-xl border border-blue-100 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">{item.name}</span>
                <span className="text-lg font-bold">£{(item.price * item.quantity).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => { if(item.quantity > 1) updateQuantity(item.id, item.quantity - 1) }} className="p-2 bg-white rounded-lg shadow-sm active:scale-95">
                  <Minus className="w-6 h-6 text-gray-600" />
                </button>
                <span className="text-xl w-8 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 bg-white rounded-lg shadow-sm active:scale-95">
                  <Plus className="w-6 h-6 text-gray-600" />
                </button>
                <div className="flex-1" />
                <button onClick={() => removeItem(item.id)} className="p-2 bg-red-100 rounded-lg shadow-sm text-red-600 active:scale-95">
                  <Trash className="w-6 h-6" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50 flex flex-col gap-4">
          <div className="flex justify-between text-xl font-bold">
            <span>Subtotal</span>
            <span>£{subtotal().toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TouchButton onClick={submitOrder} disabled={items.length === 0} className="bg-green-600 hover:bg-green-700 h-20 text-xl disabled:bg-gray-300">
              Submit Order
            </TouchButton>
            <TouchButton onClick={handleCheckout} className="bg-blue-600 hover:bg-blue-700 h-20 text-xl">
              Checkout
            </TouchButton>
          </div>
        </div>
      </div>

      {/* Right Panel: Menu */}
      <div className="w-2/3 bg-gray-50 flex flex-col h-full shrink-0">
        {/* Categories Tab Bar */}
        <div className="bg-white border-b overflow-x-auto flex flex-nowrap shrink-0 hide-scrollbar">
          {categories.map((cat: any) => (
             <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-8 py-6 text-xl font-semibold whitespace-nowrap border-b-4 transition-colors ${
                activeCategoryId === cat.id ? 'border-primary text-primary' : 'border-transparent text-gray-500'
              }`}
             >
               {cat.name}
             </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-3 gap-4">
            {activeCategory?.items.map((item: any) => (
              <button
                key={item.id}
                onClick={() => handleItemPress(item)}
                className="bg-white shadow-md border border-gray-100 rounded-2xl h-32 flex flex-col items-center justify-center p-4 active:scale-95 active:bg-gray-100 transition-all text-center"
              >
                <span className="font-bold text-lg mb-2 leading-tight">{item.name}</span>
                <span className="text-gray-600 font-medium">£{Number(item.price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
