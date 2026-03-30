import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { updateCustomerHealthScore } from '@/lib/health-score'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/customers/health-score-recalc
 * Recalculate health scores for all active customers.
 * Requires SUPER_ADMIN / GM / SALES_MANAGER, or CRON_SECRET bearer token.
 */
export async function POST(req: NextRequest) {
  // Support cron secret for scheduled calls
  const cronSecret = process.env.CRON_SECRET
  const auth_header = req.headers.get('authorization') ?? ''
  const isCron = cronSecret && cronSecret.length >= 32 && auth_header === `Bearer ${cronSecret}`

  if (!isCron) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true },
    })

    let updated = 0
    let failed = 0
    let timedOut = false

    // Process in batches of 20; stop after 50s to avoid Next.js 60s timeout
    const BATCH = 20
    const deadline = Date.now() + 50_000
    for (let i = 0; i < customers.length; i += BATCH) {
      if (Date.now() >= deadline) { timedOut = true; break }
      const batch = customers.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        batch.map(c => updateCustomerHealthScore(c.id))
      )
      for (const r of results) {
        if (r.status === 'fulfilled') updated++
        else failed++
      }
    }

    return NextResponse.json({ updated, failed, total: customers.length, timedOut })
  } catch (e) {
    return handleApiError(e, 'customers.healthScore.recalc')
  }
}
