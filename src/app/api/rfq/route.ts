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
        { rfqNumber: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(status && { status: status as never }),
  }

  const [rfqs, total] = await Promise.all([
    prisma.requestForQuotation.findMany({
      where,
      include: {
        items: {
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        },
        suppliers: {
          include: { supplier: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.requestForQuotation.count({ where }),
  ])

  return NextResponse.json({
    data: rfqs,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.items?.length) {
      return NextResponse.json({ error: '請至少新增一項詢價品項' }, { status: 400 })
    }

    const rfqNumber = await generateSequenceNo('RFQ')

    const rfq = await prisma.requestForQuotation.create({
      data: {
        rfqNumber,
        handlerId: body.handlerId || session.user.id,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        notes: body.notes || null,
        createdById: session.user.id,
        items: {
          create: body.items.map((item: {
            productId: string
            quantity: number
            specification?: string
          }) => ({
            productId: item.productId,
            quantity: item.quantity,
            specification: item.specification || null,
          })),
        },
        suppliers: body.supplierIds?.length
          ? {
              create: (body.supplierIds as string[]).map((supplierId: string) => ({
                supplierId,
              })),
            }
          : undefined,
      },
      include: {
        items: {
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        },
        suppliers: {
          include: { supplier: { select: { id: true, name: true, code: true } } },
        },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'rfq',
      action: 'CREATE',
      entityType: 'RequestForQuotation',
      entityId: rfq.id,
      entityLabel: rfqNumber,
    }).catch(() => {})

    return NextResponse.json(rfq, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'rfq.POST')
  }
}
