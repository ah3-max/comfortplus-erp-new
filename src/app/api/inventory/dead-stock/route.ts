import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/inventory/dead-stock
 * Dead / slow-moving stock analysis
 * Query: noMovementDays (default 90), warehouse (optional)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'WAREHOUSE_MANAGER', 'PROCUREMENT'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const noMovementDays = parseInt(searchParams.get('noMovementDays') ?? '90')
    const warehouse = searchParams.get('warehouse') ?? undefined

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - noMovementDays)

    // Get all inventory rows with stock > 0
    const inventoryRows = await prisma.inventory.findMany({
      where: {
        quantity: { gt: 0 },
        ...(warehouse ? { warehouse } : {}),
      },
      select: {
        id: true,
        productId: true,
        warehouse: true,
        quantity: true,
        availableQty: true,
        damagedQty: true,
        safetyStock: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            unit: true,
            isActive: true,
            costPrice: true,
          },
        },
      },
    })

    // Find products with outbound movement after cutoff
    const activeProductIds = new Set<string>()

    const recentOutbound = await prisma.outboundItem.findMany({
      where: {
        outbound: { shipDate: { gte: cutoffDate } },
        productId: { in: inventoryRows.map(r => r.productId) },
      },
      select: { productId: true, outbound: { select: { shipDate: true } } },
      distinct: ['productId'],
    })
    for (const o of recentOutbound) {
      activeProductIds.add(o.productId)
    }

    // Also check recent inbound (recent purchase receipt = recently acquired, not necessarily dead)
    const recentInbound = await prisma.inboundItem.findMany({
      where: {
        inbound: { arrivalDate: { gte: cutoffDate } },
        productId: { in: inventoryRows.map(r => r.productId) },
      },
      select: { productId: true },
      distinct: ['productId'],
    })
    const newlyReceivedIds = new Set(recentInbound.map(i => i.productId))

    // Get last outbound date per product
    const lastOutboundMap = new Map<string, Date>()
    const lastOutbounds = await prisma.outboundItem.findMany({
      where: { productId: { in: inventoryRows.map(r => r.productId) } },
      select: { productId: true, outbound: { select: { shipDate: true } } },
      orderBy: { outbound: { shipDate: 'desc' } },
      distinct: ['productId'],
    })
    for (const o of lastOutbounds) {
      if (o.outbound.shipDate) lastOutboundMap.set(o.productId, o.outbound.shipDate)
    }

    const now = new Date()

    const data = inventoryRows
      .filter(row => !activeProductIds.has(row.productId))
      .map(row => {
        const lastMovement = lastOutboundMap.get(row.productId) ?? null
        const daysSinceMovement = lastMovement
          ? Math.round((now.getTime() - lastMovement.getTime()) / 86400000)
          : null
        const stockValue = Number(row.product.costPrice ?? 0) * row.quantity
        const isNewlyReceived = newlyReceivedIds.has(row.productId)

        return {
          productId: row.productId,
          name: row.product.name,
          sku: row.product.sku,
          category: row.product.category ?? null,
          unit: row.product.unit,
          warehouse: row.warehouse,
          quantity: row.quantity,
          availableQty: row.availableQty,
          damagedQty: row.damagedQty,
          safetyStock: row.safetyStock,
          lastMovementDate: lastMovement ? lastMovement.toISOString().slice(0, 10) : null,
          daysSinceMovement,
          stockValue,
          isNewlyReceived,
          isDiscontinued: !row.product.isActive,
          riskLevel: !lastMovement ? 'DEAD'
            : daysSinceMovement! >= 180 ? 'DEAD'
            : daysSinceMovement! >= 90 ? 'SLOW'
            : 'WATCH',
        }
      })
      .sort((a, b) => (b.daysSinceMovement ?? 9999) - (a.daysSinceMovement ?? 9999))

    const summary = {
      total: data.length,
      dead: data.filter(d => d.riskLevel === 'DEAD').length,
      slow: data.filter(d => d.riskLevel === 'SLOW').length,
      watch: data.filter(d => d.riskLevel === 'WATCH').length,
      totalStockValue: data.reduce((s, d) => s + d.stockValue, 0),
      deadStockValue: data.filter(d => d.riskLevel === 'DEAD').reduce((s, d) => s + d.stockValue, 0),
    }

    return NextResponse.json({ data, summary })
  } catch (error) {
    return handleApiError(error, 'inventory.dead-stock.GET')
  }
}
