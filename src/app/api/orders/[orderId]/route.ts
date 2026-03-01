import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

// GET /api/orders/[orderId] — Get order details
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Get order error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/orders/[orderId] — Update order (priority, notes, status, void)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { priority, notes, status, voidReason } = body;

    // Check permission based on action
    if (status === 'VOID') {
      const denied = await requirePermission(req, Permission.VOID_ITEM);
      if (denied) return denied;
    } else {
      const denied = await requirePermission(req, Permission.EDIT_ORDER);
      if (denied) return denied;
    }

    const before = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { items: true },
    });

    if (!before) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (typeof priority === 'boolean') updateData.priority = priority;
    if (typeof notes === 'string') updateData.notes = notes;

    if (status === 'VOID') {
      updateData.status = 'VOID';
      updateData.closedAt = new Date();
      // Void all items in the order
      await prisma.orderItem.updateMany({
        where: { orderId: params.orderId },
        data: { status: 'VOID', voidReason: voidReason || 'Order voided', voidedBy: staffId },
      });
    } else if (status) {
      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['SUBMITTED'],
        SUBMITTED: ['PREPARING', 'VOID'],
        PREPARING: ['READY', 'VOID'],
        READY: ['SERVED', 'VOID'],
        SERVED: ['CLOSED'],
        CLOSED: [],
        VOID: [],
      };

      const allowed = validTransitions[before.status] || [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${before.status} to ${status}` },
          { status: 400 }
        );
      }
      updateData.status = status;
      if (status === 'SUBMITTED') updateData.submittedAt = new Date();
      if (status === 'CLOSED') updateData.closedAt = new Date();
    }

    const updated = await prisma.order.update({
      where: { id: params.orderId },
      data: updateData,
      include: { items: true },
    });

    await logAudit({
      staffId,
      terminalId,
      action: status === 'VOID' ? 'ORDER_VOIDED' : 'ORDER_UPDATED',
      entityType: 'Order',
      entityId: params.orderId,
      orderId: params.orderId,
      previousData: { status: before.status, priority: before.priority, notes: before.notes },
      newData: { status: updated.status, priority: updated.priority, notes: updated.notes },
      metadata: voidReason ? { voidReason } : undefined,
    });

    const io = getIO();
    if (io) {
      io.emit('order:updated', { order: updated });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error('Update order error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
