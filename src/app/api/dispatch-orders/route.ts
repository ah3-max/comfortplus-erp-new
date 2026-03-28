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
        { dispatchNumber: { contains: search, mode: 'insensitive' as const } },
        { customer: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status && { status: status as never }),
  }

  const [dispatchOrders, total] = await Promise.all([
    prisma.dispatchOrder.findMany({
      where,
      include: {
        pickingOrder: { select: { id: true, pickingNumber: true, status: true } },
        customer: { select: { id: true, name: true, code: true } },
        handler: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.dispatchOrder.count({ where }),
  ])

  return NextResponse.json({
    data: dispatchOrders,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.pickingOrderId) {
      return NextResponse.json({ error: '請選擇來源理貨單' }, { status: 400 })
    }

    // Validate picking order exists and is PICKED
    const pickingOrder = await prisma.pickingOrder.findUnique({
      where: { id: body.pickingOrderId },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        dispatchOrder: { select: { id: true } },
      },
    })
    if (!pickingOrder) {
      return NextResponse.json({ error: '理貨單不存在' }, { status: 400 })
    }
    if (pickingOrder.status !== 'PICKED') {
      return NextResponse.json({ error: '只能從已完成的理貨單建立派貨單' }, { status: 400 })
    }
    if (pickingOrder.dispatchOrder) {
      return NextResponse.json({ error: '此理貨單已有對應派貨單' }, { status: 400 })
    }

    const dispatchNumber = await generateSequenceNo('DISPATCH_ORDER')

    const dispatchOrder = await prisma.dispatchOrder.create({
      data: {
        dispatchNumber,
        date: body.date ? new Date(body.date) : new Date(),
        pickingOrderId: body.pickingOrderId,
        customerId: body.customerId || pickingOrder.customerId,
        handlerId: body.handlerId || session.user.id,
        warehouseId: body.warehouseId || pickingOrder.warehouseId,
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
        contactInfo: body.contactInfo || null,
        shippingAddress: body.shippingAddress || null,
        status: 'PENDING',
        createdById: session.user.id,
        items: {
          create: (body.items && body.items.length > 0)
            ? body.items.map((item: {
                productId: string; productName: string; specification?: string
                quantity: number; memo?: string
              }) => ({
                productId: item.productId,
                productName: item.productName,
                specification: item.specification || null,
                quantity: item.quantity,
                memo: item.memo || null,
              }))
            : pickingOrder.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                specification: item.specification || null,
                quantity: Number(item.pickedQuantity) > 0 ? Number(item.pickedQuantity) : Number(item.quantity),
                memo: item.memo || null,
              })),
        },
      },
      include: {
        customer: { select: { name: true } },
        items: true,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'dispatch-orders',
      action: 'CREATE',
      entityType: 'DispatchOrder',
      entityId: dispatchOrder.id,
      entityLabel: dispatchNumber,
    }).catch(() => {})

    return NextResponse.json(dispatchOrder, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'dispatch-orders.POST')
  }
}
