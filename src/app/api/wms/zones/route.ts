import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const warehouseId = searchParams.get('warehouseId') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

  const where = {
    ...(warehouseId && { warehouseId }),
    ...(search && {
      OR: [
        { code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [zones, total] = await Promise.all([
    prisma.wmsZone.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        locations: {
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.wmsZone.count({ where }),
  ])

  return NextResponse.json({
    data: zones,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.warehouseId || !body.code || !body.name) {
      return NextResponse.json({ error: '請填寫倉庫、區域編碼和名稱' }, { status: 400 })
    }

    const zone = await prisma.wmsZone.create({
      data: {
        warehouseId: body.warehouseId,
        code: body.code,
        name: body.name,
      },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        locations: true,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'wms',
      action: 'CREATE',
      entityType: 'WmsZone',
      entityId: zone.id,
      entityLabel: `${zone.code} - ${zone.name}`,
    }).catch(() => {})

    return NextResponse.json(zone, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'wms.zones.POST')
  }
}
