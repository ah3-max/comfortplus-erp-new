import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/vehicles/[id]/maintenance — 保養紀錄
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const records = await prisma.vehicleMaintenance.findMany({
      where: { vehicleId: id },
      orderBy: { serviceDate: 'desc' },
    })

    return NextResponse.json(records)
  } catch (error) {
    return handleApiError(error, 'vehicles.maintenance.list')
  }
}

// POST /api/vehicles/[id]/maintenance — 新增保養紀錄
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const record = await prisma.vehicleMaintenance.create({
      data: {
        vehicleId: id,
        type: body.type,
        title: body.title,
        serviceDate: new Date(body.serviceDate),
        nextServiceDate: body.nextServiceDate ? new Date(body.nextServiceDate) : null,
        nextServiceKm: body.nextServiceKm ? Number(body.nextServiceKm) : null,
        cost: body.cost ? Number(body.cost) : null,
        vendor: body.vendor ?? null,
        invoiceNo: body.invoiceNo ?? null,
        odometerAtService: body.odometerAtService ? Number(body.odometerAtService) : null,
        items: body.items ?? null,
        notes: body.notes ?? null,
        photoUrls: body.photoUrls ?? null,
        createdById: session.user.id,
      },
    })

    // 更新車輛里程
    if (body.odometerAtService) {
      await prisma.vehicle.update({
        where: { id },
        data: { currentOdometer: Number(body.odometerAtService) },
      })
    }

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'vehicles.maintenance.create')
  }
}
