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

    // Permission check
    const denied = await requirePermission(req, Permission.CREATE_ORDER);
    if (denied) return denied;

    const { tabId, items } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items' }, { status: 400 });
    }

    const subtotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);

    // Look up default kdsStation for each menu item
    const menuItemIds = items.map((item: any) => item.menuItemId).filter(Boolean);
    const menuItems = menuItemIds.length > 0
      ? await prisma.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: { id: true, kdsStation: true },
        })
      : [];
    const stationMap = new Map(menuItems.map(m => [m.id, m.kdsStation]));

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
              kdsStation: item.kdsStation || stationMap.get(item.menuItemId) || null,
            }))
          }
        },
        include: {
          items: true,
          tab: { include: { table: { select: { id: true, number: true, name: true } } } },
        },
      });

      // Update table status to AWAITING_FOOD if it has a table
      if (order.tab.table) {
        await tx.table.update({
          where: { id: order.tab.table.id },
          data: { status: 'AWAITING_FOOD' },
        });
      }

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

    // Emit real-time events
    const io = getIO();
    if (io) {
      io.emit('order:created', { order: result });
      // KDS new order event
      io.emit('kds:newOrder', {
        order: {
          id: result.id,
          orderNumber: result.orderNumber,
          tabId: result.tabId,
          tableName: result.tab.table?.name || null,
          tableNumber: result.tab.table?.number || null,
          priority: result.priority,
          allergens: (result.tab.allergens as string[]) || [],
          notes: result.notes,
          submittedAt: result.submittedAt?.toISOString(),
          items: result.items.map(i => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            modifiers: i.modifiers,
            notes: i.notes,
            kdsStation: i.kdsStation,
            kdsStatus: i.kdsStatus,
            startedAt: null,
            completedAt: null,
          })),
        },
      });
      // Table status update
      if (result.tab.table) {
        io.emit('table:statusChanged', {
          tableId: result.tab.table.id,
          status: 'AWAITING_FOOD',
        });
      }
    }

    return NextResponse.json({ success: true, order: result });
  } catch (error) {
    console.error('Submit order error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
