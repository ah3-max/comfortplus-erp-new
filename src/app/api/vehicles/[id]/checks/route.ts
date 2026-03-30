import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/vehicles/[id]/checks — 定期檢查記錄
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const records = await prisma.vehicleCheckRecord.findMany({
      where: { vehicleId: id },
      orderBy: { checkDate: 'desc' },
      take: 24,
    })

    return NextResponse.json(records)
  } catch (error) {
    return handleApiError(error, 'vehicles.checks.list')
  }
}

// POST /api/vehicles/[id]/checks — 新增定期檢查
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    if (!body.checkItems || !Array.isArray(body.checkItems) || body.checkItems.length === 0) {
      return NextResponse.json({ error: '請至少填寫一項檢查項目' }, { status: 400 })
    }

    const record = await prisma.vehicleCheckRecord.create({
      data: {
        vehicleId: id,
        checkDate: body.checkDate ? new Date(body.checkDate) : new Date(),
        checkType: body.checkType ?? 'MONTHLY',
        checkItems: body.checkItems,
        overallResult: body.overallResult ?? 'PASS',
        notes: body.notes ?? null,
        photoUrls: body.photoUrls ?? null,
        checkedById: session.user.id,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'vehicles.checks.create')
  }
}
