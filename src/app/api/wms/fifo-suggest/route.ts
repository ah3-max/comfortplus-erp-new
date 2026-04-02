import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/wms/fifo-suggest?productId=xxx&warehouseId=xxx&quantity=10
 * Returns FEFO (first-expire-first-out) batch suggestions for picking
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const productId   = searchParams.get('productId')
    const warehouseId = searchParams.get('warehouseId')
    const needed      = Number(searchParams.get('quantity') ?? 0)

    if (!productId) return NextResponse.json({ error: 'productId 必填' }, { status: 400 })

    // Get lots ordered by expiry date (FEFO), then by inbound date (FIFO fallback)
    const lots = await prisma.inventoryLot.findMany({
      where: {
        productId,
        ...(warehouseId ? { warehouseId } : {}),
        quantity: { gt: 0 },
        status: 'AVAILABLE',
      },
      orderBy: [
        { expiryDate: 'asc' },
        { inboundDate: 'asc' },
      ],
      select: {
        id: true, lotNo: true, inboundDate: true,
        expiryDate: true, quantity: true, location: true,
      },
    })

    // Build allocation plan
    const allocation: { lotId: string; lotNo: string; expiryDate: Date | null; location: string | null; allocate: number }[] = []
    let remaining = needed

    for (const lot of lots) {
      if (remaining <= 0) break
      const take = Math.min(remaining, Number(lot.quantity))
      allocation.push({
        lotId: lot.id,
        lotNo: lot.lotNo,
        expiryDate: lot.expiryDate,
        location: lot.location,
        allocate: take,
      })
      remaining -= take
    }

    const totalAvailable = lots.reduce((s, l) => s + Number(l.quantity), 0)
    const canFulfill = remaining <= 0

    // Flag lots expiring within 30 days
    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000)
    const expiringLots = lots.filter(l => l.expiryDate && new Date(l.expiryDate) <= thirtyDaysLater)

    return NextResponse.json({
      productId,
      needed,
      totalAvailable,
      canFulfill,
      shortage: canFulfill ? 0 : remaining,
      allocation,
      expiringWarnings: expiringLots.map(l => ({
        lotNo: l.lotNo,
        expiryDate: l.expiryDate,
        qty: Number(l.quantity),
        daysUntilExpiry: l.expiryDate
          ? Math.ceil((new Date(l.expiryDate).getTime() - now.getTime()) / 86400000)
          : null,
      })),
    })
  } catch (error) {
    return handleApiError(error, 'wms.fifoSuggest')
  }
}
