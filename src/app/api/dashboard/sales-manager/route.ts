import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  // ── Team members (sales reps) ──────────────────────────────
  const teamMembers = await prisma.user.findMany({
    where: { role: { in: ['SALES', 'SALES_MANAGER'] }, isActive: true },
    select: { id: true, name: true, role: true },
  })
  const teamIds = teamMembers.map(m => m.id)

  // ── Team monthly performance ───────────────────────────────
  const [teamMonthRevAgg, teamLastMonthRevAgg, teamMonthOrders] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrder.aggregate({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrder.count({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    }),
  ])

  const teamRevenue = Number(teamMonthRevAgg._sum.totalAmount ?? 0)
  const teamLastRev = Number(teamLastMonthRevAgg._sum.totalAmount ?? 0)
  const teamGrowth = teamLastRev === 0 ? null : Math.round(((teamRevenue - teamLastRev) / teamLastRev) * 100)

  // ── Individual sales ranking ───────────────────────────────
  const salesRankingRaw = await prisma.$queryRaw<Array<{
    userId: string; name: string; revenue: number; orders: bigint
  }>>`
    SELECT so."createdById" AS "userId", u.name,
           SUM(so."totalAmount")::float AS revenue,
           COUNT(so.id) AS orders
    FROM "SalesOrder" so
    JOIN "User" u ON u.id = so."createdById"
    WHERE so."createdAt" >= ${startOfMonth}
      AND so.status != 'CANCELLED'
      AND so."createdById" = ANY(${teamIds})
    GROUP BY so."createdById", u.name
    ORDER BY revenue DESC
  `
  const salesRanking = salesRankingRaw.map(r => ({
    userId: r.userId, name: r.name,
    revenue: Number(r.revenue), orders: Number(r.orders),
  }))

  // ── Today's team activity ──────────────────────────────────
  const [todayTeamOrders, todayTeamRevAgg] = await Promise.all([
    prisma.salesOrder.count({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfToday }, status: { not: 'CANCELLED' } },
    }),
    prisma.salesOrder.aggregate({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfToday }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
  ])

  // ── Funnel: quotes → orders conversion ─────────────────────
  const [monthQuotes, monthSentQuotes, monthAcceptedQuotes, monthConvertedQuotes] = await Promise.all([
    prisma.quotation.count({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfMonth } },
    }),
    prisma.quotation.count({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfMonth }, status: { in: ['SENT', 'ACCEPTED', 'CONVERTED'] } },
    }),
    prisma.quotation.count({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfMonth }, status: { in: ['ACCEPTED', 'CONVERTED'] } },
    }),
    prisma.quotation.count({
      where: { createdById: { in: teamIds }, createdAt: { gte: startOfMonth }, status: 'CONVERTED' },
    }),
  ])
  const conversionRate = monthQuotes > 0 ? Math.round((monthConvertedQuotes / monthQuotes) * 100) : 0

  // ── Pending approvals ──────────────────────────────────────
  const [pendingQuotations, pendingDiscounts] = await Promise.all([
    prisma.quotation.count({
      where: { status: 'PENDING_APPROVAL' },
    }),
    prisma.quotationApproval.count({
      where: { status: 'PENDING' },
    }),
  ])

  // ── Customer health: unvisited in 30 days ──────────────────
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const unvisitedCustomers = await prisma.customer.count({
    where: {
      salesRepId: { in: teamIds },
      isActive: true,
      lastContactDate: { lt: thirtyDaysAgo },
    },
  })

  // ── Team visits/calls this month ───────────────────────────
  const [teamVisits, teamCalls] = await Promise.all([
    prisma.visitRecord.count({
      where: { visitedById: { in: teamIds }, visitDate: { gte: startOfMonth } },
    }),
    prisma.callRecord.count({
      where: { calledById: { in: teamIds }, callDate: { gte: startOfMonth } },
    }),
  ])

  return NextResponse.json({
    team: {
      memberCount: teamMembers.length,
      members: teamMembers,
    },
    today: {
      orders: todayTeamOrders,
      revenue: Number(todayTeamRevAgg._sum.totalAmount ?? 0),
    },
    month: {
      revenue: teamRevenue,
      growth: teamGrowth,
      orders: teamMonthOrders,
    },
    salesRanking,
    funnel: {
      quotes: monthQuotes,
      sent: monthSentQuotes,
      accepted: monthAcceptedQuotes,
      converted: monthConvertedQuotes,
      conversionRate,
    },
    pending: {
      quotations: pendingQuotations,
      discounts: pendingDiscounts,
    },
    customerHealth: {
      unvisitedCount: unvisitedCustomers,
    },
    activity: {
      visits: teamVisits,
      calls: teamCalls,
    },
  })
  } catch (error) {
    return handleApiError(error, 'dashboard.salesManager.GET')
  }
}
