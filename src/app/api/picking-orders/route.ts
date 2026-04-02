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
        { pickingNumber: { contains: search, mode: 'insensitive' as const } },
        { customer: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status && { status: status.includes(',') ? { in: status.split(',') } as never : status as never }),
  }

  const [pickingOrders, total] = await Promise.all([
    prisma.pickingOrder.findMany({
      where,
      include: {
        salesInvoice: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true, code: true } },
        handler: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
        dispatchOrder: { select: { id: true, dispatchNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.pickingOrder.count({ where }),
  ])

  return NextResponse.json({
    data: pickingOrders,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.salesInvoiceId) {
      return NextResponse.json({ error: '請選擇來源銷貨單' }, { status: 400 })
    }

    // Validate sales invoice exists and is CONFIRMED
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: body.salesInvoiceId },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        customer: { select: { id: true } },
      },
    })
    if (!invoice) {
      return NextResponse.json({ error: '銷貨單不存在' }, { status: 400 })
    }
    if (invoice.status !== 'CONFIRMED') {
      return NextResponse.json({ error: '只能從已確認的銷貨單建立理貨單' }, { status: 400 })
    }

    const pickingNumber = await generateSequenceNo('PICKING_ORDER')

    const pickingOrder = await prisma.pickingOrder.create({
      data: {
        pickingNumber,
        date: body.date ? new Date(body.date) : new Date(),
        salesInvoiceId: body.salesInvoiceId,
        customerId: body.customerId || invoice.customerId,
        handlerId: body.handlerId || session.user.id,
        warehouseId: body.warehouseId,
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
                pickedQuantity: 0,
                memo: item.memo || null,
              }))
            : invoice.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                specification: item.specification || null,
                quantity: Number(item.quantity),
                pickedQuantity: 0,
                memo: null,
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
      module: 'picking-orders',
      action: 'CREATE',
      entityType: 'PickingOrder',
      entityId: pickingOrder.id,
      entityLabel: pickingNumber,
    }).catch(() => {})

    return NextResponse.json(pickingOrder, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'picking-orders.POST')
  }
}
