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

    const { tabId, items } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items' }, { status: 400 });
    }

    const subtotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tabId,
          staffId,
          status: 'SUBMITTED',
          subtotal,
          total: subtotal,
          submittedAt: new Date(),
          items: {
            create: items.map((item: any) => ({
              menuItemId: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              modifiers: item.modifiers || [],
              notes: item.notes,
            }))
          }
        },
        include: { items: true }
      });
      return order;
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'ORDER_SUBMITTED',
      entityType: 'Order',
      entityId: result.id,
      orderId: result.id,
      newData: result
    });

    return NextResponse.json({ success: true, order: result });
  } catch (error) {
    console.error('Submit order error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
