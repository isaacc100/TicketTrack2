import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const staffId = req.headers.get('x-staff-id');
  const terminalId = req.headers.get('x-terminal-id');
  const token = req.cookies.get('pos-session')?.value;

  if (staffId && terminalId) {
    await logAudit({
      staffId,
      terminalId,
      action: 'LOGOUT',
      entityType: 'Staff',
      entityId: staffId,
    });
  }

  // Delete the session record from the database
  if (token) {
    try {
      await prisma.session.deleteMany({ where: { token } });
    } catch {}
  }

  const isJson = req.headers.get('accept')?.includes('application/json');
  
  if (!isJson) {
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('pos-session');
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('pos-session');
  return response;
}
