'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSocketContext } from '@/providers/SocketProvider';

/**
 * Subscribe to Socket.io events and auto-refresh the page on changes.
 * Used in components that display data that can be modified from other terminals.
 */
export function useSocketRefresh(events: string[]) {
  const { socket } = useSocketContext();
  const router = useRouter();

  // Stabilise events array reference to prevent re-subscribe on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableEvents = useMemo(() => events, [events.join(',')]);

  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      router.refresh();
    };

    stableEvents.forEach(event => socket.on(event, handler));

    return () => {
      stableEvents.forEach(event => socket.off(event, handler));
    };
  }, [socket, stableEvents, router]);
}

/**
 * Subscribe to a specific Socket.io event with a custom callback.
 */
export function useSocketEvent(event: string, callback: (data: any) => void) {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;

    socket.on(event, callback);

    return () => {
      socket.off(event, callback);
    };
  }, [socket, event, callback]);
}
