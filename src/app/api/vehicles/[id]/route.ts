import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/vehicles/[id] — 更新車輛資料
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      plateNo: body.plateNo ?? undefined,
      vehicleType: body.vehicleType ?? undefined,
      brand: body.brand ?? undefined,
      model: body.model ?? undefined,
      year: body.year !== undefined ? Number(body.year) : undefined,
      maxWeight: body.maxWeight !== undefined ? Number(body.maxWeight) : undefined,
      owner: body.owner ?? undefined,
      fuelType: body.fuelType ?? undefined,
      currentOdometer: body.currentOdometer !== undefined ? Number(body.currentOdometer) : undefined,
      insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : undefined,
      inspectionExpiry: body.inspectionExpiry ? new Date(body.inspectionExpiry) : undefined,
      licenseTaxExpiry: body.licenseTaxExpiry ? new Date(body.licenseTaxExpiry) : undefined,
      fuelTaxExpiry: body.fuelTaxExpiry ? new Date(body.fuelTaxExpiry) : undefined,
      notes: body.notes ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  })

  return NextResponse.json(vehicle)
}
