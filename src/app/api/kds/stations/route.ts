import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { getIO } from '@/lib/socket-server';

// GET /api/kds/stations — List all KDS stations
export async function GET() {
  try {
    const stations = await prisma.kdsStation.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ stations });
  } catch (error) {
    console.error('Get KDS stations error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/kds/stations — Create a KDS station
export async function POST(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_SETTINGS);
    if (denied) return denied;

    const { name, colour, sortOrder } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Station name is required' }, { status: 400 });
    }

    const station = await prisma.kdsStation.create({
      data: { name, colour: colour || null, sortOrder: sortOrder ?? 0 },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'KDS_STATION_CREATED',
      entityType: 'KdsStation',
      entityId: station.id,
      newData: station,
    });

    return NextResponse.json({ success: true, station });
  } catch (error) {
    console.error('Create KDS station error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/kds/stations — Update a KDS station
export async function PATCH(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_SETTINGS);
    if (denied) return denied;

    const { id, name, colour, sortOrder, isActive } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Station ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof name === 'string') updateData.name = name;
    if (typeof colour === 'string' || colour === null) updateData.colour = colour;
    if (typeof sortOrder === 'number') updateData.sortOrder = sortOrder;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const station = await prisma.kdsStation.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'KDS_STATION_UPDATED',
      entityType: 'KdsStation',
      entityId: id,
      newData: station,
    });

    return NextResponse.json({ success: true, station });
  } catch (error) {
    console.error('Update KDS station error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
