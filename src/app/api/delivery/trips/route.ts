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
  const status    = searchParams.get('status') ?? ''
  const dateFrom  = searchParams.get('dateFrom') ?? ''
  const dateTo    = searchParams.get('dateTo')   ?? ''

  const trips = await prisma.deliveryTrip.findMany({
    where: {
      ...(status   && { status: status as never }),
      ...(dateFrom && { tripDate: { gte: new Date(dateFrom) } }),
      ...(dateTo   && { tripDate: { lte: new Date(dateTo + 'T23:59:59') } }),
    },
    include: {
      shipments: {
        include: {
          order: { include: { customer: { select: { name: true, code: true } } } },
          items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
        },
      },
      _count: { select: { shipments: true } },
    },
    orderBy: { tripDate: 'desc' },
  })

  return NextResponse.json(trips)
  } catch (error) { return handleApiError(error, 'delivery.trips.list') }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.tripDate) return NextResponse.json({ error: '請填寫出車日期' }, { status: 400 })

  const tripNo = await generateSequenceNo('TRIP')

  const trip = await prisma.deliveryTrip.create({
    data: {
      tripNo,
      vehicleNo:   body.vehicleNo   || null,
      driverName:  body.driverName  || null,
      driverPhone: body.driverPhone || null,
      region:      body.region      || null,
      tripDate:    new Date(body.tripDate),
      notes:       body.notes       || null,
    },
  })

  return NextResponse.json(trip, { status: 201 })
  } catch (error) { return handleApiError(error, 'delivery.trips.create') }
}
