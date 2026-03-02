import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit, diffSnapshots } from '@/lib/audit';
import { getAuthFromRequest, requirePermission } from '@/lib/api-guard';
import { Permission } from '@/lib/permissions';
import { getIO } from '@/lib/socket-server';

// GET /api/menu/categories/[categoryId] — Get a single category with its items
export async function GET(
  _req: NextRequest,
  { params }: { params: { categoryId: string } }
) {
  try {
    const category = await prisma.category.findFirst({
      where: { id: params.categoryId, deletedAt: null },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Get category error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/menu/categories/[categoryId] — Update a category
export async function PUT(
  req: NextRequest,
  { params }: { params: { categoryId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const before = await prisma.category.findFirst({
      where: { id: params.categoryId, deletedAt: null },
    });
    if (!before) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, sortOrder, colour } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof name === 'string') updateData.name = name;
    if (typeof sortOrder === 'number') updateData.sortOrder = sortOrder;
    if (typeof colour === 'string' || colour === null) updateData.colour = colour;

    const category = await prisma.category.update({
      where: { id: params.categoryId },
      data: updateData,
    });

    const diff = diffSnapshots(
      { name: before.name, sortOrder: before.sortOrder, colour: before.colour },
      { name: category.name, sortOrder: category.sortOrder, colour: category.colour }
    );

    await logAudit({
      staffId,
      terminalId,
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: params.categoryId,
      previousData: diff.before,
      newData: diff.after,
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'category', action: 'updated', id: params.categoryId });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Update category error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/menu/categories/[categoryId] — Soft-delete category and all its items
export async function DELETE(
  req: NextRequest,
  { params }: { params: { categoryId: string } }
) {
  try {
    const { staffId, terminalId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await requirePermission(req, Permission.EDIT_MENU);
    if (denied) return denied;

    const category = await prisma.category.findFirst({
      where: { id: params.categoryId, deletedAt: null },
    });
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const now = new Date();

    await prisma.category.update({
      where: { id: params.categoryId },
      data: { deletedAt: now },
    });

    await prisma.menuItem.updateMany({
      where: { categoryId: params.categoryId, deletedAt: null },
      data: { deletedAt: now },
    });

    await logAudit({
      staffId,
      terminalId,
      action: 'CATEGORY_DELETED',
      entityType: 'Category',
      entityId: params.categoryId,
      previousData: { name: category.name },
    });

    const io = getIO();
    if (io) io.emit('menu:updated', { type: 'category', action: 'deleted', id: params.categoryId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete category error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
