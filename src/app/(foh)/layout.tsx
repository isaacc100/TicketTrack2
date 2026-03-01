import { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut, LayoutGrid, CheckSquare, Settings, ChefHat, Bell } from 'lucide-react';

export default function FohLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden select-none touch-manipulation">
      {/* Sidebar Navigation */}
      <aside className="w-24 bg-gray-900 text-white flex flex-col items-center py-6 gap-8">
        <div className="text-2xl font-bold bg-blue-600 rounded-full w-14 h-14 flex items-center justify-center mb-4">
          POS
        </div>
        
        <nav className="flex-1 flex flex-col gap-6 w-full px-4">
          <Link href="/tables" className="flex flex-col items-center gap-2 text-gray-300 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition">
            <LayoutGrid className="w-8 h-8" />
            <span className="text-xs">Tables</span>
          </Link>
          
          <Link href="/orders" className="flex flex-col items-center gap-2 text-gray-300 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition">
            <CheckSquare className="w-8 h-8" />
            <span className="text-xs">Orders</span>
          </Link>

          <Link href="/menu" className="flex flex-col items-center gap-2 text-gray-300 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition">
            <Settings className="w-8 h-8" />
            <span className="text-xs">Menu</span>
          </Link>

          <div className="border-t border-gray-700 my-2 w-full" />

          <Link href="/kds" className="flex flex-col items-center gap-2 text-gray-300 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition">
            <ChefHat className="w-8 h-8" />
            <span className="text-xs">KDS</span>
          </Link>

          <Link href="/pickup" className="flex flex-col items-center gap-2 text-gray-300 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition">
            <Bell className="w-8 h-8" />
            <span className="text-xs">Pickup</span>
          </Link>
        </nav>

        <form action="/api/auth/logout" method="POST" className="mt-auto w-full px-4">
          <button type="submit" className="w-full flex flex-col items-center gap-2 text-red-400 hover:text-red-300 p-2 rounded-xl hover:bg-gray-800 transition">
            <LogOut className="w-8 h-8" />
            <span className="text-xs">Lock</span>
          </button>
        </form>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
