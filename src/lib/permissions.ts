// Permission system for TicketTrack2
// Defines granular permissions and default rank-based access

export enum Permission {
  CREATE_ORDER = 'CREATE_ORDER',
  EDIT_ORDER = 'EDIT_ORDER',
  VOID_ITEM = 'VOID_ITEM',
  APPLY_DISCOUNT = 'APPLY_DISCOUNT',
  MARK_PRIORITY = 'MARK_PRIORITY',
  CHECKOUT = 'CHECKOUT',
  CLOSE_DAY = 'CLOSE_DAY',
  MANAGE_USERS = 'MANAGE_USERS',
  EDIT_MENU = 'EDIT_MENU',
  EDIT_TABLES = 'EDIT_TABLES',
  EDIT_SETTINGS = 'EDIT_SETTINGS',
  VIEW_AUDIT = 'VIEW_AUDIT',
  EXPORT_REPORTS = 'EXPORT_REPORTS',
  OVERRIDE = 'OVERRIDE',
}

// Default permission sets per rank
// Rank 0: Deactivated (no login)
// Rank 1: View Only
// Rank 2: Kitchen
// Rank 3: FOH
// Ranks 4-6: Custom (configurable)
// Rank 7: Admin (all)
const DEFAULT_PERMISSIONS: Record<number, Permission[]> = {
  0: [], // Deactivated
  1: [], // View only — no action permissions
  2: [], // Kitchen — KDS access only, no FOH permissions
  3: [   // FOH
    Permission.CREATE_ORDER,
    Permission.EDIT_ORDER,
    Permission.CHECKOUT,
  ],
  4: [   // Custom defaults — same as FOH + extras
    Permission.CREATE_ORDER,
    Permission.EDIT_ORDER,
    Permission.CHECKOUT,
    Permission.MARK_PRIORITY,
    Permission.APPLY_DISCOUNT,
  ],
  5: [   // Custom defaults — Senior FOH
    Permission.CREATE_ORDER,
    Permission.EDIT_ORDER,
    Permission.CHECKOUT,
    Permission.MARK_PRIORITY,
    Permission.APPLY_DISCOUNT,
    Permission.VOID_ITEM,
  ],
  6: [   // Custom defaults — Supervisor
    Permission.CREATE_ORDER,
    Permission.EDIT_ORDER,
    Permission.CHECKOUT,
    Permission.MARK_PRIORITY,
    Permission.APPLY_DISCOUNT,
    Permission.VOID_ITEM,
    Permission.EDIT_MENU,
    Permission.EDIT_TABLES,
    Permission.VIEW_AUDIT,
    Permission.EXPORT_REPORTS,
  ],
  7: Object.values(Permission), // Admin — everything
};

/**
 * Check if a staff member has a given permission.
 * @param rank The staff member's rank (0-7)
 * @param customPermissions Optional JSON overrides from the staff record { granted: [...], revoked: [...] }
 * @param required The permission to check
 */
export function hasPermission(
  rank: number,
  customPermissions: { granted?: string[]; revoked?: string[] } | null | undefined,
  required: Permission
): boolean {
  // Rank 0 = deactivated, never has permissions
  if (rank <= 0) return false;

  // Rank 7 = admin, always has all permissions
  if (rank >= 7) return true;

  const defaults = DEFAULT_PERMISSIONS[rank] || [];

  // Check custom overrides
  if (customPermissions) {
    // If explicitly revoked
    if (customPermissions.revoked?.includes(required)) return false;
    // If explicitly granted
    if (customPermissions.granted?.includes(required)) return true;
  }

  return defaults.includes(required);
}

/**
 * Get the full list of effective permissions for a rank + overrides.
 */
export function getEffectivePermissions(
  rank: number,
  customPermissions: { granted?: string[]; revoked?: string[] } | null | undefined
): Permission[] {
  if (rank <= 0) return [];
  if (rank >= 7) return Object.values(Permission);

  const defaults = new Set(DEFAULT_PERMISSIONS[rank] || []);

  if (customPermissions) {
    customPermissions.granted?.forEach(p => defaults.add(p as Permission));
    customPermissions.revoked?.forEach(p => defaults.delete(p as Permission));
  }

  return Array.from(defaults);
}

/**
 * Get all available permissions for display in management UIs.
 */
export function getAllPermissions(): { value: Permission; label: string }[] {
  return [
    { value: Permission.CREATE_ORDER, label: 'Create Orders' },
    { value: Permission.EDIT_ORDER, label: 'Edit Orders' },
    { value: Permission.VOID_ITEM, label: 'Void Items' },
    { value: Permission.APPLY_DISCOUNT, label: 'Apply Discounts' },
    { value: Permission.MARK_PRIORITY, label: 'Mark Priority' },
    { value: Permission.CHECKOUT, label: 'Checkout / Payment' },
    { value: Permission.CLOSE_DAY, label: 'Close Day' },
    { value: Permission.MANAGE_USERS, label: 'Manage Users' },
    { value: Permission.EDIT_MENU, label: 'Edit Menu' },
    { value: Permission.EDIT_TABLES, label: 'Edit Tables' },
    { value: Permission.EDIT_SETTINGS, label: 'Edit Settings' },
    { value: Permission.VIEW_AUDIT, label: 'View Audit Logs' },
    { value: Permission.EXPORT_REPORTS, label: 'Export Reports' },
    { value: Permission.OVERRIDE, label: 'Override Restrictions' },
  ];
}
