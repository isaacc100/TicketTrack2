'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  staffId: string | null;
  rank: number;
  permissions: { granted?: string[]; revoked?: string[] } | null;
  terminalId: string;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  staffId: null,
  rank: 0,
  permissions: null,
  terminalId: 'terminal-1',
  isAuthenticated: false,
  logout: async () => {},
});

export function useAuthContext() {
  return useContext(AuthContext);
}

function decodeJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<Omit<AuthContextType, 'logout'>>({
    staffId: null,
    rank: 0,
    permissions: null,
    terminalId: 'terminal-1',
    isAuthenticated: false,
  });
  const router = useRouter();

  useEffect(() => {
    // Read the JWT from cookie (client-side decode only — verification is server-side)
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [key, ...val] = c.trim().split('=');
      acc[key] = val.join('=');
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['pos-session'];
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload) {
        setAuth({
          staffId: payload.staffId,
          rank: payload.rank,
          permissions: payload.permissions,
          terminalId: payload.terminalId,
          isAuthenticated: true,
        });
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      });
    } catch {}
    setAuth({ staffId: null, rank: 0, permissions: null, terminalId: 'terminal-1', isAuthenticated: false });
    router.push('/login');
  }, [router]);

  // Inactivity auto-lock timer
  useEffect(() => {
    if (!auth.isAuthenticated) return;

    const timeoutMinutes = parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES || '5', 10);
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Auto-lock: redirect to login
        logout();
      }, timeoutMinutes * 60 * 1000);
    };

    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [auth.isAuthenticated, logout]);

  return (
    <AuthContext.Provider value={{ ...auth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
