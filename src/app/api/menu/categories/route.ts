import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

// GET /api/menu/categories — List all categories with items
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Get categories error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/menu/categories — Create a new category
export async function POST(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const { name, colour, sortOrder } = await req.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        colour: colour || null,
        sortOrder: sortOrder ?? 0,
      },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'CATEGORY_CREATED',
      entityType: 'Category',
      entityId: category.id,
      newData: category,
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'category', action: 'created' });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Create category error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/menu/categories — Update a category
export async function PATCH(req: NextRequest) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const { id, name, colour, sortOrder } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    const before = await prisma.category.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof name === 'string') updateData.name = name;
    if (typeof colour === 'string' || colour === null) updateData.colour = colour;
    if (typeof sortOrder === 'number') updateData.sortOrder = sortOrder;

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: id,
      previousData: { name: before.name, colour: before.colour, sortOrder: before.sortOrder },
      newData: { name: category.name, colour: category.colour, sortOrder: category.sortOrder },
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'category', action: 'updated' });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Update category error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/menu/categories — Soft delete a category  
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
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    await prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Also soft-delete all items in this category
    await prisma.menuItem.updateMany({
      where: { categoryId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'CATEGORY_DELETED',
      entityType: 'Category',
      entityId: id,
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'category', action: 'deleted' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete category error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
