import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

// POST /api/orders/[orderId]/items — Add items to an existing order
export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_ORDER);
    if (denied) return denied;

    const { items } = await req.json();
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (['CLOSED', 'VOID'].includes(order.status)) {
      return NextResponse.json({ error: 'Cannot add items to a closed or voided order' }, { status: 400 });
    }

    const additionalTotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create new order items
      await tx.orderItem.createMany({
        data: items.map((item: any) => ({
          orderId: params.orderId,
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          modifiers: item.modifiers || [],
          notes: item.notes || null,
        })),
      });

      // Update order totals
      const newSubtotal = Number(order.subtotal) + additionalTotal;
      const updatedOrder = await tx.order.update({
        where: { id: params.orderId },
        data: {
          subtotal: newSubtotal,
          total: order.discountType
            ? order.discountType === 'PERCENT'
              ? newSubtotal * (1 - Number(order.discountValue || 0) / 100)
              : Math.max(0, newSubtotal - Number(order.discountValue || 0))
            : newSubtotal,
        },
        include: { items: true },
      });

      return updatedOrder;
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'ITEMS_ADDED',
      entityType: 'Order',
      entityId: params.orderId,
      orderId: params.orderId,
      newData: { addedItems: items },
    });

    const io = getIO();
    if (io) {
      io.emit('order:updated', { order: result });
    }

    return NextResponse.json({ success: true, order: result });
  } catch (error) {
    console.error('Add items error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/orders/[orderId]/items — Void a specific item
export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.VOID_ITEM);
    if (denied) return denied;

    const { itemId, voidReason } = await req.json();

    if (!itemId) {
      return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    }

    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.orderId !== params.orderId) {
      return NextResponse.json({ error: 'Item not found in this order' }, { status: 404 });
    }

    if (item.status === 'VOID') {
      return NextResponse.json({ error: 'Item already voided' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Void the item
      const voidedItem = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          status: 'VOID',
          voidReason: voidReason || 'Item voided',
          voidedBy: staffId,
        },
      });

      // Recalculate order totals (exclude voided items)
      const remainingItems = await tx.orderItem.findMany({
        where: { orderId: params.orderId, status: 'PENDING' },
      });

      const newSubtotal = remainingItems.reduce(
        (acc, i) => acc + Number(i.price) * i.quantity,
        0
      );

      const order = await tx.order.findUnique({ where: { id: params.orderId } });
      const newTotal = order?.discountType
        ? order.discountType === 'PERCENT'
          ? newSubtotal * (1 - Number(order.discountValue || 0) / 100)
          : Math.max(0, newSubtotal - Number(order.discountValue || 0))
        : newSubtotal;

      const updatedOrder = await tx.order.update({
        where: { id: params.orderId },
        data: { subtotal: newSubtotal, total: newTotal },
        include: { items: true },
      });

      return { voidedItem, order: updatedOrder };
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'ITEM_VOIDED',
      entityType: 'OrderItem',
      entityId: itemId,
      orderId: params.orderId,
      previousData: { name: item.name, price: item.price, quantity: item.quantity },
      newData: { status: 'VOID', voidReason },
    });

    const io = getIO();
    if (io) {
      io.emit('order:updated', { order: result.order });
    }

    return NextResponse.json({ success: true, order: result.order });
  } catch (error) {
    console.error('Void item error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
