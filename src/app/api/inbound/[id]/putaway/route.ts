import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/inbound/[id]/putaway — 確認上架完成
// body: { items: [{ id: inboundItemId, locationCode: "A-01-03" }] }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const inbound = await prisma.inboundRecord.findUnique({
    where: { id },
    select: { id: true, qcResult: true, putawayStatus: true },
  })

  if (!inbound) return NextResponse.json({ error: 'Inbound not found' }, { status: 404 })
  if (inbound.qcResult !== 'PASS') {
    return NextResponse.json({ error: 'QC 尚未通過，無法上架' }, { status: 400 })
  }

  // Update each item's location
  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      if (item.id && item.locationCode) {
        await prisma.inboundItem.update({
          where: { id: item.id },
          data: { locationCode: item.locationCode },
        })
      }
    }
  }

  // Mark putaway completed
  const updated = await prisma.inboundRecord.update({
    where: { id },
    data: { putawayStatus: 'COMPLETED' },
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
      warehouse: { select: { code: true, name: true } },
    },
  })

  return NextResponse.json(updated)
}
