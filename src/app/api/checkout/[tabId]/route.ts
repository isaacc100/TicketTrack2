import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { tabId: string } }) {
  try {
    const staffId = req.headers.get('x-staff-id');
    const terminalId = req.headers.get('x-terminal-id');

    if (!staffId || !terminalId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { method, amountTendered, total } = await req.json();

    const change = method === 'CASH' ? amountTendered - total : 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment
      const payment = await tx.payment.create({
        data: {
          tabId: params.tabId,
          method,
          amount: total,
          changeGiven: change,
          staffId,
        }
      });

      // 2. Close Tab
      const tab = await tx.tab.update({
        where: { id: params.tabId },
        data: { status: 'CLOSED', closedAt: new Date() }
      });

      // 3. Close open orders
      await tx.order.updateMany({
        where: { tabId: params.tabId, status: { notIn: ['CLOSED', 'VOID'] } },
        data: { status: 'CLOSED', closedAt: new Date() }
      });

      // 4. Free the table
      if (tab.tableId) {
        await tx.table.update({
          where: { id: tab.tableId },
          data: { status: 'AVAILABLE' }
        });
      }

      return payment;
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'PAYMENT_RECEIVED',
      entityType: 'Payment',
      entityId: result.id,
      newData: result
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Checkout error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
