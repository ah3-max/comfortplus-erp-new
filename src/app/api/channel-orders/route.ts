import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channelId') ?? ''
  const status    = searchParams.get('status')    ?? ''

  const orders = await prisma.channelOrder.findMany({
    where: {
      ...(channelId && { channelId }),
      ...(status    && { status: status as never }),
    },
    include: {
      channel:    { select: { id: true, code: true, name: true, platform: true } },
      salesOrder: { select: { id: true, orderNo: true, status: true } },
      items:      { include: { product: { select: { sku: true, name: true, unit: true } } } },
    },
    orderBy: { orderedAt: 'desc' },
  })

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.channelId || !body.channelOrderNo || !body.items?.length) {
    return NextResponse.json({ error: '請填寫通路、平台訂單號與品項' }, { status: 400 })
  }

  const totalAmount = (body.items as { quantity: number; unitPrice: number }[])
    .reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  const order = await prisma.channelOrder.create({
    data: {
      channelId:      body.channelId,
      channelOrderNo: body.channelOrderNo,
      buyerName:      body.buyerName    || null,
      buyerPhone:     body.buyerPhone   || null,
      buyerAddress:   body.buyerAddress || null,
      orderAmount:    totalAmount,
      platformFee:    body.platformFee  ? Number(body.platformFee) : null,
      shippingFee:    body.shippingFee  ? Number(body.shippingFee) : null,
      netAmount:      body.netAmount    ? Number(body.netAmount)   : null,
      orderedAt:      body.orderedAt    ? new Date(body.orderedAt) : new Date(),
      notes:          body.notes        || null,
      items: {
        create: (body.items as { productId: string; quantity: number; unitPrice: number }[])
          .map(i => ({
            productId: i.productId,
            quantity:  i.quantity,
            unitPrice: i.unitPrice,
            subtotal:  i.quantity * i.unitPrice,
          })),
      },
    },
    include: {
      channel: { select: { id: true, name: true } },
      items:   { include: { product: { select: { sku: true, name: true } } } },
    },
  })

  return NextResponse.json(order, { status: 201 })
}
