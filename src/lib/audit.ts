import { prisma } from './prisma';

interface AuditLogPayload {
  staffId: string;
  terminalId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousData?: any;
  newData?: any;
  metadata?: any;
  orderId?: string;
}

export async function logAudit(payload: AuditLogPayload) {
  try {
    await prisma.auditLog.create({
      data: {
        staffId: payload.staffId,
        terminalId: payload.terminalId,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        previousData: payload.previousData ? JSON.stringify(payload.previousData) : undefined,
        newData: payload.newData ? JSON.stringify(payload.newData) : undefined,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
        orderId: payload.orderId,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log', error);
  }
}

export function diffSnapshots(before: any, after: any) {
  // A simplified diff just for audit purposes
  const changesBefore: any = {};
  const changesAfter: any = {};
  
  if (!before && after) return { before: null, after };
  if (before && !after) return { before, after: null };
  if (!before && !after) return { before: null, after: null };

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  keys.forEach((key) => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changesBefore[key] = before[key];
      changesAfter[key] = after[key];
    }
  });

  return { before: changesBefore, after: changesAfter };
}
