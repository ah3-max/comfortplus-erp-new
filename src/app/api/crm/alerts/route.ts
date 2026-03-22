import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/crm/alerts
// Returns all smart alert categories for the CRM hub dashboard
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400_000)
  const sevenDaysAgo  = new Date(today.getTime() - 7  * 86400_000)
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400_000)
  const threeDaysAgo  = new Date(today.getTime() - 3  * 86400_000)

  // Run all queries in parallel
  const [
    uncontacted,
    todayFollowups,
    overdueFollowups,
    samplesPending,
    quotesStale,
    repurchaseWarning,
    todaySchedules,
  ] = await Promise.all([

    // 1. 未追蹤客戶：超過 7 天沒聯繫，仍在追蹤中
    prisma.customer.findMany({
      where: {
        isActive: true,
        isFollowUp: true,
        OR: [
          { lastContactDate: null },
          { lastContactDate: { lt: sevenDaysAgo } },
        ],
        devStatus: { notIn: ['REJECTED', 'CHURNED', 'DORMANT'] },
      },
      select: {
        id: true, name: true, code: true, phone: true, devStatus: true,
        lastContactDate: true, nextFollowUpDate: true,
        salesRep: { select: { id: true, name: true } },
      },
      orderBy: { lastContactDate: 'asc' },
      take: 30,
    }),

    // 2. 今日待追蹤：nextFollowUpDate = 今天
    prisma.customer.findMany({
      where: {
        isActive: true,
        isFollowUp: true,
        nextFollowUpDate: { gte: today, lt: tomorrow },
      },
      select: {
        id: true, name: true, code: true, phone: true, devStatus: true,
        lastContactDate: true, nextFollowUpDate: true,
        salesRep: { select: { id: true, name: true } },
      },
      orderBy: { nextFollowUpDate: 'asc' },
    }),

    // 3. 逾期待追蹤：nextFollowUpDate < 今天，尚未聯繫
    prisma.customer.findMany({
      where: {
        isActive: true,
        isFollowUp: true,
        nextFollowUpDate: { lt: today },
      },
      select: {
        id: true, name: true, code: true, phone: true, devStatus: true,
        lastContactDate: true, nextFollowUpDate: true,
        salesRep: { select: { id: true, name: true } },
      },
      orderBy: { nextFollowUpDate: 'asc' },
      take: 30,
    }),

    // 4. 樣品追蹤清單：送樣超過 3 天無回饋
    prisma.sampleRecord.findMany({
      where: {
        hasFeedback: false,
        sentDate: { lt: threeDaysAgo },
      },
      select: {
        id: true, sentDate: true, items: true, quantity: true, purpose: true,
        customer: { select: { id: true, name: true, code: true } },
        sentBy:   { select: { id: true, name: true } },
      },
      orderBy: { sentDate: 'asc' },
      take: 30,
    }),

    // 5. 報價追蹤清單：SENT 狀態超過 7 天沒更新
    prisma.quotation.findMany({
      where: {
        status: 'SENT',
        updatedAt: { lt: sevenDaysAgo },
      },
      select: {
        id: true, quotationNo: true, totalAmount: true, updatedAt: true, validUntil: true,
        customer:  { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 30,
    }),

    // 6. 回購預警：有完成訂單，但 30 天沒下單
    prisma.customer.findMany({
      where: {
        isActive: true,
        devStatus: { in: ['CLOSED', 'STABLE_REPURCHASE'] },
        salesOrders: {
          some: { status: 'COMPLETED' },
        },
      },
      select: {
        id: true, name: true, code: true, phone: true, devStatus: true,
        lastContactDate: true, nextFollowUpDate: true,
        salesRep: { select: { id: true, name: true } },
      },
      take: 50,
    }).then(async customers => {
      // For each customer, find their latest completed order
      const results = await Promise.all(customers.map(async c => {
        const lastOrder = await prisma.salesOrder.findFirst({
          where: {
            customerId: c.id,
            status: { in: ['COMPLETED', 'SIGNED'] },
          },
          orderBy: { orderDate: 'desc' },
          select: { id: true, orderDate: true, totalAmount: true },
        })
        return { ...c, salesOrders: lastOrder ? [lastOrder] : [] }
      }))
      return results.filter(c => {
        const lastOrder = c.salesOrders[0]
        return lastOrder && new Date(lastOrder.orderDate) < thirtyDaysAgo
      })
    }),

    // 7. 今日行程
    prisma.salesSchedule.findMany({
      where: {
        isCompleted: false,
        scheduleDate: { gte: today, lt: tomorrow },
      },
      select: {
        id: true, scheduleType: true, scheduleDate: true, startTime: true,
        location: true, preReminder: true,
        customer: { select: { id: true, name: true } },
        salesRep: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    }),
  ])

  return NextResponse.json({
    uncontacted,
    todayFollowups,
    overdueFollowups,
    samplesPending,
    quotesStale,
    repurchaseWarning,
    todaySchedules,
    generatedAt: now.toISOString(),
  })
}
