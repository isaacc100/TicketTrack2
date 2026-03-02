import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

// GET /api/tables — List all tables (any authenticated user)
export async function GET(req: NextRequest) {
  try {
    const { staffId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tables = await prisma.table.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { tabs: { where: { status: 'OPEN' } } },
        },
      },
      orderBy: { number: 'asc' },
    });

    const result = tables.map((t) => ({
      id: t.id,
      number: t.number,
      name: t.name,
      zone: t.zone,
      seats: t.seats,
      posX: t.posX,
      posY: t.posY,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      openTabCount: t._count.tabs,
    }));

    return NextResponse.json({ tables: result });
  } catch (error) {
    console.error('List tables error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/tables — Create a new table
export async function POST(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_TABLES);
    if (denied) return denied;

    const body = await req.json();
    const { number, name, zone, seats, posX, posY } = body;

    if (typeof number !== 'number') {
      return NextResponse.json({ error: 'number is required' }, { status: 400 });
    }

    const table = await prisma.table.create({
      data: {
        number,
        name: name ?? null,
        zone: zone ?? null,
        seats: seats ?? 2,
        posX: posX ?? 0,
        posY: posY ?? 0,
      },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'TABLE_CREATED',
      entityType: 'Table',
      entityId: table.id,
      newData: { number: table.number, name: table.name, zone: table.zone, seats: table.seats },
    });

    const io = getIO();
    if (io) io.emit('table:created', { table });

    return NextResponse.json({ success: true, table });
  } catch (error) {
    console.error('Create table error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
