import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function OrdersPage() {
  const openTabs = await prisma.tab.findMany({
    where: { status: 'OPEN' },
    include: {
      table: { select: { number: true, name: true } },
      orders: {
        where: { status: { notIn: ['CLOSED', 'VOID'] } },
        select: { id: true, status: true, total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white shadow-sm h-20 px-8 flex items-center justify-between z-10 shrink-0">
        <h1 className="text-2xl font-bold">Open Orders</h1>
        <span className="text-gray-500 font-medium">{openTabs.length} active tab{openTabs.length !== 1 ? 's' : ''}</span>
      </header>

      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        {openTabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-xl font-medium">No open tabs</p>
            <p className="mt-2">Open a tab from the <Link href="/tables" className="text-blue-600 underline">Tables</Link> view</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {openTabs.map(tab => (
              <Link
                key={tab.id}
                href={`/orders/${tab.id}`}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold">
                    {tab.table ? `T${tab.table.number}` : 'Takeaway'}
                    {tab.name && <span className="text-gray-500 font-normal ml-2">— {tab.name}</span>}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                    {tab.orders.length} order{tab.orders.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {tab.allergens && (tab.allergens as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(tab.allergens as string[]).map(a => (
                      <span key={a} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠️ {a}</span>
                    ))}
                  </div>
                )}

                {tab.orders.length > 0 && (
                  <div className="space-y-1">
                    {tab.orders.slice(0, 3).map(order => (
                      <div key={order.id} className="flex justify-between text-sm text-gray-600">
                        <span className="capitalize">{order.status.toLowerCase()}</span>
                        <span className="font-medium">£{Number(order.total).toFixed(2)}</span>
                      </div>
                    ))}
                    {tab.orders.length > 3 && (
                      <p className="text-xs text-gray-400">+{tab.orders.length - 3} more</p>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
