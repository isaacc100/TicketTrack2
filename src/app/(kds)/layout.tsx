import { ReactNode } from 'react';

export default function KdsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen bg-gray-900 text-white overflow-hidden select-none touch-manipulation">
      {children}
    </div>
  );
}
