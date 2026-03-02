import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit, diffSnapshots } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { generatePinCode, hashPin, verifyPin } from '@/lib/auth';

// GET /api/admin/staff/[staffId] — Get single staff (no pin)
export async function GET(
  req: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const { staffId: actorId } = getAuthFromRequest(req);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.MANAGE_USERS);
    if (denied) return denied;

    const member = await prisma.staff.findUnique({
      where: { id: params.staffId },
      select: {
        id: true,
        name: true,
        rank: true,
        isActive: true,
        permissions: true,
        failedAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    return NextResponse.json({ staff: member });
  } catch (error) {
    console.error('Get staff error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/admin/staff/[staffId] — Update staff (name, rank, isActive, permissions)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const { staffId: actorId, terminalId } = getAuthFromRequest(req);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.MANAGE_USERS);
    if (denied) return denied;

    const before = await prisma.staff.findUnique({
      where: { id: params.staffId },
      select: {
        id: true,
        name: true,
        rank: true,
        isActive: true,
        permissions: true,
        failedAttempts: true,
        lockedUntil: true,
      },
    });

    if (!before) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, rank, isActive, permissions } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof name === 'string') updateData.name = name;
    if (typeof rank === 'number' && rank >= 0 && rank <= 7) updateData.rank = rank;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (permissions !== undefined) updateData.permissions = permissions;

    const after = await prisma.staff.update({
      where: { id: params.staffId },
      data: updateData,
      select: {
        id: true,
        name: true,
        rank: true,
        isActive: true,
        permissions: true,
        failedAttempts: true,
        lockedUntil: true,
      },
    });

    const diff = diffSnapshots(before, after);

    await logAudit({
      staffId: actorId,
      terminalId,
      action: 'STAFF_UPDATED',
      entityType: 'Staff',
      entityId: params.staffId,
      previousData: diff.before,
      newData: diff.after,
    });

    // Log permission changes separately if rank or permissions changed
    const rankChanged = rank !== undefined && before.rank !== after.rank;
    const permissionsChanged =
      permissions !== undefined &&
      JSON.stringify(before.permissions) !== JSON.stringify(after.permissions);

    if (rankChanged || permissionsChanged) {
      await logAudit({
        staffId: actorId,
        terminalId,
        action: 'PERMISSION_CHANGED',
        entityType: 'Staff',
        entityId: params.staffId,
        previousData: { rank: before.rank, permissions: before.permissions },
        newData: { rank: after.rank, permissions: after.permissions },
      });
    }

    return NextResponse.json({ success: true, staff: after });
  } catch (error) {
    console.error('Update staff error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/admin/staff/[staffId]?action=regenerate-pin — Regenerate PIN
export async function POST(
  req: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const { staffId: actorId, terminalId } = getAuthFromRequest(req);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const action = req.nextUrl.searchParams.get('action');
    if (action !== 'regenerate-pin') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const denied = await requirePermission(req, Permission.MANAGE_USERS);
    if (denied) return denied;

    const member = await prisma.staff.findUnique({
      where: { id: params.staffId },
      select: { id: true, name: true, pin: true },
    });

    if (!member) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Determine PIN length from existing hash (bcrypt hashes of 4-digit vs 6-digit PINs
    // are structurally identical, so we default to 4 unless a body hint is provided)
    const body = await req.json().catch(() => ({}));
    const pinLength: 4 | 6 = body.pinLength === 6 ? 6 : 4;

    // Fetch all OTHER staff pin hashes to enforce uniqueness
    const otherStaff = await prisma.staff.findMany({
      where: { deletedAt: null, id: { not: params.staffId } },
      select: { pin: true },
    });

    let pin: string;
    let pinHash: string;
    let attempts = 0;
    const MAX_ATTEMPTS = 50;

    do {
      if (attempts >= MAX_ATTEMPTS) {
        return NextResponse.json(
          { error: 'Could not generate a unique PIN; please try again' },
          { status: 500 }
        );
      }
      pin = generatePinCode(pinLength);
      pinHash = await hashPin(pin);

      const collisions = await Promise.all(
        otherStaff.map((s) => verifyPin(pin, s.pin))
      );
      const isUnique = collisions.every((match) => !match);
      if (isUnique) break;
      attempts++;
    } while (true);

    await prisma.staff.update({
      where: { id: params.staffId },
      data: { pin: pinHash, failedAttempts: 0, lockedUntil: null },
    });

    await logAudit({
      staffId: actorId,
      terminalId,
      action: 'PIN_REGENERATED',
      entityType: 'Staff',
      entityId: params.staffId,
      metadata: { targetName: member.name },
    });

    return NextResponse.json({
      success: true,
      pin, // cleartext PIN — returned once only
    });
  } catch (error) {
    console.error('Regenerate PIN error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
