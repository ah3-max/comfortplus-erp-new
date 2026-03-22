import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const isManager = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(user?.role ?? '')
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(todayStart.getTime() + 86400_000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const sevenDaysAgo  = new Date(todayStart.getTime() - 7  * 86400_000)
  const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400_000)

  // ── 1. Daily metrics ──────────────────────────────────────────────────────
  const VISIT_TYPES = ['FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'EXPO', 'SPRING_PARTY', 'DELIVERY']
  const REVISIT_TYPES = ['SECOND_VISIT', 'THIRD_VISIT', 'CALL', 'LINE', 'EMAIL', 'EXPO', 'SPRING_PARTY', 'DELIVERY']

  const [
    todayFirstVisit,
    todayRevisit,
    todaySamples,
    todayQuotes,
    todayOrders,
    todayPayments,
    todayPendingTasks,
    todayNewCustomers,
  ] = await Promise.all([
    prisma.followUpLog.count({
      where: { logDate: { gte: todayStart, lt: todayEnd }, logType: 'FIRST_VISIT' },
    }),
    prisma.followUpLog.count({
      where: { logDate: { gte: todayStart, lt: todayEnd }, logType: { in: REVISIT_TYPES as any } },
    }),
    prisma.sampleRecord.count({
      where: { sentDate: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.quotation.count({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.salesOrder.count({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.salesEvent.count({
      where: { eventDate: { gte: todayStart, lt: todayEnd }, eventType: 'PAYMENT' },
    }),
    prisma.salesTask.count({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.customer.count({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
    }),
  ])

  // ── 2. Leak alerts ────────────────────────────────────────────────────────
  const [noContactCustomers, sampleNoFeedback, quoteNotClosed, scheduleNotFilled] = await Promise.all([
    // 超過 7 天未追蹤
    prisma.customer.findMany({
      where: {
        isActive: true,
        devStatus: { in: ['POTENTIAL', 'CONTACTED', 'VISITED', 'NEGOTIATING', 'TRIAL'] },
        OR: [
          { lastContactDate: { lt: sevenDaysAgo } },
          { lastContactDate: null },
        ],
      },
      select: {
        id: true, name: true, code: true, devStatus: true, lastContactDate: true,
        salesRep: { select: { id: true, name: true } },
      },
      orderBy: { lastContactDate: 'asc' },
      take: 50,
    }),

    // 送樣未回覆（超過 7 天）
    prisma.sampleRecord.findMany({
      where: { hasFeedback: false, sentDate: { lt: sevenDaysAgo } },
      select: {
        id: true, sentDate: true, items: true,
        customer: { select: { id: true, name: true, code: true } },
        sentBy:   { select: { id: true, name: true } },
      },
      orderBy: { sentDate: 'asc' },
      take: 30,
    }),

    // 報價未成交（送出超過 14 天）
    prisma.quotation.findMany({
      where: {
        status: { in: ['DRAFT', 'SENT', 'CUSTOMER_REVIEWING'] },
        createdAt: { lt: new Date(todayStart.getTime() - 14 * 86400_000) },
      },
      select: {
        id: true, quotationNo: true, status: true, createdAt: true, totalAmount: true,
        customer:  { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 30,
    }),

    // 已安排拜訪未回填結果
    prisma.salesSchedule.findMany({
      where: { isCompleted: false, scheduleDate: { lt: todayStart } },
      select: {
        id: true, scheduleDate: true, scheduleType: true, location: true,
        customer: { select: { id: true, name: true, code: true } },
        salesRep: { select: { id: true, name: true } },
      },
      orderBy: { scheduleDate: 'asc' },
      take: 30,
    }),
  ])

  // 已成交 30 天未回購
  const closedCustomers = await prisma.customer.findMany({
    where: { isActive: true, devStatus: { in: ['CLOSED', 'STABLE_REPURCHASE'] } },
    select: {
      id: true, name: true, code: true, devStatus: true,
      salesRep: { select: { id: true, name: true } },
      salesOrders: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })
  const noRepurchase = closedCustomers
    .filter(c => {
      const last = c.salesOrders[0]
      return !last || new Date(last.createdAt) < thirtyDaysAgo
    })
    .map(c => ({
      id: c.id, name: c.name, code: c.code, devStatus: c.devStatus,
      salesRep: c.salesRep,
      lastOrderDate: c.salesOrders[0]?.createdAt ?? null,
    }))
    .slice(0, 30)

  // ── 3. Per-rep performance (this month) ───────────────────────────────────
  const salesReps = await prisma.user.findMany({
    where: { role: { in: ['SALES', 'SALES_MANAGER'] }, isActive: true },
    select: { id: true, name: true, role: true },
  })

  const repPerformance = await Promise.all(
    salesReps.map(async rep => {
      const [visits, totalLogs, samples, quotes, orders, repurchaseCustomers] = await Promise.all([
        // 本月拜訪數
        prisma.followUpLog.count({
          where: {
            createdById: rep.id,
            logDate: { gte: monthStart, lt: todayEnd },
            logType: { in: VISIT_TYPES as any },
          },
        }),
        // 本月有效追蹤數
        prisma.followUpLog.count({
          where: { createdById: rep.id, logDate: { gte: monthStart, lt: todayEnd } },
        }),
        // 本月送樣數
        prisma.sampleRecord.count({
          where: { sentById: rep.id, sentDate: { gte: monthStart, lt: todayEnd } },
        }),
        // 本月報價數
        prisma.quotation.count({
          where: { createdById: rep.id, createdAt: { gte: monthStart, lt: todayEnd } },
        }),
        // 本月成交家數（新訂單客戶數）
        prisma.salesOrder.groupBy({
          by: ['customerId'],
          where: { createdById: rep.id, createdAt: { gte: monthStart, lt: todayEnd } },
          _count: true,
        }),
        // 本月回購家數（有訂單且之前已有訂單的客戶數）
        prisma.salesOrder.groupBy({
          by: ['customerId'],
          where: {
            createdById: rep.id,
            createdAt: { gte: monthStart, lt: todayEnd },
          },
          having: { customerId: { _count: { gte: 1 } } },
          _count: true,
        }),
      ])

      // repurchase: customers with orders this month who also had a prior order
      let repurchases = 0
      if (repurchaseCustomers.length > 0) {
        const customerIds = repurchaseCustomers.map(r => r.customerId)
        const priorOrders = await prisma.salesOrder.groupBy({
          by: ['customerId'],
          where: {
            customerId: { in: customerIds },
            createdAt: { lt: monthStart },
          },
          _count: true,
        })
        repurchases = priorOrders.length
      }

      return {
        userId: rep.id,
        name: rep.name,
        role: rep.role,
        visits,
        totalLogs,
        samples,
        quotes,
        deals: orders.length,
        repurchases,
      }
    })
  )

  return NextResponse.json({
    daily: {
      todayNewCustomers,
      todayFirstVisit,
      todayRevisit,
      todaySamples,
      todayQuotes,
      todayOrders,
      todayPayments,
      todayPendingTasks,
    },
    leaks: {
      noContact:       noContactCustomers,
      sampleNoFeedback,
      quoteNotClosed,
      scheduleNotFilled,
      noRepurchase,
    },
    repPerformance,
  })
}
