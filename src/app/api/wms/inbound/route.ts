import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

  const where = {
    ...(search && {
      OR: [
        { inboundNumber: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(status && { status: status as never }),
  }

  const [inbounds, total] = await Promise.all([
    prisma.wmsInbound.findMany({
      where,
      include: {
        items: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.wmsInbound.count({ where }),
  ])

  return NextResponse.json({
    data: inbounds,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.type || !body.items?.length) {
      return NextResponse.json({ error: '請填寫入庫類型並至少新增一項品項' }, { status: 400 })
    }

    const inboundNumber = await generateSequenceNo('WMS_INBOUND')

    const inbound = await prisma.wmsInbound.create({
      data: {
        inboundNumber,
        type: body.type,
        sourceId: body.sourceId || null,
        handlerId: body.handlerId || session.user.id,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        status: 'EXPECTED',
        notes: body.notes || null,
        createdById: session.user.id,
        items: {
          create: body.items.map((item: {
            productId: string; quantity: number; locationId?: string
          }) => ({
            productId: item.productId,
            quantity: item.quantity,
            receivedQty: 0,
            locationId: item.locationId || null,
          })),
        },
      },
      include: { items: true },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'wms',
      action: 'CREATE',
      entityType: 'WmsInbound',
      entityId: inbound.id,
      entityLabel: inboundNumber,
    }).catch(() => {})

    return NextResponse.json(inbound, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'wms.inbound.POST')
  }
}
