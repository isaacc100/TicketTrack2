import { ReactNode } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CircleDollarSign,
  BarChart3,
  UtensilsCrossed,
  LayoutGrid,
  Settings,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/manager', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/manager/users', label: 'Users', icon: Users },
  { href: '/manager/audit', label: 'Audit Log', icon: ClipboardList },
  { href: '/manager/close-day', label: 'Close Day', icon: CircleDollarSign },
  { href: '/manager/reports', label: 'Reports', icon: BarChart3 },
  { href: '/manager/menu', label: 'Menu Editor', icon: UtensilsCrossed },
  { href: '/manager/tables', label: 'Tables', icon: LayoutGrid },
  { href: '/manager/settings', label: 'Settings', icon: Settings },
];

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        {/* Header */}
        <div className="h-16 flex items-center px-6 bg-gray-800 shrink-0">
          <span className="text-lg font-bold tracking-wide text-white">Manager</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition text-sm font-medium"
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-700">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-gray-700 transition text-sm font-medium"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
