import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const staffId = req.headers.get('x-staff-id');
  const terminalId = req.headers.get('x-terminal-id');

  if (staffId && terminalId) {
    await logAudit({
      staffId,
      terminalId,
      action: 'LOGOUT',
      entityType: 'Staff',
      entityId: staffId,
    });
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
