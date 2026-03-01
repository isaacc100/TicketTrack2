import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

export async function POST(req: NextRequest) {
  try {
    const staffId = req.headers.get('x-staff-id');
    const terminalId = req.headers.get('x-terminal-id');

    if (!staffId || !terminalId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: creating a tab implies creating an order
    const denied = await requirePermission(req, Permission.CREATE_ORDER);
    if (denied) return denied;

    const { tableId, name, allergens } = await req.json();

    // Start a transaction: create Tab + update Table status
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tab = await tx.tab.create({
        data: {
          tableId,
          name,
          allergens: allergens || [],
          staffId,
        }
      });

      if (tableId) {
        await tx.table.update({
          where: { id: tableId },
          data: { status: 'OCCUPIED' }
        });
      }

      return tab;
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'TAB_CREATED',
      entityType: 'Tab',
      entityId: result.id,
      newData: result
    });

    // Emit real-time event
    const io = getIO();
    if (io) {
      io.emit('tab:opened', { tab: result });
      if (result.tableId) {
        io.emit('table:statusChanged', { tableId: result.tableId, status: 'OCCUPIED' });
      }
    }

    return NextResponse.json({ success: true, tab: result });
  } catch (error) {
    console.error('Create tab error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
