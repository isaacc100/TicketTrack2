import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/api-guard';

// GET /api/tabs/[tabId] — Get tab details with orders and payments
export async function GET(
  req: NextRequest,
  { params }: { params: { tabId: string } }
) {
  try {
    const tab = await prisma.tab.findUnique({
      where: { id: params.tabId },
      include: {
        table: true,
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tab) {
      return NextResponse.json({ error: 'Tab not found' }, { status: 404 });
    }

    return NextResponse.json({ tab });
  } catch (error) {
    console.error('Get tab error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/tabs/[tabId] — Update tab (name, allergens)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { tabId: string } }
) {
  try {
    const { staffId } = getAuthFromRequest(req);
    if (!staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, allergens } = await req.json();
    const updateData: any = {};
    if (typeof name === 'string') updateData.name = name;
    if (Array.isArray(allergens)) updateData.allergens = allergens;

    const tab = await prisma.tab.update({
      where: { id: params.tabId },
      data: updateData,
    });

    return NextResponse.json({ success: true, tab });
  } catch (error) {
    console.error('Update tab error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
