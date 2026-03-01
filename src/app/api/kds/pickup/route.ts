import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/api-guard';
import { logAudit } from '@/lib/audit';
import { getIO } from '@/lib/socket-server';

// GET /api/kds/pickup — Fetch orders ready for pickup
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'READY' },
      include: {
        items: {
          where: { status: { not: 'VOID' } },
          orderBy: { createdAt: 'asc' },
        },
        tab: {
          include: {
            table: { select: { id: true, number: true, name: true } },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { submittedAt: 'asc' },
      ],
    });

    const pickupOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      tabId: order.tabId,
      tableName: order.tab.table?.name || null,
      tableNumber: order.tab.table?.number || null,
      tableId: order.tab.table?.id || null,
      priority: order.priority,
      allergens: (order.tab.allergens as string[]) || [],
      items: order.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        modifiers: item.modifiers,
        kdsStatus: item.kdsStatus,
        completedAt: item.completedAt?.toISOString() || null,
        servedAt: item.servedAt?.toISOString() || null,
      })),
    }));

    return NextResponse.json({ orders: pickupOrders });
  } catch (error) {
    console.error('Get pickup orders error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/kds/pickup — Mark an order as served (all items picked up)
export async function POST(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { where: { status: { not: 'VOID' } } },
        tab: { include: { table: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'READY') {
      return NextResponse.json({ error: 'Order is not ready for pickup' }, { status: 400 });
    }

    const now = new Date();

    // Mark all items as SERVED
    await prisma.orderItem.updateMany({
      where: {
        orderId,
        status: { not: 'VOID' },
      },
      data: {
        kdsStatus: 'SERVED',
        servedAt: now,
      },
    });

    // Update order status to SERVED
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SERVED' },
    });

    // Update table status — check if all orders for this table are served
    if (order.tab.table) {
      const openOrders = await prisma.order.findMany({
        where: {
          tab: { tableId: order.tab.table.id, status: 'OPEN' },
          status: { notIn: ['CLOSED', 'VOID', 'SERVED', 'DRAFT'] },
        },
      });

      // If no more pending orders → set table to OCCUPIED (served, awaiting checkout)
      if (openOrders.length === 0) {
        await prisma.table.update({
          where: { id: order.tab.table.id },
          data: { status: 'OCCUPIED' },
        });
      }
    }

    await logAudit({
      staffId,
      terminalId,
      action: 'ORDER_SERVED',
      entityType: 'Order',
      entityId: orderId,
      orderId,
      previousData: { status: order.status },
      newData: { status: 'SERVED' },
    });

    const io = getIO();
    if (io) {
      io.emit('pickup:served', { orderId });
      io.emit('order:updated', { orderId, status: 'SERVED' });
      if (order.tab.table) {
        io.emit('table:statusChanged', {
          tableId: order.tab.table.id,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pickup serve error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
