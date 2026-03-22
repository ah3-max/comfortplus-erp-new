import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const STAGE_ORDER = [
  'POTENTIAL', 'CONTACTED', 'VISITED', 'NEGOTIATING',
  'TRIAL', 'CLOSED', 'STABLE_REPURCHASE', 'DORMANT', 'CHURNED', 'REJECTED',
]

// GET /api/crm/analytics
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = session.user.id
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400_000)

  // Week (Monday start)
  const wd = now.getDay()
  const mondayOff = wd === 0 ? 6 : wd - 1
  const weekStart = new Date(todayStart.getTime() - mondayOff * 86400_000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const user = await prisma.user.findUnique({
    where: { id: uid }, select: { role: true },
  })
  const isManager = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(user?.role ?? '')

  const [
    // ── 1. Funnel: customer count per devStatus ──
    funnelRaw,

    // ── 2. My activity this week / month ──
    myWeekLogs,
    myMonthLogs,
    myWeekVisits,
    myWeekSamples,
    myWeekQuotes,
    myMonthOrders,

    // ── 3. Activity breakdown by logType this week ──
    activityBreakdown,

    // ── 4. My customers by stage ──
    myCustomersByStage,

    // ── 5. Aging: customers with stage and lastContactDate ──
    agingCustomers,

    // ── 6. Team ranking (managers only) ──
    teamRanking,
  ] = await Promise.all([
    // 1. Funnel
    prisma.customer.groupBy({
      by: ['devStatus'],
      where: { isActive: true },
      _count: true,
    }),

    // 2. My metrics
    prisma.followUpLog.count({
      where: { createdById: uid, logDate: { gte: weekStart, lt: todayEnd } },
    }),
    prisma.followUpLog.count({
      where: { createdById: uid, logDate: { gte: monthStart, lt: todayEnd } },
    }),
    prisma.followUpLog.count({
      where: {
        createdById: uid,
        logDate: { gte: weekStart, lt: todayEnd },
        logType: { in: ['FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'DELIVERY', 'SPRING_PARTY', 'EXPO'] },
      },
    }),
    prisma.sampleRecord.count({
      where: { sentById: uid, sentDate: { gte: weekStart, lt: todayEnd } },
    }),
    prisma.quotation.count({
      where: { createdById: uid, createdAt: { gte: weekStart, lt: todayEnd } },
    }),
    prisma.salesOrder.count({
      where: { createdById: uid, createdAt: { gte: monthStart, lt: todayEnd } },
    }),

    // 3. Activity breakdown
    prisma.followUpLog.groupBy({
      by: ['logType'],
      where: { createdById: uid, logDate: { gte: weekStart, lt: todayEnd } },
      _count: true,
    }),

    // 4. My customers by stage
    prisma.customer.groupBy({
      by: ['devStatus'],
      where: { isActive: true, salesRepId: uid },
      _count: true,
    }),

    // 5. Aging: customers stuck in early stages
    prisma.customer.findMany({
      where: {
        isActive: true,
        devStatus: { in: ['POTENTIAL', 'CONTACTED', 'VISITED', 'NEGOTIATING', 'TRIAL'] },
      },
      select: {
        id: true, name: true, code: true, devStatus: true,
        lastContactDate: true, createdAt: true,
        salesRep: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),

    // 6. Team ranking
    isManager ? prisma.followUpLog.groupBy({
      by: ['createdById'],
      where: { logDate: { gte: weekStart, lt: todayEnd } },
      _count: true,
    }).then(async groups => {
      const userIds = groups.map(g => g.createdById)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
      const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))
      return groups
        .map(g => ({ userId: g.createdById, name: userMap[g.createdById] ?? '?', weekLogs: g._count }))
        .sort((a, b) => b.weekLogs - a.weekLogs)
    }) : Promise.resolve([]),
  ])

  // Build funnel data sorted by stage order
  const funnel = STAGE_ORDER.map(stage => {
    const item = funnelRaw.find(f => f.devStatus === stage)
    return { stage, count: item?._count ?? 0 }
  }).filter(f => f.count > 0 || STAGE_ORDER.indexOf(f.stage) < 7)

  const myFunnel = STAGE_ORDER.map(stage => {
    const item = myCustomersByStage.find(f => f.devStatus === stage)
    return { stage, count: item?._count ?? 0 }
  }).filter(f => f.count > 0 || STAGE_ORDER.indexOf(f.stage) < 7)

  // Aging analysis
  const agingByStage: Record<string, { count: number; avgDays: number; customers: typeof agingCustomers }> = {}
  for (const c of agingCustomers) {
    const stage = c.devStatus
    if (!agingByStage[stage]) agingByStage[stage] = { count: 0, avgDays: 0, customers: [] }
    agingByStage[stage].count++
    agingByStage[stage].customers.push(c)
  }
  // Calculate avg days in stage (using lastContactDate or createdAt)
  for (const [, data] of Object.entries(agingByStage)) {
    const totalDays = data.customers.reduce((sum, c) => {
      const ref = c.lastContactDate ?? c.createdAt
      return sum + Math.floor((now.getTime() - new Date(ref).getTime()) / 86400_000)
    }, 0)
    data.avgDays = data.count > 0 ? Math.round(totalDays / data.count) : 0
  }

  // Activity breakdown formatted
  const actBreakdown = activityBreakdown.map(a => ({
    logType: a.logType,
    count: a._count,
  }))

  return NextResponse.json({
    funnel,
    myFunnel,
    myMetrics: {
      weekLogs: myWeekLogs,
      monthLogs: myMonthLogs,
      weekVisits: myWeekVisits,
      weekSamples: myWeekSamples,
      weekQuotes: myWeekQuotes,
      monthOrders: myMonthOrders,
    },
    activityBreakdown: actBreakdown,
    aging: agingByStage,
    teamRanking: isManager ? teamRanking : null,
    isManager,
  })
}
