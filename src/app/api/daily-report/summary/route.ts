import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/daily-report/summary
// Returns today's activity, pending tasks, weekly/monthly stats for the logged-in user
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = session.user.id
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(todayStart.getTime() + 86400_000)

  // Week start (Monday)
  const weekDay = now.getDay()
  const mondayOffset = weekDay === 0 ? 6 : weekDay - 1
  const weekStart = new Date(todayStart.getTime() - mondayOffset * 86400_000)

  // Month start
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    todayLogs,
    todaySchedules,
    todayEvents,
    pendingTasks,
    overdueTasks,
    weekLogCount,
    monthLogCount,
    weekCustomerCount,
  ] = await Promise.all([
    // 今日聯繫紀錄
    prisma.followUpLog.findMany({
      where: {
        createdById: uid,
        logDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        customer: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // 今日行程
    prisma.salesSchedule.findMany({
      where: {
        salesRepId: uid,
        scheduleDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        customer: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startTime: 'asc' },
    }),

    // 今日事件
    prisma.salesEvent.findMany({
      where: {
        createdById: uid,
        eventDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        customer: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // 今日待辦任務
    prisma.salesTask.findMany({
      where: {
        assignedToId: uid,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
      orderBy: { priority: 'desc' },
    }),

    // 逾期任務
    prisma.salesTask.findMany({
      where: {
        assignedToId: uid,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: todayStart },
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),

    // 本週聯繫次數
    prisma.followUpLog.count({
      where: { createdById: uid, logDate: { gte: weekStart, lt: todayEnd } },
    }),

    // 本月聯繫次數
    prisma.followUpLog.count({
      where: { createdById: uid, logDate: { gte: monthStart, lt: todayEnd } },
    }),

    // 本週接觸客戶數（distinct）
    prisma.followUpLog.groupBy({
      by: ['customerId'],
      where: { createdById: uid, logDate: { gte: weekStart, lt: todayEnd } },
    }).then(r => r.length),
  ])

  // KPI progress
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const kpiTarget = await prisma.salesTarget.findUnique({
    where: { userId_targetMonth: { userId: uid, targetMonth: monthStart } },
  })

  let kpi = null
  if (kpiTarget) {
    const revAgg = await prisma.salesOrder.aggregate({
      where: { createdById: uid, createdAt: { gte: monthStart, lte: monthEnd }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    })
    const actual = Number(revAgg._sum.totalAmount ?? 0)
    const target = Number(kpiTarget.revenueTarget)
    kpi = {
      revenueTarget: target,
      revenueActual: actual,
      achieveRate: target > 0 ? Math.round((actual / target) * 1000) / 10 : 0,
      remaining: Math.max(0, target - actual),
      orderTarget: kpiTarget.orderTarget,
      visitTarget: kpiTarget.visitTarget,
    }
  }

  return NextResponse.json({
    todayLogs,
    todaySchedules,
    todayEvents,
    pendingTasks,
    overdueTasks,
    stats: {
      todayLogs:    todayLogs.length,
      weekLogs:     weekLogCount,
      monthLogs:    monthLogCount,
      weekCustomers: weekCustomerCount,
    },
    kpi,
  })
}
