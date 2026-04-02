import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/wms/auto-putaway
 * Suggest warehouse location for a product based on category and available zones
 * Body: { productId: string, warehouseId: string, quantity: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { productId: string; warehouseId: string; quantity?: number }

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true, sku: true, name: true, category: true, unit: true },
    })
    if (!product) return NextResponse.json({ error: '商品不存在' }, { status: 404 })

    // Find available WMS zones in this warehouse
    const zones = await prisma.wmsZone.findMany({
      where: { warehouseId: body.warehouseId },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })

    // Zone assignment rules based on product category
    const categoryZoneMap: Record<string, string[]> = {
      FINISHED_GOODS: ['A', 'B', 'FG'],
      RAW_MATERIAL:   ['C', 'D', 'RM'],
      PACKAGING:      ['E', 'PKG'],
      SEMI_FINISHED:  ['F', 'SF'],
    }
    const preferredZoneCodes = categoryZoneMap[product.category ?? ''] ?? ['A', 'B']

    // Find best zone
    const preferredZone = zones.find(z =>
      preferredZoneCodes.some(code => z.code.startsWith(code))
    ) ?? zones[0]

    const suggestedLocation = preferredZone
      ? `${preferredZone.code}-R01-S01`
      : `A01-R01-S01`

    return NextResponse.json({
      suggestion: suggestedLocation,
      reason: preferredZone
        ? `依商品類別 ${product.category} 自動指派至 ${preferredZone.name}`
        : '預設位置',
      zoneId: preferredZone?.id ?? null,
      zoneName: preferredZone?.name ?? null,
      zones: zones.slice(0, 10),
    })
  } catch (error) {
    return handleApiError(error, 'wms.autoPutaway')
  }
}
