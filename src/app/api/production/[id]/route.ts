import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const order = await prisma.productionOrder.findUnique({
    where: { id },
    include: {
      factory:       { select: { id: true, code: true, name: true, phone: true, contactPerson: true } },
      purchaseOrder: { select: { id: true, poNo: true, orderType: true, totalAmount: true, status: true, items: { include: { product: { select: { sku: true, name: true } } } } } },
      seaFreights:   true,
    },
  })
  if (!order) return NextResponse.json({ error: '找不到生產單' }, { status: 404 })
  return NextResponse.json(order)
  } catch (error) { return handleApiError(error, 'production.get') }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const order = await prisma.productionOrder.update({
    where: { id },
    data: {
      status:              body.status              ?? undefined,
      producedQty:         body.producedQty         !== undefined ? body.producedQty : undefined,
      passedQty:           body.passedQty           !== undefined ? body.passedQty   : undefined,
      defectQty:           body.defectQty           !== undefined ? body.defectQty   : undefined,
      defectRate:          body.defectRate           !== undefined ? body.defectRate  : undefined,
      sampleSubmitDate:    body.sampleSubmitDate    ? new Date(body.sampleSubmitDate)    : undefined,
      sampleApproveDate:   body.sampleApproveDate   ? new Date(body.sampleApproveDate)   : undefined,
      productionStartDate: body.productionStartDate ? new Date(body.productionStartDate) : undefined,
      productionEndDate:   body.productionEndDate   ? new Date(body.productionEndDate)   : undefined,
      inspectionDate:      body.inspectionDate      ? new Date(body.inspectionDate)      : undefined,
      shipmentDate:        body.shipmentDate        ? new Date(body.shipmentDate)        : undefined,
      notes:               body.notes               ?? undefined,
    },
    include: {
      factory:       { select: { id: true, code: true, name: true } },
      purchaseOrder: { select: { id: true, poNo: true } },
      seaFreights:   { select: { id: true, freightNo: true, status: true } },
    },
  })

  return NextResponse.json(order)
  } catch (error) { return handleApiError(error, 'production.update') }
}
