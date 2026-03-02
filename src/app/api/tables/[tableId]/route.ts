import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit, diffSnapshots } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

// GET /api/tables/[tableId] — Get single table with open tabs
export async function GET(
  _req: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const table = await prisma.table.findFirst({
      where: { id: params.tableId, deletedAt: null },
      include: {
        tabs: {
          where: { status: 'OPEN' },
          include: {
            orders: {
              where: { status: { notIn: ['CLOSED', 'VOID'] } },
              select: { id: true, status: true, total: true, orderNumber: true },
            },
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    return NextResponse.json({ table });
  } catch (error) {
    console.error('Get table error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/tables/[tableId] — Update a table
export async function PUT(
  req: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_TABLES);
    if (denied) return denied;

    const before = await prisma.table.findFirst({
      where: { id: params.tableId, deletedAt: null },
    });
    if (!before) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    const body = await req.json();
    const { number, name, zone, seats, posX, posY, status } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof number === 'number') updateData.number = number;
    if (typeof name === 'string' || name === null) updateData.name = name;
    if (typeof zone === 'string' || zone === null) updateData.zone = zone;
    if (typeof seats === 'number') updateData.seats = seats;
    if (typeof posX === 'number') updateData.posX = posX;
    if (typeof posY === 'number') updateData.posY = posY;
    if (typeof status === 'string') updateData.status = status;

    const table = await prisma.table.update({
      where: { id: params.tableId },
      data: updateData,
    });

    const diff = diffSnapshots(before, table);

    await logAudit({
      staffId,
      terminalId,
      action: 'TABLE_UPDATED',
      entityType: 'Table',
      entityId: params.tableId,
      previousData: diff.before,
      newData: diff.after,
    });

    const io = getIO();
    if (io) io.emit('table:updated', { table });

    return NextResponse.json({ success: true, table });
  } catch (error) {
    console.error('Update table error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/tables/[tableId] — Soft-delete table (only if no open tabs)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_TABLES);
    if (denied) return denied;

    const table = await prisma.table.findFirst({
      where: { id: params.tableId, deletedAt: null },
      include: { _count: { select: { tabs: { where: { status: 'OPEN' } } } } },
    });
    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    if (table._count.tabs > 0) {
      return NextResponse.json(
        { error: 'Cannot delete table with open tabs' },
        { status: 400 }
      );
    }

    await prisma.table.update({
      where: { id: params.tableId },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'TABLE_DELETED',
      entityType: 'Table',
      entityId: params.tableId,
      previousData: { number: table.number, name: table.name, zone: table.zone },
    });

    const io = getIO();
    if (io) io.emit('table:deleted', { tableId: params.tableId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete table error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
