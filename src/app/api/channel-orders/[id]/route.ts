import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const order = await prisma.channelOrder.update({
      where: { id },
      data: {
        status:       body.status       ?? undefined,
        salesOrderId: body.salesOrderId !== undefined ? (body.salesOrderId || null) : undefined,
        buyerName:    body.buyerName    ?? undefined,
        buyerPhone:   body.buyerPhone   ?? undefined,
        buyerAddress: body.buyerAddress ?? undefined,
        platformFee:  body.platformFee  !== undefined ? body.platformFee : undefined,
        shippingFee:  body.shippingFee  !== undefined ? body.shippingFee : undefined,
        netAmount:    body.netAmount    !== undefined ? body.netAmount   : undefined,
        notes:        body.notes        ?? undefined,
      },
      include: {
        channel:    { select: { id: true, name: true } },
        salesOrder: { select: { id: true, orderNo: true } },
      },
    })

    return NextResponse.json(order)
  } catch (error) {
    return handleApiError(error, 'channel-orders.update')
  }
}
