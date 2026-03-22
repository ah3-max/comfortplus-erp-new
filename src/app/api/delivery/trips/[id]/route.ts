import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await prisma.deliveryTrip.findUnique({
    where: { id },
    include: {
      shipments: {
        include: {
          order: { include: { customer: { select: { name: true, code: true, address: true } } } },
          logisticsProvider: { select: { name: true, code: true } },
          items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
        },
      },
    },
  })

  if (!trip) return NextResponse.json({ error: '找不到車次' }, { status: 404 })
  return NextResponse.json(trip)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // action: addShipment / removeShipment / updateStatus
  if (body.action === 'addShipment') {
    const shipment = await prisma.shipment.update({
      where: { id: body.shipmentId },
      data: { tripId: id },
    })
    return NextResponse.json(shipment)
  }

  if (body.action === 'removeShipment') {
    const shipment = await prisma.shipment.update({
      where: { id: body.shipmentId },
      data: { tripId: null },
    })
    return NextResponse.json(shipment)
  }

  if (body.action === 'depart') {
    const trip = await prisma.deliveryTrip.update({
      where: { id },
      data: { status: 'DEPARTED' },
    })
    // Mark all assigned shipments as SHIPPED
    await prisma.shipment.updateMany({
      where: { tripId: id, status: { in: ['PREPARING', 'PACKED'] } },
      data: { status: 'SHIPPED', shipDate: new Date() },
    })
    return NextResponse.json(trip)
  }

  if (body.action === 'complete') {
    const trip = await prisma.deliveryTrip.update({
      where: { id },
      data: { status: 'COMPLETED' },
    })
    return NextResponse.json(trip)
  }

  if (body.action === 'cancel') {
    const trip = await prisma.deliveryTrip.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
    // Remove trip link from shipments
    await prisma.shipment.updateMany({
      where: { tripId: id },
      data: { tripId: null },
    })
    return NextResponse.json(trip)
  }

  // General update
  const trip = await prisma.deliveryTrip.update({
    where: { id },
    data: {
      vehicleNo:   body.vehicleNo   ?? undefined,
      driverName:  body.driverName  ?? undefined,
      driverPhone: body.driverPhone ?? undefined,
      region:      body.region      ?? undefined,
      tripDate:    body.tripDate    ? new Date(body.tripDate) : undefined,
      status:      body.status      ?? undefined,
      notes:       body.notes       ?? undefined,
    },
  })

  return NextResponse.json(trip)
}
