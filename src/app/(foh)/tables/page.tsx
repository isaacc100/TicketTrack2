import { prisma } from '@/lib/prisma';
import { TableGrid } from '@/components/tables/TableGrid';

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
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-green-500 block"></span>
            <span className="text-gray-600 font-medium">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-500 block"></span>
            <span className="text-gray-600 font-medium">Occupied</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <TableGrid initialTables={tables} />
      </div>
    </div>
  );
}
