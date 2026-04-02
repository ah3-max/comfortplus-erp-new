import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/picking-orders/[id]/optimize-path
 * Returns picking items sorted by warehouse location for optimized path
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const po = await prisma.pickingOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { sku: true, name: true, unit: true },
            },
          },
        },
      },
    })

    if (!po) return NextResponse.json({ error: '找不到理貨單' }, { status: 404 })

    // Get inventory locations for each product (FEFO order)
    const productIds = po.items.map(i => i.productId)
    const inventoryLots = await prisma.inventoryLot.findMany({
      where: {
        productId: { in: productIds },
        quantity: { gt: 0 },
        status: 'AVAILABLE',
      },
      orderBy: [{ expiryDate: 'asc' }, { inboundDate: 'asc' }],
      select: {
        productId: true, lotNo: true, expiryDate: true,
        quantity: true, location: true,
      },
    })

    // Map by productId (first lot per product = FEFO)
    const lotMap: Record<string, typeof inventoryLots[0]> = {}
    for (const lot of inventoryLots) {
      if (!lotMap[lot.productId]) lotMap[lot.productId] = lot
    }

    const pickingPath = po.items.map(item => {
      const lot = lotMap[item.productId]
      return {
        itemId: item.id,
        productSku: item.product?.sku ?? '',
        productName: item.product?.name ?? item.productName,
        unit: item.product?.unit ?? '',
        quantity: Number(item.quantity),
        pickedQuantity: Number(item.pickedQuantity),
        location: lot?.location ?? '',
        lotNo: lot?.lotNo ?? null,
        expiryDate: lot?.expiryDate ?? null,
        availableQty: Number(lot?.quantity ?? 0),
        isSufficient: Number(lot?.quantity ?? 0) >= Number(item.quantity),
      }
    })

    // Sort by location (empty last)
    pickingPath.sort((a, b) => {
      if (!a.location && !b.location) return 0
      if (!a.location) return 1
      if (!b.location) return -1
      return a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: 'base' })
    })

    const shortPickItems = pickingPath.filter(i => !i.isSufficient)

    return NextResponse.json({
      pickingOrderId: id,
      totalStops: new Set(pickingPath.map(i => i.location).filter(Boolean)).size,
      shortPickCount: shortPickItems.length,
      path: pickingPath,
    })
  } catch (error) {
    return handleApiError(error, 'picking-orders.optimizePath')
  }
}
