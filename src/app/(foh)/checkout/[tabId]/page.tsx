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
      },
      payments: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!tab) {
    notFound();
  }

  // Calculate totals — exclude voided items
  const allItems = tab.orders.flatMap(o => o.items).filter(i => i.status !== 'VOID');
  const subtotal = allItems.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0);
  const total = subtotal;

  // Calculate remaining for split bills
  const paidTotal = tab.payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const remaining = Math.max(0, total - paidTotal);

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm h-16 px-6 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold">
          Checkout: {tab.table ? `Table ${tab.table.number}` : 'Tab'}
        </h1>
        {tab.payments.length > 0 && (
          <span className="text-sm text-gray-500">
            {tab.payments.length} payment(s) — £{paidTotal.toFixed(2)} paid
          </span>
        )}
      </header>
      
      <div className="flex-1 overflow-hidden p-6 flex justify-center items-start pt-8">
        <CheckoutSession
          tab={tab}
          items={allItems}
          subtotal={subtotal}
          total={total}
          existingPayments={tab.payments}
          remaining={remaining}
        />
      </div>
    </div>
  );
}
