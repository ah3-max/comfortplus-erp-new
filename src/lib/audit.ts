import { prisma } from '@/lib/prisma'

interface AuditParams {
  userId: string
  userName: string
  userRole: string
  module: string
  action: string
  entityType: string
  entityId: string
  entityLabel?: string
  changes?: Record<string, { before: any; after: any }> | null
  reason?: string
  ipAddress?: string
  userAgent?: string
}

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        module: params.module,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel,
        changes: params.changes ? JSON.parse(JSON.stringify(params.changes)) : undefined,
        reason: params.reason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
    // Don't throw - audit failure shouldn't break business logic
  }
}

/**
 * Compare two objects and return changed fields.
 * Only tracks specified sensitive fields.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  sensitiveFields: (keyof T)[],
): Record<string, { before: unknown; after: unknown }> | null {
  const changes: Record<string, { before: unknown; after: unknown }> = {}
  for (const field of sensitiveFields) {
    const oldVal = before[field]
    const newVal = after[field]
    if (newVal !== undefined && String(oldVal) !== String(newVal)) {
      changes[String(field)] = { before: oldVal, after: newVal }
    }
  }
  return Object.keys(changes).length > 0 ? changes : null
}
