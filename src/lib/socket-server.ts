import { Server as SocketServer } from 'socket.io';

// Socket.io event constants
export const EVENTS = {
  TABLE_STATUS_CHANGED: 'table:statusChanged',
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  TAB_OPENED: 'tab:opened',
  TAB_CLOSED: 'tab:closed',
  MENU_UPDATED: 'menu:updated',
  CONFIG_UPDATED: 'config:updated',
  // KDS events
  KDS_NEW_ORDER: 'kds:newOrder',
  KDS_ITEM_STARTED: 'kds:itemStarted',
  KDS_ITEM_BUMPED: 'kds:itemBumped',
  KDS_ORDER_COMPLETE: 'kds:orderComplete',
  KDS_ORDER_RECALLED: 'kds:orderRecalled',
  // Pickup events
  PICKUP_READY: 'pickup:ready',
  PICKUP_SERVED: 'pickup:served',
} as const;

/**
 * Get the global Socket.io server instance.
 * Returns null if not available (e.g., during static generation).
 */
export function getIO(): SocketServer | null {
  return (global as any).io || null;
}

/**
 * Emit a typed event to all connected clients.
 */
export function emitEvent(event: string, data: any) {
  const io = getIO();
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Emit an event to a specific room.
 */
export function emitToRoom(room: string, event: string, data: any) {
  const io = getIO();
  if (io) {
    io.to(room).emit(event, data);
  }
}
