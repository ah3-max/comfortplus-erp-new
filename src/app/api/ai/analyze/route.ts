import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { erpAiAnalyze } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type } = await req.json() as {
    type: 'order' | 'customer' | 'inventory' | 'sales'
  }

  if (!type) {
    return NextResponse.json({ error: '請指定分析類型' }, { status: 400 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  try {
    let data: unknown = {}

    if (type === 'order') {
      const [monthOrders, lastMonthOrders, statusBreakdown, topProducts] = await Promise.all([
        prisma.salesOrder.aggregate({
          where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
          _sum: { totalAmount: true },
          _count: { id: true },
          _avg: { totalAmount: true },
        }),
        prisma.salesOrder.aggregate({
          where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: 'CANCELLED' } },
          _sum: { totalAmount: true },
          _count: { id: true },
        }),
        prisma.salesOrder.groupBy({
          by: ['status'],
          where: { createdAt: { gte: startOfMonth } },
          _count: { id: true },
        }),
        prisma.salesOrderItem.groupBy({
          by: ['productId'],
          where: { order: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } },
          _sum: { subtotal: true, quantity: true },
          orderBy: { _sum: { subtotal: 'desc' } },
          take: 10,
        }),
      ])

      const productIds = topProducts.map(p => p.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      })
      const prodMap = Object.fromEntries(products.map(p => [p.id, p]))

      data = {
        本月: { 訂單數: monthOrders._count.id, 營收: Number(monthOrders._sum.totalAmount ?? 0), 平均客單價: Number(monthOrders._avg.totalAmount ?? 0) },
        上月: { 訂單數: lastMonthOrders._count.id, 營收: Number(lastMonthOrders._sum.totalAmount ?? 0) },
        狀態分布: statusBreakdown.map(s => ({ 狀態: s.status, 筆數: s._count.id })),
        熱銷商品Top10: topProducts.map(p => ({
          商品: prodMap[p.productId]?.name ?? p.productId,
          SKU: prodMap[p.productId]?.sku ?? '',
          營收: Number(p._sum.subtotal ?? 0),
          數量: p._sum.quantity ?? 0,
        })),
      }
    }

    if (type === 'customer') {
      const [totalActive, newThisMonth, topCustomers, typeBreakdown] = await Promise.all([
        prisma.customer.count({ where: { isActive: true } }),
        prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.salesOrder.groupBy({
          by: ['customerId'],
          where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
          _sum: { totalAmount: true },
          _count: { id: true },
          orderBy: { _sum: { totalAmount: 'desc' } },
          take: 10,
        }),
        prisma.customer.groupBy({
          by: ['type'],
          where: { isActive: true },
          _count: { id: true },
        }),
      ])

      const custIds = topCustomers.map(c => c.customerId)
      const custs = await prisma.customer.findMany({
        where: { id: { in: custIds } },
        select: { id: true, name: true, code: true },
      })
      const custMap = Object.fromEntries(custs.map(c => [c.id, c]))

      data = {
        總客戶: totalActive,
        本月新增: newThisMonth,
        類型分布: typeBreakdown.map(t => ({ 類型: t.type, 數量: t._count.id })),
        本月Top10客戶: topCustomers.map(c => ({
          客戶: custMap[c.customerId]?.name ?? c.customerId,
          營收: Number(c._sum.totalAmount ?? 0),
          訂單數: c._count.id,
        })),
      }
    }

    if (type === 'inventory') {
      const [lowStockItems, outOfStockItems, topMoving] = await Promise.all([
        prisma.$queryRaw<Array<{ name: string; sku: string; quantity: number; safetyStock: number }>>`
          SELECT p.name, p.sku, i.quantity, i."safetyStock"
          FROM "Inventory" i JOIN "Product" p ON p.id = i."productId"
          WHERE i.quantity <= i."safetyStock" AND i.quantity > 0 AND p."isActive" = true
          ORDER BY (i.quantity::float / NULLIF(i."safetyStock", 0)) ASC LIMIT 15
        `,
        prisma.$queryRaw<Array<{ name: string; sku: string }>>`
          SELECT p.name, p.sku
          FROM "Inventory" i JOIN "Product" p ON p.id = i."productId"
          WHERE i.quantity = 0 AND p."isActive" = true LIMIT 10
        `,
        prisma.salesOrderItem.groupBy({
          by: ['productId'],
          where: { order: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 10,
        }),
      ])

      const movingIds = topMoving.map(m => m.productId)
      const movingProducts = await prisma.product.findMany({
        where: { id: { in: movingIds } },
        select: { id: true, name: true, sku: true },
      })
      const movMap = Object.fromEntries(movingProducts.map(p => [p.id, p]))

      data = {
        低庫存: lowStockItems.map(i => ({ 商品: i.name, SKU: i.sku, 現有: i.quantity, 安全量: i.safetyStock })),
        缺貨: outOfStockItems.map(i => ({ 商品: i.name, SKU: i.sku })),
        本月銷量Top10: topMoving.map(m => ({
          商品: movMap[m.productId]?.name ?? m.productId,
          銷量: m._sum.quantity ?? 0,
        })),
      }
    }

    if (type === 'sales') {
      const salesData = await prisma.$queryRaw<Array<{
        userId: string; name: string; revenue: number; orders: bigint
      }>>`
        SELECT so."createdById" AS "userId", u.name,
               SUM(so."totalAmount")::float AS revenue, COUNT(so.id) AS orders
        FROM "SalesOrder" so JOIN "User" u ON u.id = so."createdById"
        WHERE so."createdAt" >= ${startOfMonth} AND so.status != 'CANCELLED'
        GROUP BY so."createdById", u.name ORDER BY revenue DESC
      `
      data = {
        業務績效: salesData.map(s => ({
          業務: s.name,
          營收: Number(s.revenue),
          訂單數: Number(s.orders),
        })),
      }
    }

    const result = await erpAiAnalyze(type, data)

    return NextResponse.json({
      analysis: result.content,
      provider: result.provider,
      model: result.model,
      data,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
