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

  // ── Accounts Receivable ────────────────────────────────────
  const arOrders = await prisma.salesOrder.findMany({
    where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
    select: { totalAmount: true, paidAmount: true, createdAt: true, customer: { select: { name: true } } },
  })
  const arTotal = arOrders.reduce((s, o) => s + Math.max(0, Number(o.totalAmount) - Number(o.paidAmount)), 0)
  const arCount = arOrders.filter(o => Number(o.totalAmount) > Number(o.paidAmount)).length

  // AR aging buckets
  const arAging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
  arOrders.forEach(o => {
    const unpaid = Math.max(0, Number(o.totalAmount) - Number(o.paidAmount))
    if (unpaid <= 0) return
    const daysSince = Math.floor((now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince <= 30) arAging.current += unpaid
    else if (daysSince <= 60) arAging.days30 += unpaid
    else if (daysSince <= 90) arAging.days60 += unpaid
    else arAging.over90 += unpaid
  })

  // ── Accounts Payable ───────────────────────────────────────
  const apOrders = await prisma.purchaseOrder.findMany({
    where: { status: { notIn: ['CANCELLED', 'RECEIVED'] } },
    select: { totalAmount: true, paidAmount: true, createdAt: true },
  })
  const apTotal = apOrders.reduce((s, o) => s + Math.max(0, Number(o.totalAmount) - Number(o.paidAmount)), 0)
  const apCount = apOrders.filter(o => Number(o.totalAmount) > Number(o.paidAmount)).length

  // ── Today's collections ────────────────────────────────────
  const todayPayments = await prisma.paymentRecord.findMany({
    where: { paymentDate: { gte: startOfToday } },
    select: { amount: true, direction: true },
  })
  const todayCollected = todayPayments
    .filter(p => p.direction === 'INCOMING')
    .reduce((s, p) => s + Number(p.amount), 0)
  const todayPaid = todayPayments
    .filter(p => p.direction === 'OUTGOING')
    .reduce((s, p) => s + Number(p.amount), 0)

  // ── Monthly P&L summary ────────────────────────────────────
  const [monthRevAgg, monthCostItems] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrderItem.findMany({
      where: { order: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } },
      include: { product: { select: { costPrice: true } } },
    }),
  ])
  const monthRevenue = Number(monthRevAgg._sum.totalAmount ?? 0)
  const monthCost = monthCostItems.reduce((s, item) => {
    return s + Number(item.product.costPrice) * item.quantity * (1 - Number(item.discount) / 100)
  }, 0)
  const monthGrossProfit = monthRevenue - monthCost
  const grossMargin = monthRevenue > 0 ? Math.round((monthGrossProfit / monthRevenue) * 1000) / 10 : 0

  // ── Overdue customers (top 5 by amount) ────────────────────
  const overdueRaw = await prisma.$queryRaw<Array<{
    customerId: string; name: string; overdue: number
  }>>`
    SELECT so."customerId", c.name,
           SUM(so."totalAmount" - so."paidAmount")::float AS overdue
    FROM "SalesOrder" so
    JOIN "Customer" c ON c.id = so."customerId"
    WHERE so.status NOT IN ('CANCELLED', 'COMPLETED')
      AND so."totalAmount" > so."paidAmount"
      AND so."createdAt" < ${new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())}
    GROUP BY so."customerId", c.name
    HAVING SUM(so."totalAmount" - so."paidAmount") > 0
    ORDER BY overdue DESC
    LIMIT 5
  `
  const overdueCustomers = overdueRaw.map(r => ({
    customerId: r.customerId, name: r.name, overdue: Number(r.overdue),
  }))

  // ── Pending reconciliation (partially paid orders) ─────────
  const partiallyPaidOrders = await prisma.salesOrder.findMany({
    where: {
      status: { notIn: ['CANCELLED', 'DRAFT'] },
    },
    select: { totalAmount: true, paidAmount: true },
  })
  const pendingReconciliation = partiallyPaidOrders.filter(
    o => Number(o.paidAmount) > 0 && Number(o.totalAmount) !== Number(o.paidAmount)
  ).length

  // ── Monthly purchase cost ──────────────────────────────────
  const monthPurchaseAgg = await prisma.purchaseOrder.aggregate({
    where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    _sum: { totalAmount: true },
  })

  return NextResponse.json({
    receivable: { total: Math.round(arTotal), count: arCount },
    payable: { total: Math.round(apTotal), count: apCount },
    arAging: {
      current: Math.round(arAging.current),
      days30: Math.round(arAging.days30),
      days60: Math.round(arAging.days60),
      days90: Math.round(arAging.days90),
      over90: Math.round(arAging.over90),
    },
    todayCollections: { collected: Math.round(todayCollected), paid: Math.round(todayPaid) },
    monthSummary: {
      revenue: Math.round(monthRevenue),
      cost: Math.round(monthCost),
      grossProfit: Math.round(monthGrossProfit),
      grossMargin,
      purchaseCost: Number(monthPurchaseAgg._sum.totalAmount ?? 0),
    },
    overdueCustomers,
    pendingReconciliation,
  })
  } catch (error) {
    return handleApiError(error, 'dashboard.finance.GET')
  }
}
