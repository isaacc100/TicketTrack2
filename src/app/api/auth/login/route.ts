import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPin, signToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const loginSchema = z.object({
  pin: z.string().min(4).max(6),
  terminalId: z.string().default('terminal-1'),
});

// In-memory terminal rate limiter
const terminalAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_TERMINAL_ATTEMPTS = parseInt(process.env.PIN_MAX_ATTEMPTS || '5', 10);
const LOCKOUT_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '5', 10) * 60 * 1000;

function checkTerminalRateLimit(terminalId: string): { allowed: boolean; retryAfter?: number } {
  const entry = terminalAttempts.get(terminalId);
  if (!entry) return { allowed: true };

  if (entry.lockedUntil > Date.now()) {
    return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - Date.now()) / 1000) };
  }

  // Lock has expired, reset
  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    terminalAttempts.delete(terminalId);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordTerminalFailure(terminalId: string) {
  const entry = terminalAttempts.get(terminalId) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_TERMINAL_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  terminalAttempts.set(terminalId, entry);
}

function resetTerminalAttempts(terminalId: string) {
  terminalAttempts.delete(terminalId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { pin, terminalId } = result.data;

    // Check terminal-level rate limit first
    const rateLimit = checkTerminalRateLimit(terminalId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Terminal locked due to too many failed attempts. Try again in ${rateLimit.retryAfter}s.` },
        { status: 429 }
      );
    }

    // Only fetch active, non-locked staff
    const allActiveStaff = await prisma.staff.findMany({
      where: {
        isActive: true,
        rank: { gt: 0 }, // Rank 0 = deactivated
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lt: new Date() } },
        ]
      },
    });

    let matchedStaff = null;
    for (const staff of allActiveStaff) {
      if (await verifyPin(pin, staff.pin)) {
        matchedStaff = staff;
        break;
      }
    }

    if (!matchedStaff) {
      // Record terminal failure
      recordTerminalFailure(terminalId);

      // Also check if the PIN matched a locked staff member for a better error message
      const lockedStaff = await prisma.staff.findMany({
        where: { isActive: true, lockedUntil: { gte: new Date() } },
      });
      for (const staff of lockedStaff) {
        if (await verifyPin(pin, staff.pin)) {
          await logAudit({
            staffId: staff.id,
            terminalId,
            action: 'LOGIN_FAILED',
            entityType: 'Staff',
            entityId: staff.id,
            metadata: { reason: 'account_locked' },
          });
          return NextResponse.json({ error: 'Account temporarily locked. Contact a manager.' }, { status: 403 });
        }
      }

      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    // Successful match — reset counters
    resetTerminalAttempts(terminalId);
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

    const response = NextResponse.json({
      success: true,
      staff: { id: matchedStaff.id, name: matchedStaff.name, rank: matchedStaff.rank }
    });
    
    response.cookies.set('pos-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
