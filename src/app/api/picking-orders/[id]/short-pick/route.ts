import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { notifyByRole } from '@/lib/notify'

/**
 * POST /api/picking-orders/[id]/short-pick
 * Submit picked quantities and detect short/over picks
 * Body: { items: [{ itemId: string, pickedQuantity: number }] }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as { items: { itemId: string; pickedQuantity: number }[] }

    const po = await prisma.pickingOrder.findUnique({
      where: { id },
      include: {
        items: true,
        customer: { select: { name: true } },
      },
    })
    if (!po) return NextResponse.json({ error: '找不到理貨單' }, { status: 404 })
    if (!['PENDING', 'PICKING'].includes(po.status)) {
      return NextResponse.json({ error: '只能在理貨中或待理貨狀態更新揀貨量' }, { status: 400 })
    }

    // Update each item's picked quantity
    const updates = body.items.map(({ itemId, pickedQuantity }) =>
      prisma.pickingOrderItem.update({
        where: { id: itemId },
        data: { pickedQuantity: Math.max(0, Number(pickedQuantity)) },
      })
    )
    await Promise.all(updates)

    // Reload to check for discrepancies
    const updated = await prisma.pickingOrder.findUnique({
      where: { id },
      include: { items: true },
    })

    const shortPicks = (updated?.items ?? []).filter(i =>
      Number(i.pickedQuantity) < Number(i.quantity)
    ).map(i => ({
      itemId: i.id,
      productName: i.productName,
      required: Number(i.quantity),
      picked: Number(i.pickedQuantity),
      shortage: Number(i.quantity) - Number(i.pickedQuantity),
    }))

    const overPicks = (updated?.items ?? []).filter(i =>
      Number(i.pickedQuantity) > Number(i.quantity)
    ).map(i => ({
      itemId: i.id,
      productName: i.productName,
      required: Number(i.quantity),
      picked: Number(i.pickedQuantity),
      excess: Number(i.pickedQuantity) - Number(i.quantity),
    }))

    const hasIssues = shortPicks.length > 0 || overPicks.length > 0

    // Auto-notify warehouse manager if there are short picks
    if (shortPicks.length > 0) {
      const itemSummary = shortPicks.map(s => `${s.productName} 短撿 ${s.shortage}`).join('、')
      notifyByRole(['WAREHOUSE_MANAGER'], {
        title: `理貨短撿：${po.pickingNumber}`,
        message: `${po.customer?.name ?? ''} — ${itemSummary}`,
        linkUrl: `/picking?id=${id}`,
        category: 'WAREHOUSE_ALERT',
        priority: 'HIGH',
      }).catch(() => {})
    }

    // Update status to PICKING if still PENDING
    if (po.status === 'PENDING') {
      await prisma.pickingOrder.update({ where: { id }, data: { status: 'PICKING' } })
    }

    return NextResponse.json({
      shortPicks,
      overPicks,
      hasIssues,
      totalShortage: shortPicks.reduce((s, i) => s + i.shortage, 0),
      message: hasIssues
        ? `發現 ${shortPicks.length} 項短撿，${overPicks.length} 項超撿`
        : '揀貨數量與需求相符',
    })
  } catch (error) {
    return handleApiError(error, 'picking-orders.shortPick')
  }
}
