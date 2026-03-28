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
        { requestNumber: { contains: search, mode: 'insensitive' as const } },
        { handler: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status && { status: status as never }),
  }

  const [requests, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      include: {
        handler: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.purchaseRequest.count({ where }),
  ])

  return NextResponse.json({
    data: requests,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.handlerId || !body.warehouseId || !body.items?.length) {
      return NextResponse.json({ error: '請填寫承辦人、倉庫並至少新增一項品項' }, { status: 400 })
    }

    const requestNumber = await generateSequenceNo('PURCHASE_REQUEST')

    const request = await prisma.purchaseRequest.create({
      data: {
        requestNumber,
        handlerId: body.handlerId,
        warehouseId: body.warehouseId,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        currency: body.currency ?? 'TWD',
        reference: body.reference || null,
        notes: body.notes || null,
        createdById: session.user.id,
        items: {
          create: body.items.map((item: {
            productId: string
            quantity: number
            unitPrice?: number
            specification?: string
            memo?: string
          }) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
            specification: item.specification || null,
            subtotal: item.unitPrice ? item.quantity * Number(item.unitPrice) : null,
            memo: item.memo || null,
          })),
        },
      },
      include: {
        handler: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'purchase-requests',
      action: 'CREATE',
      entityType: 'PurchaseRequest',
      entityId: request.id,
      entityLabel: requestNumber,
    }).catch(() => {})

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'purchase-requests.POST')
  }
}
