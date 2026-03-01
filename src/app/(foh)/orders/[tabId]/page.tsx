import { prisma } from '@/lib/prisma';
import { OrderBuilder } from '@/components/orders/OrderBuilder';
import { notFound } from 'next/navigation';

export default async function OrderPage({ params }: { params: { tabId: string } }) {
  const tab = await prisma.tab.findUnique({
    where: { id: params.tabId },
    include: { table: true }
  });

  if (!tab) {
    notFound();
  }

  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    include: {
      items: {
        where: { deletedAt: null, isAvailable: true },
        orderBy: { sortOrder: 'asc' }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  // Get current draft order if exists, or latest items
  const draftOrder = await prisma.order.findFirst({
    where: { tabId: tab.id, status: 'DRAFT' },
    include: { items: true }
  });

  const submittedOrders = await prisma.order.findMany({
    where: { tabId: tab.id, status: { not: 'DRAFT' } },
    include: { items: true }
  });

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm h-16 px-6 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold">
          {tab.table ? `Table ${tab.table.number}` : 'Tab'} {tab.name && `- ${tab.name}`}
        </h1>
        <div className="flex gap-2">
          {/* Action buttons like checkout */}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <OrderBuilder 
          tab={tab} 
          categories={categories} 
          draftOrder={draftOrder} 
          submittedOrders={submittedOrders} 
        />
      </div>
    </div>
  );
}
