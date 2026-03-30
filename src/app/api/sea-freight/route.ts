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
  const status = searchParams.get('status') ?? ''
  const active = searchParams.get('active') === 'true'

  const freights = await prisma.seaFreight.findMany({
    where: {
      ...(status && { status: status as never }),
      ...(active && { status: { notIn: ['RECEIVED', 'CANCELLED'] } }),
    },
    include: {
      productionOrder: { select: { id: true, productionNo: true, factory: { select: { name: true } } } },
      purchaseOrder:   { select: { id: true, poNo: true, supplier: { select: { name: true } } } },
    },
    orderBy: [{ eta: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(freights)
  } catch (error) {
    return handleApiError(error, 'seaFreight.get')
  }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const freightNo = await generateSequenceNo('FREIGHT')

  const freight = await prisma.seaFreight.create({
    data: {
      freightNo,
      productionOrderId: body.productionOrderId || null,
      purchaseOrderId:   body.purchaseOrderId   || null,
      containerNo:       body.containerNo       || null,
      vesselName:        body.vesselName        || null,
      voyageNo:          body.voyageNo          || null,
      bookingNo:         body.bookingNo         || null,
      blNo:              body.blNo              || null,
      portOfLoading:     body.portOfLoading     || null,
      portOfDischarge:   body.portOfDischarge   || null,
      etd:               body.etd  ? new Date(body.etd) : null,
      eta:               body.eta  ? new Date(body.eta) : null,
      palletCount:       body.palletCount ? Number(body.palletCount) : null,
      boxCount:          body.boxCount    ? Number(body.boxCount)    : null,
      weight:            body.weight      ? Number(body.weight)      : null,
      volume:            body.volume      || null,
      oceanFreight:       body.oceanFreight ? Number(body.oceanFreight) : null,
      notes:             body.notes       || null,
    },
    include: {
      productionOrder: { select: { id: true, productionNo: true } },
      purchaseOrder:   { select: { id: true, poNo: true } },
    },
  })

  return NextResponse.json(freight, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'seaFreight.post')
  }
}
