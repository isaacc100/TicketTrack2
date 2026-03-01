import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

// GET /api/menu/items — List items, optionally filtered by category
export async function GET(req: NextRequest) {
  try {
    const categoryId = req.nextUrl.searchParams.get('categoryId');

    const where: any = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;

    const items = await prisma.menuItem.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Get items error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/menu/items — Create a menu item
export async function POST(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const { categoryId, name, price, description, colour, sortOrder, modifierGroups, isAvailable } = await req.json();

    if (!categoryId || !name || price === undefined) {
      return NextResponse.json({ error: 'categoryId, name, and price are required' }, { status: 400 });
    }

    const item = await prisma.menuItem.create({
      data: {
        categoryId,
        name,
        price,
        description: description || null,
        colour: colour || null,
        sortOrder: sortOrder ?? 0,
        modifierGroups: modifierGroups || null,
        isAvailable: isAvailable ?? true,
      },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'ITEM_CREATED',
      entityType: 'MenuItem',
      entityId: item.id,
      newData: item,
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'item', action: 'created' });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Create item error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/menu/items — Update a menu item
export async function PATCH(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const { id, categoryId, name, price, description, colour, sortOrder, modifierGroups, isAvailable } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    const before = await prisma.menuItem.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof categoryId === 'string') updateData.categoryId = categoryId;
    if (typeof name === 'string') updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (typeof description === 'string' || description === null) updateData.description = description;
    if (typeof colour === 'string' || colour === null) updateData.colour = colour;
    if (typeof sortOrder === 'number') updateData.sortOrder = sortOrder;
    if (modifierGroups !== undefined) updateData.modifierGroups = modifierGroups;
    if (typeof isAvailable === 'boolean') updateData.isAvailable = isAvailable;

    const item = await prisma.menuItem.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'ITEM_UPDATED',
      entityType: 'MenuItem',
      entityId: id,
      previousData: { name: before.name, price: before.price, isAvailable: before.isAvailable },
      newData: { name: item.name, price: item.price, isAvailable: item.isAvailable },
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'item', action: 'updated' });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Update item error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/menu/items — Soft delete a menu item
export async function DELETE(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    await prisma.menuItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'ITEM_DELETED',
      entityType: 'MenuItem',
      entityId: id,
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'item', action: 'deleted' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete item error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
