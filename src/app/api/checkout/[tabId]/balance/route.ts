import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/checkout/[tabId]/balance — Get remaining balance for split bill support
export async function GET(
  req: NextRequest,
  { params }: { params: { tabId: string } }
) {
  try {
    const tab = await prisma.tab.findUnique({
      where: { id: params.tabId },
      include: {
        orders: {
          where: { status: { notIn: ['VOID'] } },
          include: { items: { where: { status: 'PENDING' } } },
        },
        payments: true,
      },
    });

    if (!tab) {
      return NextResponse.json({ error: 'Tab not found' }, { status: 404 });
    }

    // Calculate totals
    const orderTotal = tab.orders.reduce((sum, o) => sum + Number(o.total), 0);
    const paidTotal = tab.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const tipsTotal = tab.payments.reduce((sum, p) => sum + Number(p.tipAmount), 0);
    const remaining = Math.max(0, orderTotal - paidTotal);

    // Build item summary
    const allItems = tab.orders.flatMap(o => o.items);
    const itemCount = allItems.reduce((sum, i) => sum + i.quantity, 0);

    return NextResponse.json({
      tabId: params.tabId,
      orderTotal: Number(orderTotal.toFixed(2)),
      paidTotal: Number(paidTotal.toFixed(2)),
      tipsTotal: Number(tipsTotal.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
      itemCount,
      paymentCount: tab.payments.length,
      isFullyPaid: remaining <= 0,
      payments: tab.payments.map(p => ({
        id: p.id,
        method: p.method,
        amount: Number(p.amount),
        tipAmount: Number(p.tipAmount),
        processedAt: p.processedAt,
      })),
    });
  } catch (error) {
    console.error('Balance check error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
