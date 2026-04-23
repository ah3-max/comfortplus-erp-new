import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/sales-daily-report/today
 * Returns today's draft (auto-populated from DB) or existing report
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Check if report already exists
  const existing = await prisma.salesDailyReport.findFirst({
    where: { salesRepId: userId, reportDate: today },
  })
  if (existing) return NextResponse.json(existing)

  // Auto-populate stats from today's activity.
  // We aggregate both legacy tables (VisitRecord/CallRecord) and the unified
  // FollowUpLog, because Excel imports land in FollowUpLog. Dedup is best-effort —
  // power users shouldn't double-book the same contact in both tables.
  const [visits, calls, orders, quotes, followUpLogs] = await Promise.all([
    prisma.visitRecord.count({ where: { visitedById: userId, visitDate: { gte: today, lt: tomorrow } } }),
    prisma.callRecord.count({ where: { calledById: userId, callDate: { gte: today, lt: tomorrow } } }),
    prisma.salesOrder.findMany({
      where: { createdById: userId, createdAt: { gte: today, lt: tomorrow } },
      select: { id: true, totalAmount: true },
    }),
    prisma.quotation.count({ where: { createdById: userId, createdAt: { gte: today, lt: tomorrow } } }),
    prisma.followUpLog.groupBy({
      where: { createdById: userId, logDate: { gte: today, lt: tomorrow } },
      by: ['logType'],
      _count: { _all: true },
    }),
  ])

  // Bucket FollowUpLog by logType → visits or calls
  const VISIT_TYPES = new Set(['FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'DELIVERY', 'SPRING_PARTY', 'EXPO'])
  const CALL_TYPES = new Set(['CALL', 'LINE', 'EMAIL', 'MEETING'])
  let visitExtras = 0
  let callExtras = 0
  for (const g of followUpLogs) {
    if (VISIT_TYPES.has(g.logType)) visitExtras += g._count._all
    else if (CALL_TYPES.has(g.logType)) callExtras += g._count._all
  }

  const orderAmount = orders.reduce((s, o) => s + Number(o.totalAmount), 0)

  return NextResponse.json({
    id: null,
    reportDate: today,
    salesRepId: userId,
    visitCount: visits + visitExtras,
    callCount: calls + callExtras,
    orderCount: orders.length,
    orderAmount,
    newCustomerCount: 0,
    quoteCount: quotes,
    highlights: '',
    obstacles: '',
    tomorrowPlan: '',
    needsHelp: '',
    status: 'DRAFT',
    submittedAt: null,
  })
}
