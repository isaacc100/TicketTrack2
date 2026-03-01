'use client';

import { useAuth } from '@/hooks/useAuth';
import { Permission, hasPermission } from '@/lib/permissions';
import { ReactNode } from 'react';

interface PermissionGateProps {
  children: ReactNode;
  required: Permission;
  fallback?: ReactNode;
  /** If true, renders children but disabled (passes disabled prop) */
  disableInstead?: boolean;
}

export function PermissionGate({ children, required, fallback = null, disableInstead = false }: PermissionGateProps) {
  const { rank, permissions } = useAuth();

  const allowed = hasPermission(rank, permissions, required);

  if (!allowed) {
    if (disableInstead) {
      // Clone children and inject disabled prop
      return <div className="opacity-50 pointer-events-none">{children}</div>;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
