import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/wms/cycle-count
 * Returns products that should be counted in the next cycle
 * Priority: products not counted in >30 days (HIGH), >14 days (MEDIUM), else LOW
 *
 * POST /api/wms/cycle-count
 * Submit cycle count results
 * Body: { items: [{ inventoryId, countedQty }] }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const warehouse = searchParams.get('warehouseId') ?? searchParams.get('warehouse')
    const limit = Math.min(100, Number(searchParams.get('limit') ?? 50))

    // Get inventory items, prioritize those not recently updated
    const inventories = await prisma.inventory.findMany({
      where: {
        ...(warehouse ? { warehouse } : {}),
        quantity: { gt: 0 },
        category: 'FINISHED_GOODS',
      },
      include: {
        product: { select: { sku: true, name: true, unit: true, category: true } },
      },
      orderBy: { updatedAt: 'asc' }, // oldest-updated first = most stale
      take: limit,
    })

    const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

    const items = inventories.map(inv => {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(inv.updatedAt).getTime()) / 86400000
      )
      const priority = daysSinceUpdate > 30 ? 'HIGH' : daysSinceUpdate > 14 ? 'MEDIUM' : 'LOW'
      return {
        inventoryId: inv.id,
        productSku: inv.product.sku,
        productName: inv.product.name,
        unit: inv.product.unit,
        warehouse: inv.warehouse,
        systemQty: Number(inv.quantity),
        daysSinceUpdate,
        priority,
      }
    })

    // Sort: HIGH first, then MEDIUM, then LOW
    items.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))

    return NextResponse.json({
      total: items.length,
      highPriority: items.filter(i => i.priority === 'HIGH').length,
      items,
    })
  } catch (error) {
    return handleApiError(error, 'wms.cycleCount.GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      items: { inventoryId: string; countedQty: number }[]
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: '請提供盤點品項' }, { status: 400 })
    }

    const results: { inventoryId: string; before: number; after: number; diff: number }[] = []

    for (const { inventoryId, countedQty } of body.items) {
      const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } })
      if (!inv) continue

      const before = Number(inv.quantity)
      const diff   = countedQty - before

      await prisma.inventory.update({
        where: { id: inventoryId },
        data: { quantity: countedQty },
      })

      results.push({ inventoryId, before, after: countedQty, diff })
    }

    const adjustments = results.filter(r => r.diff !== 0)

    return NextResponse.json({
      counted: results.length,
      adjustments: adjustments.length,
      results,
      message: `盤點完成：${results.length} 項，${adjustments.length} 項有差異`,
    })
  } catch (error) {
    return handleApiError(error, 'wms.cycleCount.POST')
  }
}
