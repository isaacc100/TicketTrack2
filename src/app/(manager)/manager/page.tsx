'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  Users,
  ClipboardList,
  CircleDollarSign,
  BarChart3,
  UtensilsCrossed,
  LayoutGrid,
  Settings,
} from 'lucide-react';

interface DashboardStats {
  activeStaff: number;
  todayOrders: number;
  todayRevenue: number;
  openItems: number;
}

const quickLinks = [
  { href: '/manager/users', label: 'Users', icon: Users, color: 'bg-blue-500' },
  { href: '/manager/audit', label: 'Audit Log', icon: ClipboardList, color: 'bg-purple-500' },
  { href: '/manager/close-day', label: 'Close Day', icon: CircleDollarSign, color: 'bg-green-500' },
  { href: '/manager/reports', label: 'Reports', icon: BarChart3, color: 'bg-orange-500' },
  { href: '/manager/menu', label: 'Menu Editor', icon: UtensilsCrossed, color: 'bg-pink-500' },
  { href: '/manager/tables', label: 'Tables', icon: LayoutGrid, color: 'bg-teal-500' },
  { href: '/manager/settings', label: 'Settings', icon: Settings, color: 'bg-gray-500' },
];

export default function ManagerDashboard() {
  const { rank, isAuthenticated } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && rank < 4) {
      router.replace('/tables');
    }
  }, [isAuthenticated, rank, router]);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/admin/reports?type=dashboard');
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats ?? data);
        }
      } catch {
        // show zeros on error
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">{today}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Active Staff"
          value={loading ? '…' : String(stats?.activeStaff ?? 0)}
          color="border-blue-500"
        />
        <StatCard
          label="Today's Orders"
          value={loading ? '…' : String(stats?.todayOrders ?? 0)}
          color="border-green-500"
        />
        <StatCard
          label="Today's Revenue"
          value={loading ? '…' : `£${((stats?.todayRevenue ?? 0) / 100).toFixed(2)}`}
          color="border-orange-500"
        />
        <StatCard
          label="Open / Incomplete"
          value={loading ? '…' : String(stats?.openItems ?? 0)}
          color="border-red-500"
        />
      </div>

      {/* Quick links */}
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Quick Access</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {quickLinks.map(({ href, label, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-xl shadow-sm p-5 flex flex-col items-center gap-3 hover:shadow-md transition"
          >
            <div className={`${color} text-white rounded-xl p-3`}>
              <Icon className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${color}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
