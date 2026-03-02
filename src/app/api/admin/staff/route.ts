import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { generatePinCode, hashPin, verifyPin } from '@/lib/auth';

// GET /api/admin/staff — List all staff (no pin returned)
export async function GET(req: NextRequest) {
  try {
    const { staffId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.MANAGE_USERS);
    if (denied) return denied;

    const staff = await prisma.staff.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        rank: true,
        isActive: true,
        createdAt: true,
        failedAttempts: true,
        lockedUntil: true,
        permissions: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error('List staff error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/admin/staff — Create a new staff member
export async function POST(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.MANAGE_USERS);
    if (denied) return denied;

    const body = await req.json();
    const { name, rank, pinLength = 4, permissions } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (typeof rank !== 'number' || rank < 0 || rank > 7) {
      return NextResponse.json({ error: 'rank must be 0-7' }, { status: 400 });
    }
    if (pinLength !== 4 && pinLength !== 6) {
      return NextResponse.json({ error: 'pinLength must be 4 or 6' }, { status: 400 });
    }

    // Fetch all existing pin hashes to enforce uniqueness
    const existingStaff = await prisma.staff.findMany({
      where: { deletedAt: null },
      select: { pin: true },
    });

    // Generate a PIN that doesn't collide with any existing PIN
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
      pin = generatePinCode(pinLength as 4 | 6);
      pinHash = await hashPin(pin);

      // Check against all existing hashes
      const collisions = await Promise.all(
        existingStaff.map((s) => verifyPin(pin, s.pin))
      );
      const isUnique = collisions.every((match) => !match);
      if (isUnique) break;
      attempts++;
    } while (true);

    const member = await prisma.staff.create({
      data: {
        name,
        pin: pinHash,
        rank,
        isActive: true,
        permissions: permissions ?? undefined,
      },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'STAFF_CREATED',
      entityType: 'Staff',
      entityId: member.id,
      newData: { name: member.name, rank: member.rank, isActive: member.isActive },
    });

    if (permissions) {
      await logAudit({
        staffId,
        terminalId,
        action: 'PERMISSION_CHANGED',
        entityType: 'Staff',
        entityId: member.id,
        previousData: null,
        newData: { permissions },
      });
    }

    return NextResponse.json({
      success: true,
      pin, // cleartext PIN — returned once only
      staff: {
        id: member.id,
        name: member.name,
        rank: member.rank,
        isActive: member.isActive,
        createdAt: member.createdAt,
        failedAttempts: member.failedAttempts,
        lockedUntil: member.lockedUntil,
        permissions: member.permissions,
      },
    });
  } catch (error) {
    console.error('Create staff error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
