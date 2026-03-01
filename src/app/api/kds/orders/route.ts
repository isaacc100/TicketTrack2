import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/kds/orders — Fetch active KDS orders (optionally filtered by station)
export async function GET(req: NextRequest) {
  try {
    const station = req.nextUrl.searchParams.get('station');

    // Get all orders with SUBMITTED or PREPARING status
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['SUBMITTED', 'PREPARING'] },
        items: station
          ? { some: { kdsStation: station, kdsStatus: { not: 'SERVED' }, status: { not: 'VOID' } } }
          : undefined,
      },
      include: {
        items: {
          where: station
            ? { kdsStation: station, status: { not: 'VOID' } }
            : { status: { not: 'VOID' } },
          orderBy: { createdAt: 'asc' },
        },
        tab: {
          include: {
            table: { select: { number: true, name: true } },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { submittedAt: 'asc' },
      ],
    });

    // Transform to KDS-friendly shape
    const kdsOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      tabId: order.tabId,
      tableName: order.tab.table?.name || null,
      tableNumber: order.tab.table?.number || null,
      priority: order.priority,
      allergens: (order.tab.allergens as string[]) || [],
      notes: order.notes,
      submittedAt: order.submittedAt?.toISOString() || order.createdAt.toISOString(),
      items: order.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        modifiers: item.modifiers,
        notes: item.notes,
        kdsStation: item.kdsStation,
        kdsStatus: item.kdsStatus,
        startedAt: item.startedAt?.toISOString() || null,
        completedAt: item.completedAt?.toISOString() || null,
      })),
    }));

    return NextResponse.json({ orders: kdsOrders });
  } catch (error) {
    console.error('Get KDS orders error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
