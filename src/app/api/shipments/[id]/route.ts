import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          customer: true,
          items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
        },
      },
      logisticsProvider: true,
      trip:              true,
      createdBy:         { select: { name: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true, weight: true } } },
      },
    },
  })

  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(shipment)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const now = new Date()

  const shipment = await prisma.shipment.update({
    where: { id },
    data: {
      ...(body.status              && { status: body.status }),
      ...(body.trackingNo          !== undefined && { trackingNo: body.trackingNo || null }),
      ...(body.carrier             !== undefined && { carrier: body.carrier || null }),
      ...(body.logisticsProviderId !== undefined && { logisticsProviderId: body.logisticsProviderId || null }),
      ...(body.deliveryMethod      && { deliveryMethod: body.deliveryMethod }),
      ...(body.palletCount         !== undefined && { palletCount: body.palletCount != null ? Number(body.palletCount) : null }),
      ...(body.boxCount            !== undefined && { boxCount: body.boxCount != null ? Number(body.boxCount) : null }),
      ...(body.weight              !== undefined && { weight: body.weight != null ? Number(body.weight) : null }),
      ...(body.volume              !== undefined && { volume: body.volume || null }),
      ...(body.expectedDeliveryDate !== undefined && {
        expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null,
      }),
      ...(body.signStatus   && { signStatus: body.signStatus }),
      ...(body.anomalyStatus && { anomalyStatus: body.anomalyStatus }),
      ...(body.anomalyNote  !== undefined && { anomalyNote: body.anomalyNote || null }),
      ...(body.notes        !== undefined && { notes: body.notes || null }),
      // Auto-set timestamps on status transitions
      ...(body.status === 'SHIPPED'   && { shipDate: body.shipDate ? new Date(body.shipDate) : now }),
      ...(body.status === 'DELIVERED' && { deliveryDate: now, signStatus: 'SIGNED' as never }),
      // Manual sign/delivery date override
      ...(body.deliveryDate && { deliveryDate: new Date(body.deliveryDate) }),
    },
    include: {
      logisticsProvider: { select: { name: true, code: true } },
      trip:              { select: { tripNo: true } },
    },
  })

  // 若標記已送達，同步更新訂單狀態
  if (body.status === 'DELIVERED') {
    const allShipments = await prisma.shipment.findMany({
      where: { orderId: shipment.orderId },
    })
    if (allShipments.every(s => s.status === 'DELIVERED')) {
      await prisma.salesOrder.update({
        where: { id: shipment.orderId },
        data: { status: 'SIGNED' },
      })
    }
  }

  return NextResponse.json(shipment)
}
