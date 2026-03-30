import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status    = searchParams.get('status')    ?? ''
  const factoryId = searchParams.get('factoryId') ?? ''
  const poId      = searchParams.get('purchaseOrderId') ?? ''

  const orders = await prisma.productionOrder.findMany({
    where: {
      ...(status    && { status: status as never }),
      ...(factoryId && { factoryId }),
      ...(poId      && { purchaseOrderId: poId }),
    },
    include: {
      factory:       { select: { id: true, code: true, name: true } },
      purchaseOrder: { select: { id: true, poNo: true, orderType: true, totalAmount: true } },
      seaFreights:   { select: { id: true, freightNo: true, status: true, eta: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orders)
  } catch (error) { return handleApiError(error, 'production.list') }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.purchaseOrderId || !body.factoryId || !body.orderQty) {
    return NextResponse.json({ error: '請填寫採購單、工廠與訂購數量' }, { status: 400 })
  }

  const productionNo = await generateSequenceNo('PRODUCTION')

  const order = await prisma.productionOrder.create({
    data: {
      productionNo,
      purchaseOrderId:    body.purchaseOrderId,
      factoryId:          body.factoryId,
      orderQty:           body.orderQty,
      sampleSubmitDate:   body.sampleSubmitDate   ? new Date(body.sampleSubmitDate) : null,
      notes:              body.notes || null,
    },
    include: {
      factory:       { select: { id: true, code: true, name: true } },
      purchaseOrder: { select: { id: true, poNo: true } },
    },
  })

  return NextResponse.json(order, { status: 201 })
  } catch (error) { return handleApiError(error, 'production.create') }
}
