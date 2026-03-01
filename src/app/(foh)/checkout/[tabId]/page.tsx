import { prisma } from '@/lib/prisma';
import { CheckoutSession } from '@/components/checkout/CheckoutSession';
import { notFound } from 'next/navigation';

export default async function CheckoutPage({ params }: { params: { tabId: string } }) {
  const tab = await prisma.tab.findUnique({
    where: { id: params.tabId },
    include: {
      table: true,
      orders: {
        where: { status: { notIn: ['DRAFT', 'VOID'] } },
        include: { items: true }
      }
    }
  });

  if (!tab) {
    notFound();
  }

  // Calculate totals
  const allItems = tab.orders.flatMap(o => o.items).filter(i => i.status !== 'VOID');
  const subtotal = allItems.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0);
  
  // Phase 1: no discount/tax calculations.
  const total = subtotal;

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm h-16 px-6 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold">
          Checkout: {tab.table ? `Table ${tab.table.number}` : 'Tab'}
        </h1>
      </header>
      
      <div className="flex-1 overflow-hidden p-6 flex justify-center items-center">
        <CheckoutSession tab={tab} items={allItems} subtotal={subtotal} total={total} />
      </div>
    </div>
  );
}
