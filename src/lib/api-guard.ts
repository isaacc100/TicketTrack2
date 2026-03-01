import { NextRequest, NextResponse } from 'next/server';
import { Permission, hasPermission } from './permissions';
import { prisma } from './prisma';

/**
 * Extract auth info from request headers (set by middleware).
 */
export function getAuthFromRequest(req: NextRequest) {
  const staffId = req.headers.get('x-staff-id');
  const rank = parseInt(req.headers.get('x-staff-rank') || '0', 10);
  const terminalId = req.headers.get('x-terminal-id') || 'unknown';
  return { staffId, rank, terminalId };
}

/**
 * Check if the current request has the required permission.
 * Returns a 403 NextResponse if denied, or null if allowed.
 */
export async function requirePermission(
  req: NextRequest,
  required: Permission
): Promise<NextResponse | null> {
  const { staffId, rank } = getAuthFromRequest(req);

  if (!staffId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // For ranks 4-6, we may need custom permissions from the staff record
  let customPermissions = null;
  if (rank >= 4 && rank <= 6) {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { permissions: true },
    });
    customPermissions = staff?.permissions as any;
  }

  if (!hasPermission(rank, customPermissions, required)) {
    return NextResponse.json(
      { error: 'Permission denied', required },
      { status: 403 }
    );
  }

  return null; // Permission granted
}
