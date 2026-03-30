import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

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

const MAX_RETRIES = 1
const RETRY_DELAY_MS = 500

export async function logAudit(params: AuditParams) {
  const auditData = {
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
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.auditLog.create({ data: auditData })
      return // success
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
        continue
      }
      // Final failure — log structured error with full context
      logger.error('audit', `Audit log FAILED after ${MAX_RETRIES + 1} attempts`, e, {
        module: params.module,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
      })
      // Don't throw — audit failure should not break business logic,
      // but the structured log ensures it's captured by log aggregators.
    }
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
