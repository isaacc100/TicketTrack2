import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

export async function POST(req: NextRequest, { params }: { params: { tabId: string } }) {
  try {
    const staffId = req.headers.get('x-staff-id');
    const terminalId = req.headers.get('x-terminal-id');

    if (!staffId || !terminalId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check
    const denied = await requirePermission(req, Permission.CHECKOUT);
    if (denied) return denied;

    const { method, amountTendered, total, tipAmount, discountType, discountValue } = await req.json();

    const change = method === 'CASH' ? amountTendered - total : 0;

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Apply discount to orders if present
      if (discountType && discountValue) {
        const openOrders = await tx.order.findMany({
          where: { tabId: params.tabId, status: { notIn: ['CLOSED', 'VOID'] } },
        });
        for (const order of openOrders) {
          let discountedTotal = Number(order.subtotal);
          if (discountType === 'PERCENT') {
            discountedTotal = discountedTotal * (1 - discountValue / 100);
          } else {
            discountedTotal = Math.max(0, discountedTotal - discountValue);
          }
          await tx.order.update({
            where: { id: order.id },
            data: { discountType, discountValue, total: discountedTotal },
          });
        }
      }

      // 2. Create Payment
      const payment = await tx.payment.create({
        data: {
          tabId: params.tabId,
          method,
          amount: total,
          tipAmount: tipAmount || 0,
          changeGiven: change > 0 ? change : 0,
          staffId,
        }
      });

      // 3. Check if tab is fully paid (for split bill support)
      const allPayments = await tx.payment.findMany({
        where: { tabId: params.tabId },
      });
      const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Get tab total from all non-voided orders
      const tabOrders = await tx.order.findMany({
        where: { tabId: params.tabId, status: { notIn: ['VOID'] } },
      });
      const tabTotal = tabOrders.reduce((sum, o) => sum + Number(o.total), 0);

      // Only close if fully paid
      if (totalPaid >= tabTotal) {
        // Close Tab
        const tab = await tx.tab.update({
          where: { id: params.tabId },
          data: { status: 'CLOSED', closedAt: new Date() }
        });

        // Close open orders
        await tx.order.updateMany({
          where: { tabId: params.tabId, status: { notIn: ['CLOSED', 'VOID'] } },
          data: { status: 'CLOSED', closedAt: new Date() }
        });

        // Free the table
        if (tab.tableId) {
          await tx.table.update({
            where: { id: tab.tableId },
            data: { status: 'AVAILABLE' }
          });
        }

        return { payment, fullyClosed: true, tableId: tab.tableId };
      }

      return { payment, fullyClosed: false, tableId: null };
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'PAYMENT_RECEIVED',
      entityType: 'Payment',
      entityId: result.payment.id,
      newData: result.payment,
      metadata: { tipAmount, discountType, discountValue, fullyClosed: result.fullyClosed },
    });

    // If a discount was applied, log it separately
    if (discountType && discountValue) {
      await logAudit({
        staffId,
        terminalId,
        action: 'DISCOUNT_APPLIED',
        entityType: 'Tab',
        entityId: params.tabId,
        newData: { discountType, discountValue },
      });
    }

    // Emit real-time events
    const io = getIO();
    if (io) {
      if (result.fullyClosed) {
        io.emit('tab:closed', { tabId: params.tabId });
        if (result.tableId) {
          io.emit('table:statusChanged', { tableId: result.tableId, status: 'AVAILABLE' });
        }
      }
    }

    return NextResponse.json({ success: true, fullyClosed: result.fullyClosed });
  } catch (error) {
    console.error('Checkout error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
