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
  const zoneId = searchParams.get('zoneId') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

  const where = {
    ...(zoneId && { zoneId }),
    ...(search && {
      OR: [
        { code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [locations, total] = await Promise.all([
    prisma.wmsLocation.findMany({
      where,
      include: {
        zone: {
          select: { id: true, code: true, name: true, warehouse: { select: { id: true, name: true } } },
        },
        _count: { select: { inventory: true } },
      },
      orderBy: { code: 'asc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.wmsLocation.count({ where }),
  ])

  return NextResponse.json({
    data: locations,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.zoneId || !body.code) {
      return NextResponse.json({ error: '請填寫區域和儲位編號' }, { status: 400 })
    }

    const location = await prisma.wmsLocation.create({
      data: {
        zoneId: body.zoneId,
        code: body.code,
        name: body.name || null,
      },
      include: {
        zone: { select: { id: true, code: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'wms',
      action: 'CREATE',
      entityType: 'WmsLocation',
      entityId: location.id,
      entityLabel: location.code,
    }).catch(() => {})

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'wms.locations.POST')
  }
}
