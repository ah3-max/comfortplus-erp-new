import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { orderScope, buildScopeContext } from '@/lib/scope'
import { checkKpiMilestone } from '@/lib/kpi-check'
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

  // Data scope: SALES/CS only see their own orders
  const scope = orderScope(buildScopeContext(session as { user: { id: string; role: string } }))

  const where = {
    ...scope,
    ...(search && {
      OR: [
        { orderNo: { contains: search, mode: 'insensitive' as const } },
        { customer: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status && { status: status as never }),
  }

  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
        _count: { select: { shipments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.salesOrder.count({ where }),
  ])

  return NextResponse.json({
    data: orders,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
  const body = await req.json()

  if (!body.customerId || !body.items?.length) {
    return NextResponse.json({ error: '請選擇客戶並至少新增一項商品' }, { status: 400 })
  }

  // ── Validation: customer active + credit check ──
  const customer = await prisma.customer.findUnique({
    where: { id: body.customerId },
    select: { isActive: true, creditLimit: true, name: true },
  })
  if (!customer || !customer.isActive) {
    return NextResponse.json({ error: '客戶不存在或已停用' }, { status: 400 })
  }

  const totalAmount = body.items.reduce(
    (sum: number, item: { quantity: number; unitPrice: number; discount: number }) =>
      sum + item.quantity * item.unitPrice * (1 - item.discount / 100),
    0
  )

  // Credit limit check
  if (customer.creditLimit) {
    const unpaid = await prisma.salesOrder.aggregate({
      where: { customerId: body.customerId, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      _sum: { totalAmount: true },
    })
    const currentDebt = Number(unpaid._sum.totalAmount ?? 0)
    if (currentDebt + totalAmount > Number(customer.creditLimit)) {
      return NextResponse.json({
        error: `${customer.name} 已超過信用額度（額度 ${Number(customer.creditLimit).toLocaleString()}，目前未收 ${currentDebt.toLocaleString()}，此單 ${totalAmount.toLocaleString()}）`,
      }, { status: 400 })
    }
  }

  // ── Validation: inventory availability ──
  for (const item of body.items as { productId: string; quantity: number }[]) {
    const inv = await prisma.inventory.findFirst({
      where: { productId: item.productId, category: 'FINISHED_GOODS' },
    })
    const available = inv ? inv.availableQty : 0
    if (available < item.quantity) {
      const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { name: true } })
      return NextResponse.json({
        error: `「${product?.name ?? item.productId}」庫存不足（可用 ${available}，需求 ${item.quantity}）`,
      }, { status: 400 })
    }
  }

  const orderNo = await generateSequenceNo('SALES_ORDER')

  const order = await prisma.salesOrder.create({
    data: {
      orderNo,
      customerId: body.customerId,
      quotationId: body.quotationId || null,
      createdById: session.user.id,
      status: 'PENDING',
      orderType:             body.orderType   ?? 'B2B',
      orderSource:           body.orderSource ?? 'SALES_INPUT',
      requestedDeliveryDate: body.requestedDeliveryDate ? new Date(body.requestedDeliveryDate) : body.expectedShipDate ? new Date(body.expectedShipDate) : null,
      currency:              body.currency    ?? 'TWD',
      subtotal:              totalAmount,
      discountAmount:        body.discountAmount ? Number(body.discountAmount) : 0,
      shippingFee:           body.shippingFee    ? Number(body.shippingFee)    : 0,
      taxAmount:             body.taxAmount      ? Number(body.taxAmount)      : 0,
      totalAmount,
      notes: body.notes || null,
      items: {
        create: body.items.map((item: {
          productId: string
          quantity: number
          unitPrice: number
          discount: number
        }) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount ?? 0,
          subtotal: item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100),
        })),
      },
    },
    include: {
      customer: { select: { name: true } },
      items: true,
    },
  })

  // Auto-update customer lastOrderDate + lastContactDate
  prisma.customer.update({
    where: { id: body.customerId },
    data: { lastOrderDate: new Date(), lastContactDate: new Date() },
  }).catch(console.error)

  // KPI milestone check (async, non-blocking)
  checkKpiMilestone(session.user.id).catch(console.error)

  // Audit log
  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? '',
    userRole: (session.user as { role?: string }).role ?? '',
    module: 'orders',
    action: 'CREATE',
    entityType: 'SalesOrder',
    entityId: order.id,
    entityLabel: orderNo,
  }).catch(() => {})

  return NextResponse.json(order, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'orders.POST')
  }
}
