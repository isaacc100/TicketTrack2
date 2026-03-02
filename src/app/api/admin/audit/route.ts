import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';

const CSV_HEADERS = [
  'timestamp',
  'staffId',
  'staffName',
  'terminalId',
  'action',
  'entityType',
  'entityId',
  'orderId',
  'previousData',
  'newData',
  'metadata',
].join(',');

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/admin/audit — Query audit logs
export async function GET(req: NextRequest) {
  try {
    const { staffId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.VIEW_AUDIT);
    if (denied) return denied;

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;
    const format = sp.get('format') || 'json';

    const filterStaffId = sp.get('staffId') || undefined;
    const action = sp.get('action') || undefined;
    const entityType = sp.get('entityType') || undefined;
    const orderId = sp.get('orderId') || undefined;
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');

    const where: Record<string, unknown> = {};
    if (filterStaffId) where.staffId = filterStaffId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (orderId) where.orderId = orderId;
    if (startDate || endDate) {
      const timestampFilter: Record<string, Date> = {};
      if (startDate) timestampFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        timestampFilter.lte = end;
      }
      where.timestamp = timestampFilter;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          staff: { select: { name: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const rows = logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      staffId: log.staffId,
      staffName: log.staff.name,
      terminalId: log.terminalId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      orderId: log.orderId,
      previousData: log.previousData,
      newData: log.newData,
      metadata: log.metadata,
    }));

    if (format === 'csv') {
      const lines = [
        CSV_HEADERS,
        ...rows.map((r) =>
          [
            r.timestamp.toISOString(),
            r.staffId,
            r.staffName,
            r.terminalId,
            r.action,
            r.entityType,
            r.entityId,
            r.orderId ?? '',
            r.previousData,
            r.newData,
            r.metadata,
          ]
            .map(escapeCsvField)
            .join(',')
        ),
      ];
      const csv = lines.join('\n');
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="audit-log.csv"',
        },
      });
    }

    return NextResponse.json({
      logs: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Audit log query error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
