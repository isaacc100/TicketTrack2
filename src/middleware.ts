import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout', '/api/health'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets, Next.js internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    publicPaths.includes(pathname)
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = req.cookies.get('pos-session')?.value;

  if (!sessionToken) {
    // Redirect to login if unauthenticated
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyToken(sessionToken);

  if (!payload) {
    // Token is invalid/expired
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url));
      
    response.cookies.delete('pos-session');
    return response;
  }

  // Token is valid, inject headers for downstream API routes
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-staff-id', payload.staffId);
  requestHeaders.set('x-staff-rank', payload.rank.toString());
  requestHeaders.set('x-terminal-id', payload.terminalId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
