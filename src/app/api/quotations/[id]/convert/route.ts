import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: true,
      },
    })

    if (!quotation) return NextResponse.json({ error: '找不到報價單' }, { status: 404 })
    if (quotation.status !== 'ACCEPTED') {
      return NextResponse.json({ error: '只有已接受的報價單可以轉換為訂單' }, { status: 400 })
    }

    const orderNo = await generateSequenceNo('SALES_ORDER')

    const order = await prisma.salesOrder.create({
      data: {
        orderNo,
        customerId:  quotation.customerId,
        createdById: session.user.id,
        quotationId: quotation.id,
        subtotal:    quotation.totalAmount,
        totalAmount: quotation.totalAmount,
        currency:    quotation.currency,
        status:      'PENDING',
        notes:       quotation.notes,
        items: {
          create: quotation.items.map((item) => ({
            productId:       item.productId,
            productNameSnap: item.productNameSnap,
            skuSnap:         item.skuSnap,
            specSnap:        item.specSnap,
            quantity:        item.quantity,
            unitPrice:       item.unitPrice,
            discount:        item.discount,
            subtotal:        item.subtotal,
          })),
        },
      },
    })

    await prisma.quotation.update({
      where: { id },
      data: { status: 'CONVERTED' },
    })

    return NextResponse.json({ orderId: order.id, orderNo: order.orderNo })
  } catch (error) {
    return handleApiError(error, 'quotations.convert')
  }
}
