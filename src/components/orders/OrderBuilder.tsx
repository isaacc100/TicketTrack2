'use client';

import { useState } from 'react';
import { useOrderStore } from '@/stores/orderStore';
import { TouchButton } from '@/components/ui/TouchButton';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { ModifierModal } from '@/components/menu/ModifierModal';
import { toast } from '@/components/ui/Toaster';
import { useSocketRefresh } from '@/hooks/useSocket';
import { Permission } from '@/lib/permissions';
import { Plus, Minus, Trash, AlertTriangle, Ban, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { MenuItemData, ModifierSelection, CategoryData, OrderWithItems } from '@/types';

interface OrderBuilderProps {
  tab: any;
  categories: any[];
  draftOrder: any;
  submittedOrders: any[];
}

export function OrderBuilder({ tab, categories, draftOrder, submittedOrders }: OrderBuilderProps) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id);
  const { items, addItem, removeItem, updateQuantity, clear, subtotal } = useOrderStore();
  const [modifierItem, setModifierItem] = useState<MenuItemData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Auto-refresh when orders are updated from other terminals
  useSocketRefresh(['order:created', 'order:updated']);

  const activeCategory = categories.find((c: any) => c.id === activeCategoryId);
  const allergens: string[] = (tab.allergens as string[]) || [];

  const handleItemPress = (item: any) => {
    // If item has modifier groups, show the modal
    const groups = item.modifierGroups as any[] | null;
    if (groups && groups.length > 0) {
      setModifierItem(item);
      return;
    }
    // Otherwise add directly
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      quantity: 1,
    });
  };

  const handleModifierConfirm = (modifiers: ModifierSelection[], notes: string) => {
    if (!modifierItem) return;
    const extraPrice = modifiers.reduce(
      (sum, g) => sum + g.selections.reduce((s, sel) => s + sel.price, 0),
      0
    );
    addItem({
      menuItemId: modifierItem.id,
      name: modifierItem.name,
      price: Number(modifierItem.price) + extraPrice,
      quantity: 1,
      modifiers,
      notes: notes || undefined,
    });
    setModifierItem(null);
  };

  const submitOrder = async () => {
    if (items.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

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
        toast({ title: 'Order submitted', variant: 'success' });
        router.refresh();
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Failed to submit', variant: 'error' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidItem = async (orderId: string, itemId: string, itemName: string) => {
    if (!confirm(`Void "${itemName}"?`)) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, voidReason: 'Staff void' }),
      });
      if (res.ok) {
        toast({ title: `${itemName} voided`, variant: 'warning' });
        router.refresh();
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Cannot void', variant: 'error' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const handleVoidOrder = async (orderId: string) => {
    if (!confirm('Void this entire order?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VOID', voidReason: 'Staff void' }),
      });
      if (res.ok) {
        toast({ title: 'Order voided', variant: 'warning' });
        router.refresh();
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Cannot void', variant: 'error' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const handleTogglePriority = async (orderId: string, currentPriority: boolean) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: !currentPriority }),
      });
      if (res.ok) {
        toast({ title: currentPriority ? 'Priority removed' : 'Priority set', variant: 'success' });
        router.refresh();
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const handleCheckout = () => {
    router.push(`/checkout/${tab.id}`);
  };

  // Calculate total from submitted orders (non-void items only)
  const submittedTotal = submittedOrders
    .filter((o: any) => o.status !== 'VOID')
    .reduce((sum: number, o: any) => {
      return sum + o.items
        .filter((i: any) => i.status !== 'VOID')
        .reduce((s: number, i: any) => s + Number(i.price) * i.quantity, 0);
    }, 0);

  const grandTotal = submittedTotal + subtotal();

  return (
    <div className="flex h-full">
      {/* Left Panel: Ticket */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col relative h-full">
        {/* Allergen Warning Banner */}
        {allergens.length > 0 && (
          <div className="bg-red-50 border-b-2 border-red-200 px-4 py-3 flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Allergen Alert</p>
              <p className="text-xs text-red-700">{allergens.join(', ')}</p>
            </div>
          </div>
        )}

        {/* Previous Orders */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {submittedOrders.map((order: any) => (
            <div key={order.id} className={`${order.status === 'VOID' ? 'opacity-30' : 'opacity-60'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">
                    #{order.orderNumber} — {order.status}
                  </span>
                  {order.priority && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                </div>
                {order.status !== 'VOID' && order.status !== 'CLOSED' && (
                  <div className="flex gap-1">
                    <PermissionGate required={Permission.MARK_PRIORITY}>
                      <button
                        onClick={() => handleTogglePriority(order.id, order.priority)}
                        className={`p-1 rounded ${order.priority ? 'text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                        title="Toggle priority"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    </PermissionGate>
                    <PermissionGate required={Permission.VOID_ITEM}>
                      <button
                        onClick={() => handleVoidOrder(order.id)}
                        className="p-1 text-red-400 hover:text-red-600 rounded"
                        title="Void order"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </PermissionGate>
                  </div>
                )}
              </div>
              {order.items.map((item: any) => (
                <div
                  key={item.id}
                  className={`flex justify-between items-start py-1 ${item.status === 'VOID' ? 'line-through opacity-40' : ''}`}
                >
                  <div className="flex-1">
                    <span className="font-semibold text-base">{item.quantity}x {item.name}</span>
                    {item.modifiers && (item.modifiers as any[]).length > 0 && (
                      <p className="text-xs text-gray-500">
                        {(item.modifiers as any[]).map((m: any) =>
                          m.selections?.map((s: any) => s.name).join(', ')
                        ).join('; ')}
                      </p>
                    )}
                    {item.notes && <p className="text-xs text-blue-500 italic">{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">£{(Number(item.price) * item.quantity).toFixed(2)}</span>
                    {item.status !== 'VOID' && order.status !== 'VOID' && order.status !== 'CLOSED' && (
                      <PermissionGate required={Permission.VOID_ITEM}>
                        <button
                          onClick={() => handleVoidItem(order.id, item.id, item.name)}
                          className="p-1 text-red-300 hover:text-red-500"
                          title="Void item"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </PermissionGate>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Divider if mixed */}
          {submittedOrders.length > 0 && items.length > 0 && <hr className="my-4 border-dashed border-gray-300" />}

          {/* Current Draft Items */}
          {items.map((item) => (
            <div key={item.id} className="bg-blue-50 p-2 rounded-xl border border-blue-100 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <span className="font-semibold text-lg">{item.name}</span>
                  {item.modifiers && (item.modifiers as ModifierSelection[]).length > 0 && (
                    <p className="text-xs text-gray-500">
                      {(item.modifiers as ModifierSelection[]).map(m =>
                        m.selections.map(s => s.name).join(', ')
                      ).join('; ')}
                    </p>
                  )}
                  {item.notes && <p className="text-xs text-blue-500 italic">{item.notes}</p>}
                </div>
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
        <div className="p-4 border-t bg-gray-50 flex flex-col gap-4 shrink-0">
          <div className="flex justify-between text-lg">
            <span className="text-gray-500">Previous</span>
            <span>£{submittedTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold">
            <span>Total</span>
            <span>£{grandTotal.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TouchButton
              onClick={submitOrder}
              disabled={items.length === 0 || isSubmitting}
              className="bg-green-600 hover:bg-green-700 h-20 text-xl disabled:bg-gray-300"
            >
              {isSubmitting ? 'Sending...' : 'Submit Order'}
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
                activeCategoryId === cat.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
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
                className={`bg-white shadow-md border border-gray-100 rounded-2xl h-32 flex flex-col items-center justify-center p-4 active:scale-95 active:bg-gray-100 transition-all text-center relative ${
                  !item.isAvailable ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <span className="font-bold text-lg mb-2 leading-tight">{item.name}</span>
                <span className="text-gray-600 font-medium">£{Number(item.price).toFixed(2)}</span>
                {item.modifierGroups && (item.modifierGroups as any[]).length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" title="Has modifiers" />
                )}
                {!item.isAvailable && (
                  <span className="absolute bottom-2 text-xs text-red-500 font-medium">Unavailable</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modifier Modal */}
      {modifierItem && (
        <ModifierModal
          item={modifierItem}
          onConfirm={handleModifierConfirm}
          onClose={() => setModifierItem(null)}
        />
      )}
    </div>
  );
}
