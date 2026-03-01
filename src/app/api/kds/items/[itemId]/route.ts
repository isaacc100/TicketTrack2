import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/api-guard';
import { logAudit } from '@/lib/audit';
import { getIO } from '@/lib/socket-server';

// PATCH /api/kds/items/[itemId] — Update KDS item status (start, bump, recall)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    if (!['start', 'bump', 'recall'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use: start, bump, recall' }, { status: 400 });
    }

    const item = await prisma.orderItem.findUnique({
      where: { id: params.itemId },
      include: { order: { include: { tab: { include: { table: true } } } } },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Validate transition
    const transitions: Record<string, string[]> = {
      start: ['PENDING'],       // can only start from PENDING
      bump: ['PENDING', 'IN_PROGRESS'], // can bump from PENDING or IN_PROGRESS
      recall: ['DONE'],         // can only recall from DONE
    };

    if (!transitions[action].includes(item.kdsStatus)) {
      return NextResponse.json(
        { error: `Cannot ${action} item in ${item.kdsStatus} status` },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {};

    switch (action) {
      case 'start':
        updateData.kdsStatus = 'IN_PROGRESS';
        updateData.startedAt = now;
        break;
      case 'bump':
        updateData.kdsStatus = 'DONE';
        updateData.completedAt = now;
        if (!item.startedAt) updateData.startedAt = now; // auto-start if bumped directly
        break;
      case 'recall':
        updateData.kdsStatus = 'IN_PROGRESS';
        updateData.completedAt = null;
        break;
    }

    const updated = await prisma.orderItem.update({
      where: { id: params.itemId },
      data: updateData,
    });

    // Check if all items in the order are now DONE
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: item.orderId, status: { not: 'VOID' } },
    });

    const allDone = orderItems.every(i => i.kdsStatus === 'DONE' || i.kdsStatus === 'SERVED');
    const anyInProgress = orderItems.some(i => i.kdsStatus === 'IN_PROGRESS');

    // Update order status based on item states
    if (allDone && action !== 'recall') {
      await prisma.order.update({
        where: { id: item.orderId },
        data: { status: 'READY' },
      });
    } else if (anyInProgress || action === 'start') {
      await prisma.order.update({
        where: { id: item.orderId },
        data: { status: 'PREPARING' },
      });
    }

    // Update table status
    if (item.order.tab.table) {
      const tableId = item.order.tab.table.id;
      if (allDone && action !== 'recall') {
        // All items done → table is READY
        await updateTableStatusFromOrders(tableId);
      } else if (action === 'recall') {
        // Recalled → back to AWAITING_FOOD
        await prisma.table.update({
          where: { id: tableId },
          data: { status: 'AWAITING_FOOD' },
        });
      }
    }

    await logAudit({
      staffId,
      terminalId,
      action: `KDS_ITEM_${action.toUpperCase()}`,
      entityType: 'OrderItem',
      entityId: params.itemId,
      orderId: item.orderId,
      previousData: { kdsStatus: item.kdsStatus },
      newData: { kdsStatus: updated.kdsStatus },
    });

    // Emit socket events
    const io = getIO();
    if (io) {
      const eventData = {
        itemId: params.itemId,
        orderId: item.orderId,
        kdsStatus: updated.kdsStatus,
        staffId,
      };

      if (action === 'start') {
        io.emit('kds:itemStarted', eventData);
      } else if (action === 'bump') {
        io.emit('kds:itemBumped', eventData);
        if (allDone) {
          io.emit('kds:orderComplete', { orderId: item.orderId });
          io.emit('pickup:ready', { orderId: item.orderId });
          if (item.order.tab.table) {
            io.emit('table:statusChanged', {
              tableId: item.order.tab.table.id,
              status: 'READY',
            });
          }
        }
      } else if (action === 'recall') {
        io.emit('kds:orderRecalled', { orderId: item.orderId });
      }
    }

    return NextResponse.json({
      success: true,
      item: updated,
      orderComplete: allDone && action !== 'recall',
    });
  } catch (error) {
    console.error('KDS item update error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Recalculate table status based on all open orders for that table.
 * - All items DONE → READY
 * - Some items in progress → AWAITING_FOOD
 * - Some items served → if all served, keep READY (pickup will handle)
 */
async function updateTableStatusFromOrders(tableId: string) {
  const openTabs = await prisma.tab.findMany({
    where: { tableId, status: 'OPEN' },
    include: {
      orders: {
        where: { status: { notIn: ['CLOSED', 'VOID', 'DRAFT'] } },
        include: {
          items: { where: { status: { not: 'VOID' } } },
        },
      },
    },
  });

  const allItems = openTabs.flatMap(t => t.orders.flatMap(o => o.items));

  if (allItems.length === 0) return;

  const allDoneOrServed = allItems.every(i => i.kdsStatus === 'DONE' || i.kdsStatus === 'SERVED');
  const allServed = allItems.every(i => i.kdsStatus === 'SERVED');

  if (allServed) {
    // All served — don't change (checkout will set PAID → AVAILABLE)
    return;
  }

  if (allDoneOrServed) {
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'READY' },
    });
  } else {
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'AWAITING_FOOD' },
    });
  }
}
