import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit, diffSnapshots } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

// GET /api/menu/items/[itemId] — Get a single menu item
export async function GET(
  _req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const item = await prisma.menuItem.findFirst({
      where: { id: params.itemId, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
    });

    if (!item) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Get menu item error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/menu/items/[itemId] — Update a menu item
export async function PUT(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const before = await prisma.menuItem.findFirst({
      where: { id: params.itemId, deletedAt: null },
    });
    if (!before) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      price,
      description,
      colour,
      sortOrder,
      modifierGroups,
      kdsStation,
      isAvailable,
      categoryId,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof name === 'string') updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (typeof description === 'string' || description === null) updateData.description = description;
    if (typeof colour === 'string' || colour === null) updateData.colour = colour;
    if (typeof sortOrder === 'number') updateData.sortOrder = sortOrder;
    if (modifierGroups !== undefined) updateData.modifierGroups = modifierGroups;
    if (typeof kdsStation === 'string' || kdsStation === null) updateData.kdsStation = kdsStation;
    if (typeof isAvailable === 'boolean') updateData.isAvailable = isAvailable;
    if (typeof categoryId === 'string') updateData.categoryId = categoryId;

    const item = await prisma.menuItem.update({
      where: { id: params.itemId },
      data: updateData,
    });

    const diff = diffSnapshots(before, item);

    await logAudit({
      staffId,
      terminalId,
      action: 'MENU_ITEM_UPDATED',
      entityType: 'MenuItem',
      entityId: params.itemId,
      previousData: diff.before,
      newData: diff.after,
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'item', action: 'updated', id: params.itemId });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Update menu item error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/menu/items/[itemId] — Soft-delete a menu item
export async function DELETE(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const item = await prisma.menuItem.findFirst({
      where: { id: params.itemId, deletedAt: null },
    });
    if (!item) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    await prisma.menuItem.update({
      where: { id: params.itemId },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'MENU_ITEM_DELETED',
      entityType: 'MenuItem',
      entityId: params.itemId,
      previousData: { name: item.name, categoryId: item.categoryId },
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'item', action: 'deleted', id: params.itemId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete menu item error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
