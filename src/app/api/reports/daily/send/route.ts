import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dateStr = new Date().toISOString().slice(0, 10)
  const localStart = new Date(dateStr + 'T00:00:00+08:00')
  const localEnd   = new Date(dateStr + 'T23:59:59+08:00')

  const [followUpLogs, newCustomers, quotations, salesOrders, completedTasks] = await Promise.all([
    prisma.followUpLog.count({ where: { logDate: { gte: localStart, lte: localEnd } } }),
    prisma.customer.count({ where: { createdAt: { gte: localStart, lte: localEnd } } }),
    prisma.quotation.count({ where: { createdAt: { gte: localStart, lte: localEnd } } }),
    prisma.salesOrder.count({ where: { createdAt: { gte: localStart, lte: localEnd } } }),
    prisma.salesTask.count({ where: { completedAt: { gte: localStart, lte: localEnd }, status: 'DONE' } }),
  ])

  const orderAmount = await prisma.salesOrder.aggregate({
    where: { createdAt: { gte: localStart, lte: localEnd } },
    _sum: { totalAmount: true },
  })

  const amountFormatted = orderAmount._sum.totalAmount
    ? new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        maximumFractionDigits: 0,
      }).format(Number(orderAmount._sum.totalAmount))
    : '$0'

  const summaryText = [
    `${dateStr} 業務日報`,
    `互動記錄 ${followUpLogs} 筆`,
    `新增客戶 ${newCustomers} 個`,
    `報價單 ${quotations} 張`,
    `訂單 ${salesOrders} 筆 (${amountFormatted})`,
    `完成任務 ${completedTasks} 項`,
  ].join('　|　')

  // Push notification to GM and SALES_MANAGER
  const managers = await prisma.user.findMany({
    where: { role: { in: ['GM', 'SALES_MANAGER', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  })

  const notifId = `daily-report-${dateStr}`
  await Promise.all(
    managers.map(m =>
      prisma.notification.upsert({
        where:  { id: `${notifId}-${m.id}` },
        update: { title: summaryText, isRead: false, readAt: null },
        create: {
          id:       `${notifId}-${m.id}`,
          userId:   m.id,
          title:    `${dateStr} 業務日報已出爐`,
          message:  summaryText,
          category: 'DAILY_REPORT',
          priority: 'NORMAL',
          linkUrl:  '/daily-report',
          isRead:   false,
        },
      })
    )
  )

  return NextResponse.json({
    ok: true,
    date: dateStr,
    notifiedCount: managers.length,
    summary: summaryText,
  })
}
