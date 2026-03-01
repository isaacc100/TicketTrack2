import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const staffId = req.headers.get('x-staff-id');
    const terminalId = req.headers.get('x-terminal-id');

    if (!staffId || !terminalId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tableId, name, allergens } = await req.json();

    // Start a transaction: create Tab + update Table status
    const result = await prisma.$transaction(async (tx) => {
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

    return NextResponse.json({ success: true, tab: result });
  } catch (error) {
    console.error('Create tab error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
