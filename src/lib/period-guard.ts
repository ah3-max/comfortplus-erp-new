/**
 * Period Guard — prevents writes to closed/locked fiscal periods.
 *
 * Usage: await assertPeriodOpen(entryDate) at the top of write API handlers.
 * Throws PeriodLockedError (handled by handleApiError → 423 Locked).
 */
import { prisma } from '@/lib/prisma'

export class PeriodLockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PeriodLockedError'
  }
}

/**
 * Assert that the fiscal period containing `entryDate` is open for writing.
 * - OPEN / CLOSING → allowed
 * - CLOSED → throw (suggest reopening)
 * - LOCKED → throw (locked, no changes)
 * - No period record → allowed (period management is optional)
 */
export async function assertPeriodOpen(entryDate: Date): Promise<void> {
  const year = entryDate.getFullYear()
  const month = entryDate.getMonth() + 1
  const periodCode = `${year}-${String(month).padStart(2, '0')}`

  const period = await prisma.fiscalPeriod.findFirst({
    where: { periodCode },
    select: { status: true, periodCode: true },
  })

  // No period record → allow (period management is opt-in)
  if (!period) return

  if (period.status === 'LOCKED') {
    throw new PeriodLockedError(`期間 ${periodCode} 已鎖定，不可異動`)
  }
  if (period.status === 'CLOSED') {
    throw new PeriodLockedError(`期間 ${periodCode} 已結帳，如需調整請先重新開啟`)
  }
  // OPEN / CLOSING → pass through
}
