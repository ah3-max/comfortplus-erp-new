import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const CAN_SEE_COST = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const months = Number(searchParams.get('months') ?? '6')

  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  // ── 月度營收趨勢 ────────────────────────────────────
  const orders = await prisma.salesOrder.findMany({
    where: { createdAt: { gte: startDate }, status: { notIn: ['CANCELLED'] } },
    select: { createdAt: true, totalAmount: true, status: true, paidAmount: true },
    orderBy: { createdAt: 'asc' },
  })
  const monthlyMap: Record<string, { revenue: number; orders: number; paid: number }> = {}
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = { revenue: 0, orders: 0, paid: 0 }
  }
  orders.forEach((o) => {
    const d = new Date(o.createdAt)
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
    if (monthlyMap[key]) {
      monthlyMap[key].revenue += Number(o.totalAmount)
      monthlyMap[key].orders += 1
      monthlyMap[key].paid += Number(o.paidAmount)
    }
  })
  const monthlyRevenue = Object.entries(monthlyMap).map(([month, data]) => ({ month, ...data }))

  // ── 客戶排行（本年度）──────────────────────────────
  const topCustomersRaw = await prisma.salesOrder.groupBy({
    by: ['customerId'],
    where: { createdAt: { gte: startOfYear }, status: { notIn: ['CANCELLED'] } },
    _sum: { totalAmount: true },
    _count: { id: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
    take: 8,
  })
  const customerIds = topCustomersRaw.map((c) => c.customerId)
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true, code: true },
  })
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]))
  const topCustomers = topCustomersRaw.map((c) => ({
    customer: customerMap[c.customerId] ?? null,
    revenue: Number(c._sum.totalAmount ?? 0),
    orders: c._count.id,
  }))

  // ── 商品銷售排行（本年度）──────────────────────────
  const topProductsRaw = await prisma.salesOrderItem.groupBy({
    by: ['productId'],
    where: { order: { createdAt: { gte: startOfYear }, status: { notIn: ['CANCELLED'] } } },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: 8,
  })
  const productIds = topProductsRaw.map((p) => p.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true, unit: true },
  })
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const topProducts = topProductsRaw.map((p) => ({
    product: productMap[p.productId] ?? null,
    quantity: p._sum.quantity ?? 0,
    revenue: Number(p._sum.subtotal ?? 0),
  }))

  // ── 訂單狀態分佈 ────────────────────────────────────
  const orderStatusDist = await prisma.salesOrder.groupBy({
    by: ['status'],
    _count: { id: true },
  })

  // ── 應收帳款摘要 ────────────────────────────────────
  const receivable = await prisma.salesOrder.aggregate({
    where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
    _sum: { totalAmount: true, paidAmount: true },
  })
  const totalReceivable = Number(receivable._sum.totalAmount ?? 0) - Number(receivable._sum.paidAmount ?? 0)

  // ── 業務業績排行（本年度）──────────────────────────
  const salesRepRaw = await prisma.salesOrder.groupBy({
    by: ['createdById'],
    where: { createdAt: { gte: startOfYear }, status: { notIn: ['CANCELLED'] } },
    _sum: { totalAmount: true },
    _count: { id: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
  })
  const repIds = salesRepRaw.map((r) => r.createdById)
  const repUsers = await prisma.user.findMany({
    where: { id: { in: repIds } },
    select: { id: true, name: true, role: true },
  })
  const repMap = Object.fromEntries(repUsers.map((u) => [u.id, u]))
  const salesRepPerf = salesRepRaw.map((r) => ({
    user: repMap[r.createdById] ?? null,
    revenue: Number(r._sum.totalAmount ?? 0),
    orders: r._count.id,
  }))

  // 業務月度趨勢（最近 N 個月，僅含指定月份區間訂單，按業務分組）
  const ordersWithRep = await prisma.salesOrder.findMany({
    where: { createdAt: { gte: startDate }, status: { notIn: ['CANCELLED'] } },
    select: { createdAt: true, totalAmount: true, createdById: true },
  })
  // 建立: { repId: { month: revenue } }
  const repMonthMap: Record<string, Record<string, number>> = {}
  ordersWithRep.forEach((o) => {
    const d = new Date(o.createdAt)
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!repMonthMap[o.createdById]) repMonthMap[o.createdById] = {}
    repMonthMap[o.createdById][key] = (repMonthMap[o.createdById][key] ?? 0) + Number(o.totalAmount)
  })
  const monthKeys = Object.keys(monthlyMap)
  const topRepIds = salesRepRaw.slice(0, 5).map((r) => r.createdById)
  const salesRepMonthly = monthKeys.map((month) => {
    const row: Record<string, number | string> = { month }
    topRepIds.forEach((id) => {
      const name = repMap[id]?.name ?? id
      row[name] = repMonthMap[id]?.[month] ?? 0
    })
    return row
  })
  const salesRepNames = topRepIds.map((id) => repMap[id]?.name ?? id)

  // ── 通路（客戶類型）銷售分析（本年度）──────────────
  const ordersWithCustType = await prisma.salesOrder.findMany({
    where: { createdAt: { gte: startOfYear }, status: { notIn: ['CANCELLED'] } },
    select: {
      totalAmount: true,
      customer: { select: { type: true } },
    },
  })
  const typeMap: Record<string, number> = {}
  ordersWithCustType.forEach((o) => {
    const t = o.customer?.type ?? 'OTHER'
    typeMap[t] = (typeMap[t] ?? 0) + Number(o.totalAmount)
  })
  const channelRevenue = Object.entries(typeMap)
    .map(([type, revenue]) => ({ type, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // 通路月度趨勢
  const ordersWithCustTypeMonth = await prisma.salesOrder.findMany({
    where: { createdAt: { gte: startDate }, status: { notIn: ['CANCELLED'] } },
    select: {
      createdAt: true, totalAmount: true,
      customer: { select: { type: true } },
    },
  })
  const channelMonthMap: Record<string, Record<string, number>> = {}
  ordersWithCustTypeMonth.forEach((o) => {
    const d = new Date(o.createdAt)
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
    const t = o.customer?.type ?? 'OTHER'
    if (!channelMonthMap[t]) channelMonthMap[t] = {}
    channelMonthMap[t][key] = (channelMonthMap[t][key] ?? 0) + Number(o.totalAmount)
  })
  const allTypes = Object.keys(channelMonthMap)
  const channelMonthly = monthKeys.map((month) => {
    const row: Record<string, number | string> = { month }
    allTypes.forEach((t) => { row[t] = channelMonthMap[t]?.[month] ?? 0 })
    return row
  })

  // ── 商品毛利分析（僅限 CAN_SEE_COST 角色）──────────
  let productMargin: { product: { id: string; sku: string; name: string; unit: string } | null; revenue: number; cost: number; margin: number; quantity: number }[] = []
  if (CAN_SEE_COST.includes(session.user.role)) {
    const marginItems = await prisma.salesOrderItem.groupBy({
      by: ['productId'],
      where: { order: { createdAt: { gte: startOfYear }, status: { notIn: ['CANCELLED'] } } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 12,
    })
    const mProductIds = marginItems.map((p) => p.productId)
    const mProducts = await prisma.product.findMany({
      where: { id: { in: mProductIds } },
      select: { id: true, sku: true, name: true, unit: true, costPrice: true },
    })
    const mProductMap = Object.fromEntries(mProducts.map((p) => [p.id, p]))
    productMargin = marginItems.map((p) => {
      const prod = mProductMap[p.productId]
      const rev = Number(p._sum.subtotal ?? 0)
      const qty = p._sum.quantity ?? 0
      const cost = prod ? Number(prod.costPrice) * qty : 0
      const margin = rev > 0 ? ((rev - cost) / rev) * 100 : 0
      return {
        product: prod ? { id: prod.id, sku: prod.sku, name: prod.name, unit: prod.unit } : null,
        revenue: rev,
        cost,
        margin: Math.round(margin * 10) / 10,
        quantity: qty,
      }
    })
  }

  // ── 採購報表（僅限 CAN_SEE_COST 角色）──────────────
  let purchaseData: {
    monthlyPurchase: { month: string; amount: number; orders: number }[]
    bySupplier: { supplierName: string; amount: number; orders: number }[]
    byType: { type: string; amount: number }[]
    totalPayable: number
    avgLeadDays: number | null
    onTimeRate: number | null
  } | null = null

  if (CAN_SEE_COST.includes(session.user.role)) {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        createdAt: true, totalAmount: true, orderType: true,
        expectedDate: true,
        supplier: { select: { id: true, name: true } },
        receipts: { select: { receiptDate: true } },
      },
    })

    // 月度採購趨勢
    const poMonthMap: Record<string, { amount: number; orders: number }> = {}
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
      poMonthMap[key] = { amount: 0, orders: 0 }
    }
    purchaseOrders.forEach(po => {
      const d = new Date(po.createdAt)
      const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
      if (poMonthMap[key]) {
        poMonthMap[key].amount += Number(po.totalAmount)
        poMonthMap[key].orders += 1
      }
    })
    const monthlyPurchase = Object.entries(poMonthMap).map(([month, v]) => ({ month, ...v }))

    // 供應商採購佔比
    const supplierMap: Record<string, { supplierName: string; amount: number; orders: number }> = {}
    purchaseOrders.forEach(po => {
      const sid = po.supplier.id
      if (!supplierMap[sid]) supplierMap[sid] = { supplierName: po.supplier.name, amount: 0, orders: 0 }
      supplierMap[sid].amount += Number(po.totalAmount)
      supplierMap[sid].orders += 1
    })
    const bySupplier = Object.values(supplierMap).sort((a, b) => b.amount - a.amount).slice(0, 8)

    // 採購類型分佈
    const typeMap: Record<string, number> = {}
    purchaseOrders.forEach(po => {
      typeMap[po.orderType] = (typeMap[po.orderType] ?? 0) + Number(po.totalAmount)
    })
    const byType = Object.entries(typeMap).map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount)

    // 應付帳款（未完成採購的未付金額）
    const payableAgg = await prisma.purchaseOrder.aggregate({
      where: { status: { notIn: ['CANCELLED', 'RECEIVED'] } },
      _sum: { totalAmount: true, paidAmount: true },
    })
    const totalPayable = Number(payableAgg._sum.totalAmount ?? 0) - Number(payableAgg._sum.paidAmount ?? 0)

    // 到貨準時率（有 expectedDate 且有收貨紀錄的 PO）
    const posWithExpected = purchaseOrders.filter(po => po.expectedDate && po.receipts.length > 0)
    let onTime = 0
    posWithExpected.forEach(po => {
      const firstReceipt = po.receipts[0].receiptDate
      if (firstReceipt <= po.expectedDate!) onTime++
    })
    const onTimeRate = posWithExpected.length > 0
      ? Math.round((onTime / posWithExpected.length) * 100)
      : null

    // 平均交期天數（expectedDate - createdAt）
    const posWithLead = purchaseOrders.filter(po => po.expectedDate)
    const avgLeadDays = posWithLead.length > 0
      ? Math.round(posWithLead.reduce((sum, po) => {
          return sum + (new Date(po.expectedDate!).getTime() - new Date(po.createdAt).getTime()) / 86400000
        }, 0) / posWithLead.length)
      : null

    purchaseData = { monthlyPurchase, bySupplier, byType, totalPayable, avgLeadDays, onTimeRate }
  }

  return NextResponse.json({
    monthlyRevenue,
    topCustomers,
    topProducts,
    orderStatusDist,
    totalReceivable,
    salesRepPerf,
    salesRepMonthly,
    salesRepNames,
    channelRevenue,
    channelMonthly,
    channelTypes: allTypes,
    productMargin,
    purchaseData,
    canSeeCost: CAN_SEE_COST.includes(session.user.role),
  })
}
