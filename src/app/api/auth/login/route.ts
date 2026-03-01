import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPin, signToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import * as z from 'zod';

const loginSchema = z.object({
  pin: z.string().min(4).max(6),
  terminalId: z.string().default('terminal-1'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { pin, terminalId } = result.data;

    const allActiveStaff = await prisma.staff.findMany({
      where: { isActive: true },
    });

    let matchedStaff = null;
    for (const staff of allActiveStaff) {
      if (await verifyPin(pin, staff.pin)) {
        matchedStaff = staff;
        break;
      }
    }

    if (!matchedStaff) {
      // Find staff with matching pin? We can't since it's a hash. We can't really increment failedAttempts for a specific user unless we prompt for a user ID before PIN. 
      // But POS PINs are typically entered without username.
      // So we can only rely on rate-limiting the terminal if the PIN is wrong.
      // Let's log an unknown login attempt.
      
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    // Check lockout
    if (matchedStaff.lockedUntil && new Date() < matchedStaff.lockedUntil) {
      await logAudit({
        staffId: matchedStaff.id,
        terminalId,
        action: 'LOGIN_FAILED',
        entityType: 'Staff',
        entityId: matchedStaff.id,
        metadata: { reason: 'locked' }
      });
      return NextResponse.json({ error: 'Account temporarily locked. Please try again later.' }, { status: 403 });
    }

    // Process successful login
    await prisma.staff.update({
      where: { id: matchedStaff.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    const token = await signToken(
      {
        staffId: matchedStaff.id,
        rank: matchedStaff.rank,
        permissions: matchedStaff.permissions,
        terminalId,
      },
      matchedStaff.id
    );

    // Create a new session in DB
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    
    await prisma.session.create({
      data: {
        staffId: matchedStaff.id,
        terminalId,
        token,
        expiresAt,
      }
    });

    await logAudit({
      staffId: matchedStaff.id,
      terminalId,
      action: 'LOGIN',
      entityType: 'Staff',
      entityId: matchedStaff.id,
    });

    const response = NextResponse.json({ success: true });
    
    response.cookies.set('pos-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60, // 30 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
