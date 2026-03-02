import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';

// GET /api/admin/config — Get all system config as key-value object
export async function GET(req: NextRequest) {
  try {
    const { staffId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_SETTINGS);
    if (denied) return denied;

    const records = await prisma.systemConfig.findMany();
    const config: Record<string, unknown> = {};
    for (const record of records) {
      config[record.key] = record.value;
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Get config error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/admin/config — Upsert a single config key
export async function PUT(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_SETTINGS);
    if (denied) return denied;

    const body = await req.json();
    const { key, value } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }
    if (value === undefined) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }

    const existing = await prisma.systemConfig.findUnique({ where: { key } });
    const previousValue = existing?.value ?? null;

    const record = await prisma.systemConfig.upsert({
      where: { key },
      update: { value, updatedBy: staffId },
      create: { key, value, updatedBy: staffId },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'CONFIG_CHANGED',
      entityType: 'SystemConfig',
      entityId: key,
      previousData: { key, value: previousValue },
      newData: { key, value: record.value },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('Update config error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
