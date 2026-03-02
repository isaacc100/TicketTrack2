import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';

function todayRange(): { gte: Date; lte: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { gte: start, lte: end };
}

// GET /api/admin/day-close — Get latest day close or check if today is already closed
export async function GET(req: NextRequest) {
  try {
    const { staffId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.CLOSE_DAY);
    if (denied) return denied;

    const range = todayRange();

    const todayClose = await prisma.dayClose.findFirst({
      where: { date: { gte: range.gte, lte: range.lte } },
      include: { staff: { select: { name: true } } },
      orderBy: { closedAt: 'desc' },
    });

    if (todayClose) {
      return NextResponse.json({ alreadyClosed: true, dayClose: todayClose });
    }

    const latest = await prisma.dayClose.findFirst({
      include: { staff: { select: { name: true } } },
      orderBy: { closedAt: 'desc' },
    });

    return NextResponse.json({ alreadyClosed: false, latest: latest ?? null });
  } catch (error) {
    console.error('Get day close error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/admin/day-close — Close the day
export async function POST(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.CLOSE_DAY);
    if (denied) return denied;

    const body = await req.json();
    const { openingCash, closingCash: closingCashInput, lostItems = [] } = body;

    if (openingCash === undefined || openingCash === null) {
      return NextResponse.json({ error: 'openingCash is required' }, { status: 400 });
    }

    const range = todayRange();

    // Check if already closed today
    const existingClose = await prisma.dayClose.findFirst({
      where: { date: { gte: range.gte, lte: range.lte } },
    });
    if (existingClose) {
      return NextResponse.json({ error: 'Day has already been closed today' }, { status: 409 });
    }

    // Check for any open/incomplete orders
    const openOrders = await prisma.order.findMany({
      where: {
        status: { notIn: ['CLOSED', 'VOID'] },
        createdAt: { gte: range.gte },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        tabId: true,
      },
    });

    if (openOrders.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot close day: there are open orders',
          openOrders,
        },
        { status: 400 }
      );
    }

    // Calculate totals from payments today
    const payments = await prisma.payment.findMany({
      where: { processedAt: { gte: range.gte, lte: range.lte } },
    });

    const totalSales = payments
      .filter((p) => p.type === 'PAYMENT')
      .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

    const totalRefunds = payments
      .filter((p) => p.type === 'REFUND')
      .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

    const totalTips = payments.reduce(
      (sum, p) => sum.add(p.tipAmount),
      new Prisma.Decimal(0)
    );

    const cashSales = payments
      .filter((p) => p.type === 'PAYMENT' && p.method === 'CASH')
      .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

    const cashRefunds = payments
      .filter((p) => p.type === 'REFUND' && p.method === 'CASH')
      .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

    const totalChangeGiven = payments
      .filter((p) => p.type === 'PAYMENT' && p.method === 'CASH' && p.changeGiven)
      .reduce((sum, p) => sum.add(p.changeGiven!), new Prisma.Decimal(0));

    // Count voided order items today
    const totalVoids = await prisma.orderItem.count({
      where: {
        status: 'VOID',
        createdAt: { gte: range.gte, lte: range.lte },
      },
    });

    // Order and cover counts
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['CLOSED'] },
        closedAt: { gte: range.gte, lte: range.lte },
      },
      select: { id: true, tabId: true },
    });

    const orderCount = orders.length;

    const tabs = await prisma.tab.findMany({
      where: { closedAt: { gte: range.gte, lte: range.lte } },
      select: { guestCount: true },
    });
    const coverCount = tabs.reduce((sum, t) => sum + (t.guestCount ?? 0), 0);

    const openingCashDecimal = new Prisma.Decimal(openingCash);
    const expectedCash = openingCashDecimal.add(cashSales).sub(cashRefunds).sub(totalChangeGiven);
    // Use provided closing cash; fall back to expected if not supplied
    const closingCash =
      closingCashInput !== undefined && closingCashInput !== null
        ? new Prisma.Decimal(closingCashInput)
        : expectedCash;
    const variance = closingCash.sub(expectedCash);

    // Payment breakdown for report
    const paymentBreakdown = Object.entries(
      payments
        .filter((p) => p.type === 'PAYMENT')
        .reduce<Record<string, { count: number; amount: Prisma.Decimal }>>((acc, p) => {
          if (!acc[p.method]) acc[p.method] = { count: 0, amount: new Prisma.Decimal(0) };
          acc[p.method].count += 1;
          acc[p.method].amount = acc[p.method].amount.add(p.amount);
          return acc;
        }, {})
    ).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
    }));

    const reportData = {
      date: range.gte.toISOString().split('T')[0],
      totalSales,
      totalRefunds,
      totalTips,
      totalVoids,
      orderCount,
      coverCount,
      openingCash: openingCashDecimal,
      expectedCash,
      closingCash,
      variance,
      paymentBreakdown,
      lostItems,
    };

    const dayClose = await prisma.dayClose.create({
      data: {
        date: range.gte,
        staffId,
        openingCash: openingCashDecimal,
        closingCash,
        expectedCash,
        variance,
        totalSales,
        totalRefunds,
        totalTips,
        totalVoids,
        orderCount,
        coverCount,
        lostItems: lostItems.length > 0 ? lostItems : undefined,
        reportData,
      },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'DAY_CLOSED',
      entityType: 'DayClose',
      entityId: dayClose.id,
      newData: { date: reportData.date, totalSales, orderCount },
    });

    return NextResponse.json({ success: true, dayClose, reportData });
  } catch (error) {
    console.error('Day close error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
