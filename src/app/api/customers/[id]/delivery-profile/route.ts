import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/customers/[id]/delivery-profile
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: customerId } = await params
    const profile = await prisma.customerDeliveryProfile.findUnique({ where: { customerId } })
    return NextResponse.json(profile ?? null)
  } catch (error) {
    return handleApiError(error, 'customers.deliveryProfile.get')
  }
}

// PUT /api/customers/[id]/delivery-profile — upsert
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: customerId } = await params
    const body = await req.json()

    const str  = (v: unknown) => (v !== undefined && v !== '' ? String(v) : null)
    const num  = (v: unknown) => (v !== undefined && v !== '' && v !== null ? Number(v) : null)
    const bool = (v: unknown) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null)

    const data = {
      deliveryAddress:       str(body.deliveryAddress),
      unloadingLocation:     str(body.unloadingLocation),
      unloadingFloor:        num(body.unloadingFloor),
      hasElevator:           bool(body.hasElevator),
      needsCart:             bool(body.needsCart),
      hasReception:          bool(body.hasReception),
      receivingHours:        str(body.receivingHours),
      suggestedDeliveryTime: str(body.suggestedDeliveryTime),
      parkingNotes:          str(body.parkingNotes),
      parkingSpot:           str(body.parkingSpot),
      parkingFee:            str(body.parkingFee),
      elevatorDimensions:    str(body.elevatorDimensions),
      elevatorMaxWeight:     num(body.elevatorMaxWeight),
      elevatorNotes:         str(body.elevatorNotes),
      routeNotes:            str(body.routeNotes),
      driverNotes:           str(body.driverNotes),
      receiverName:          str(body.receiverName),
      receiverPhone:         str(body.receiverPhone),
      deliveryNotes:         str(body.deliveryNotes),
      photoUrls:             Array.isArray(body.photoUrls) ? body.photoUrls : null,
      createdById:           (session.user as { id?: string })?.id ?? null,
    }

    const profile = await prisma.customerDeliveryProfile.upsert({
      where:  { customerId },
      create: { id: crypto.randomUUID(), customerId, ...data },
      update: data,
    })

    return NextResponse.json(profile)
  } catch (error) {
    return handleApiError(error, 'customers.deliveryProfile.upsert')
  }
}
