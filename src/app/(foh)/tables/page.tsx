import { prisma } from '@/lib/prisma';
import { TableGrid } from '@/components/tables/TableGrid';
import type { TableWithTabs } from '@/types';

export default async function TablesPage() {
  const tables = await prisma.table.findMany({
    where: { deletedAt: null },
    include: {
      tabs: {
        where: { status: 'OPEN' }
      }
    },
    orderBy: { number: 'asc' }
  });

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white shadow-sm h-20 px-8 flex items-center justify-between z-10 shrink-0">
        <h1 className="text-2xl font-bold">Floorplan</h1>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 block"></span>
            <span className="text-gray-600 text-sm">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 block"></span>
            <span className="text-gray-600 text-sm">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 block"></span>
            <span className="text-gray-600 text-sm">Awaiting</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 block"></span>
            <span className="text-gray-600 text-sm">Ready</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500 block"></span>
            <span className="text-gray-600 text-sm">Paid</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <TableGrid initialTables={tables as unknown as TableWithTabs[]} />
      </div>
    </div>
  );
}
