import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';

function parseDateRange(startDate: string | null, endDate: string | null) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const start = startDate ? new Date(startDate) : todayStart;
  const end = endDate
    ? (() => {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        return d;
      })()
    : todayEnd;

  return { start, end };
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsvField).join(','))].join('\n');
}

// GET /api/admin/reports — Generate reports
export async function GET(req: NextRequest) {
  try {
    const { staffId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EXPORT_REPORTS);
    if (denied) return denied;

    const sp = req.nextUrl.searchParams;
    const type = sp.get('type') || 'z-report';
    const format = sp.get('format') || 'json';
    const { start, end } = parseDateRange(sp.get('startDate'), sp.get('endDate'));
    const dateLabel = start.toISOString().split('T')[0];

    if (type === 'z-report' || type === 'sales') {
      const payments = await prisma.payment.findMany({
        where: { processedAt: { gte: start, lte: end } },
      });

      const salesPayments = payments.filter((p) => p.type === 'PAYMENT');
      const refundPayments = payments.filter((p) => p.type === 'REFUND');

      const totalRevenue = salesPayments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );
      const totalRefunds = refundPayments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );
      const totalCash = salesPayments
        .filter((p) => p.method === 'CASH')
        .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
      const totalCard = salesPayments
        .filter((p) => p.method === 'CARD')
        .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
      const totalTips = payments.reduce(
        (sum, p) => sum.add(p.tipAmount),
        new Prisma.Decimal(0)
      );

      // Discounts from orders
      const orders = await prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { discountType: true, discountValue: true, subtotal: true },
      });
      const totalDiscounts = orders.reduce((sum, o) => {
        if (!o.discountValue) return sum;
        if (o.discountType === 'FIXED') return sum.add(o.discountValue);
        if (o.discountType === 'PERCENT')
          return sum.add(o.subtotal.mul(o.discountValue).div(100));
        return sum;
      }, new Prisma.Decimal(0));

      const totalVoids = await prisma.orderItem.count({
        where: { status: 'VOID', createdAt: { gte: start, lte: end } },
      });
      const totalOrders = await prisma.order.count({
        where: { status: 'CLOSED', closedAt: { gte: start, lte: end } },
      });

      // Payment breakdown by method
      const paymentBreakdown = Object.entries(
        salesPayments.reduce<Record<string, { count: number; amount: Prisma.Decimal }>>(
          (acc, p) => {
            if (!acc[p.method]) acc[p.method] = { count: 0, amount: new Prisma.Decimal(0) };
            acc[p.method].count += 1;
            acc[p.method].amount = acc[p.method].amount.add(p.amount);
            return acc;
          },
          {}
        )
      ).map(([method, data]) => ({ method, count: data.count, amount: data.amount }));

      // Item breakdown
      const orderItems = await prisma.orderItem.findMany({
        where: {
          status: { not: 'VOID' },
          createdAt: { gte: start, lte: end },
        },
        select: { name: true, price: true, quantity: true },
      });

      const itemMap = new Map<string, { qty: number; revenue: Prisma.Decimal }>();
      for (const item of orderItems) {
        const existing = itemMap.get(item.name) ?? { qty: 0, revenue: new Prisma.Decimal(0) };
        itemMap.set(item.name, {
          qty: existing.qty + item.quantity,
          revenue: existing.revenue.add(item.price.mul(item.quantity)),
        });
      }
      const itemBreakdown = Array.from(itemMap.entries())
        .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }))
        .sort((a, b) => b.qty - a.qty);

      const report = {
        date: dateLabel,
        totalRevenue,
        totalRefunds,
        totalCash,
        totalCard,
        totalTips,
        totalDiscounts,
        totalVoids,
        totalOrders,
        itemBreakdown,
        paymentBreakdown,
      };

      if (format === 'csv') {
        const sections: string[] = [
          `Z-Report,${dateLabel}`,
          '',
          toCsv(
            ['metric', 'value'],
            [
              ['Total Revenue', totalRevenue.toString()],
              ['Total Refunds', totalRefunds.toString()],
              ['Total Cash', totalCash.toString()],
              ['Total Card', totalCard.toString()],
              ['Total Tips', totalTips.toString()],
              ['Total Discounts', totalDiscounts.toString()],
              ['Total Voids', totalVoids.toString()],
              ['Total Orders', totalOrders.toString()],
            ]
          ),
          '',
          'Payment Breakdown',
          toCsv(
            ['method', 'count', 'amount'],
            paymentBreakdown.map((p) => [p.method, p.count, p.amount.toString()])
          ),
          '',
          'Item Breakdown',
          toCsv(
            ['name', 'qty', 'revenue'],
            itemBreakdown.map((i) => [i.name, i.qty, i.revenue.toString()])
          ),
        ];

        return new NextResponse(sections.join('\n'), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="z-report-${dateLabel}.csv"`,
          },
        });
      }

      return NextResponse.json({ report });
    }

    if (type === 'staff') {
      const staffList = await prisma.staff.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, rank: true },
      });

      const results = await Promise.all(
        staffList.map(async (s) => {
          const orderCount = await prisma.order.count({
            where: { staffId: s.id, createdAt: { gte: start, lte: end } },
          });
          const payments = await prisma.payment.findMany({
            where: {
              staffId: s.id,
              type: 'PAYMENT',
              processedAt: { gte: start, lte: end },
            },
            select: { amount: true },
          });
          const totalSales = payments.reduce(
            (sum, p) => sum.add(p.amount),
            new Prisma.Decimal(0)
          );
          return { ...s, orderCount, totalSales };
        })
      );

      if (format === 'csv') {
        const csv = toCsv(
          ['id', 'name', 'rank', 'orderCount', 'totalSales'],
          results.map((r) => [r.id, r.name, r.rank, r.orderCount, r.totalSales.toString()])
        );
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="staff-report-${dateLabel}.csv"`,
          },
        });
      }

      return NextResponse.json({ report: results });
    }

    if (type === 'items') {
      const orderItems = await prisma.orderItem.findMany({
        where: { createdAt: { gte: start, lte: end }, status: { not: 'VOID' } },
        select: { menuItemId: true, name: true, price: true, quantity: true },
      });

      const itemMap = new Map<
        string,
        { name: string; qty: number; revenue: Prisma.Decimal }
      >();
      for (const item of orderItems) {
        const existing = itemMap.get(item.menuItemId) ?? {
          name: item.name,
          qty: 0,
          revenue: new Prisma.Decimal(0),
        };
        itemMap.set(item.menuItemId, {
          name: item.name,
          qty: existing.qty + item.quantity,
          revenue: existing.revenue.add(item.price.mul(item.quantity)),
        });
      }
      const items = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty);

      if (format === 'csv') {
        const csv = toCsv(
          ['name', 'qty', 'revenue'],
          items.map((i) => [i.name, i.qty, i.revenue.toString()])
        );
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="items-report-${dateLabel}.csv"`,
          },
        });
      }

      return NextResponse.json({ report: items });
    }

    if (type === 'tables') {
      const tables = await prisma.table.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          number: true,
          name: true,
          zone: true,
          tabs: {
            where: { closedAt: { gte: start, lte: end } },
            select: {
              guestCount: true,
              orders: {
                select: { total: true },
              },
            },
          },
        },
      });

      const result = tables.map((t) => ({
        id: t.id,
        number: t.number,
        name: t.name,
        zone: t.zone,
        coverCount: t.tabs.reduce((sum, tab) => sum + (tab.guestCount ?? 0), 0),
        totalRevenue: t.tabs.reduce(
          (sum, tab) =>
            tab.orders.reduce((s, o) => s.add(o.total), sum),
          new Prisma.Decimal(0)
        ),
      }));

      if (format === 'csv') {
        const csv = toCsv(
          ['id', 'number', 'name', 'zone', 'coverCount', 'totalRevenue'],
          result.map((r) => [
            r.id,
            r.number,
            r.name ?? '',
            r.zone ?? '',
            r.coverCount,
            r.totalRevenue.toString(),
          ])
        );
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="tables-report-${dateLabel}.csv"`,
          },
        });
      }

      return NextResponse.json({ report: result });
    }

    return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  } catch (error) {
    console.error('Report error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
