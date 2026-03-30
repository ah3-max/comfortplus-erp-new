import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/sales-targets?month=2026-03&userId=xxx
 * Returns sales targets with actual performance filled in
 */
export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const monthStr = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  const userId = searchParams.get('userId')
  const teamView = searchParams.get('team') === 'true'

  // Determine target month range
  const [year, month] = monthStr.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)

  // Get users to query
  let userIds: string[] = []
  if (userId) {
    userIds = [userId]
  } else if (teamView) {
    const salesUsers = await prisma.user.findMany({
      where: { role: { in: ['SALES', 'SALES_MANAGER'] }, isActive: true },
      select: { id: true },
    })
    userIds = salesUsers.map(u => u.id)
  } else {
    userIds = [session.user.id]
  }

  // Get targets
  const targets = await prisma.salesTarget.findMany({
    where: {
      userId: { in: userIds },
      targetMonth: startOfMonth,
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  })

  // Calculate actuals for each user
  const results = await Promise.all(
    userIds.map(async (uid) => {
      const target = targets.find(t => t.userId === uid)
      const user = target?.user ?? await prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, name: true, role: true },
      })

      const [revenueAgg, orderCount, visitCount, newCustCount, callCount, quoteCount, convertedQuotes] = await Promise.all([
        prisma.salesOrder.aggregate({
          where: { createdById: uid, createdAt: { gte: startOfMonth, lte: endOfMonth }, status: { not: 'CANCELLED' } },
          _sum: { totalAmount: true },
        }),
        prisma.salesOrder.count({
          where: { createdById: uid, createdAt: { gte: startOfMonth, lte: endOfMonth }, status: { not: 'CANCELLED' } },
        }),
        prisma.visitRecord.count({
          where: { visitedById: uid, visitDate: { gte: startOfMonth, lte: endOfMonth } },
        }),
        prisma.customer.count({
          where: { salesRepId: uid, createdAt: { gte: startOfMonth, lte: endOfMonth } },
        }),
        // 電訪數
        prisma.callRecord.count({
          where: { calledById: uid, callDate: { gte: startOfMonth, lte: endOfMonth } },
        }),
        // 報價數
        prisma.quotation.count({
          where: { createdById: uid, createdAt: { gte: startOfMonth, lte: endOfMonth } },
        }),
        // 成交報價數
        prisma.quotation.count({
          where: { createdById: uid, createdAt: { gte: startOfMonth, lte: endOfMonth }, status: 'CONVERTED' },
        }),
      ])

      const revenueActual = Number(revenueAgg._sum.totalAmount ?? 0)
      const revenueTarget = Number(target?.revenueTarget ?? 0)
      const achieveRate = revenueTarget > 0 ? Math.round((revenueActual / revenueTarget) * 1000) / 10 : 0
      const conversionRate = quoteCount > 0 ? Math.round((convertedQuotes / quoteCount) * 100) : 0

      return {
        userId: uid,
        user,
        month: monthStr,
        targets: {
          revenue: revenueTarget,
          orders: target?.orderTarget ?? 0,
          visits: target?.visitTarget ?? 0,
          newCustomers: target?.newCustTarget ?? 0,
        },
        actuals: {
          revenue: revenueActual,
          orders: orderCount,
          visits: visitCount,
          newCustomers: newCustCount,
          calls: callCount,
          quotes: quoteCount,
          convertedQuotes,
          conversionRate,
        },
        achieveRate,
        hasTarget: !!target,
      }
    })
  )

  return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'sales-targets.GET')
  }
}

/**
 * POST /api/sales-targets — Set/update a sales target
 * Body: { userId, month: "2026-03", revenueTarget, orderTarget?, visitTarget?, newCustTarget? }
 */
export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only managers can set targets
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(user?.role ?? '')) {
    return NextResponse.json({ error: '僅主管可設定目標' }, { status: 403 })
  }

  const body = await req.json() as {
    userId: string
    month: string
    revenueTarget: number
    orderTarget?: number
    visitTarget?: number
    newCustTarget?: number
  }

  const [year, month] = body.month.split('-').map(Number)
  const targetMonth = new Date(year, month - 1, 1)

  const target = await prisma.salesTarget.upsert({
    where: {
      userId_targetMonth: { userId: body.userId, targetMonth },
    },
    update: {
      revenueTarget: body.revenueTarget,
      orderTarget: body.orderTarget ?? null,
      visitTarget: body.visitTarget ?? null,
      newCustTarget: body.newCustTarget ?? null,
    },
    create: {
      userId: body.userId,
      targetMonth,
      revenueTarget: body.revenueTarget,
      orderTarget: body.orderTarget ?? null,
      visitTarget: body.visitTarget ?? null,
      newCustTarget: body.newCustTarget ?? null,
    },
  })

  return NextResponse.json(target, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'sales-targets.POST')
  }
}
