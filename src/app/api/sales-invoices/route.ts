import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { invoiceScope, buildScopeContext } from '@/lib/scope'
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

  const scope = invoiceScope(buildScopeContext(session as { user: { id: string; role: string } }))

  const where = {
    ...scope,
    ...(search && {
      OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
        { customer: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status && { status: status as never }),
  }

  const [invoices, total] = await Promise.all([
    prisma.salesInvoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        salesPerson: { select: { id: true, name: true } },
        handler: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        sourceOrder: { select: { id: true, orderNo: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.salesInvoice.count({ where }),
  ])

  return NextResponse.json({
    data: invoices,
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

    if (!body.warehouseId) {
      return NextResponse.json({ error: '請選擇發貨倉庫' }, { status: 400 })
    }

    // Validate customer
    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
      select: { isActive: true, name: true },
    })
    if (!customer || !customer.isActive) {
      return NextResponse.json({ error: '客戶不存在或已停用' }, { status: 400 })
    }

    // Calculate amounts
    const TAX_RATE = 0.05
    const items = body.items.map((item: {
      productId: string; productName: string; specification?: string
      quantity: number; unitPrice: number; unit?: string; memo?: string; serialNumber?: string
    }) => {
      const qty = Number(item.quantity)
      const price = Number(item.unitPrice)
      const subtotal = qty * price
      const tax = Math.round(subtotal * TAX_RATE)
      const total = subtotal + tax
      const unitPriceTax = Math.round(price * (1 + TAX_RATE) * 100) / 100
      return {
        productId: item.productId,
        productName: item.productName,
        specification: item.specification || null,
        quantity: qty,
        unitPrice: price,
        unitPriceTax,
        subtotal,
        taxAmount: tax,
        totalAmount: total,
        unit: item.unit || null,
        memo: item.memo || null,
        serialNumber: item.serialNumber || null,
      }
    })

    const subtotal = items.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
    const taxAmount = items.reduce((s: number, i: { taxAmount: number }) => s + i.taxAmount, 0)
    const totalAmount = items.reduce((s: number, i: { totalAmount: number }) => s + i.totalAmount, 0)

    const invoiceNumber = await generateSequenceNo('SALES_INVOICE')

    const invoice = await prisma.salesInvoice.create({
      data: {
        invoiceNumber,
        date: body.date ? new Date(body.date) : new Date(),
        customerId: body.customerId,
        salesPersonId: body.salesPersonId || session.user.id,
        handlerId: body.handlerId || session.user.id,
        warehouseId: body.warehouseId,
        transactionType: body.transactionType ?? 'TAX',
        currency: body.currency ?? 'TWD',
        receiverName: body.receiverName || null,
        shippingAddress: body.shippingAddress || null,
        phone: body.phone || null,
        shippingNote: body.shippingNote || null,
        departmentId: body.departmentId || null,
        notes: body.notes || null,
        subtotal,
        taxAmount,
        totalAmount,
        status: 'DRAFT',
        approvalStatus: 'PENDING',
        sourceOrderId: body.sourceOrderId || null,
        createdById: session.user.id,
        items: { create: items },
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
      module: 'sales-invoices',
      action: 'CREATE',
      entityType: 'SalesInvoice',
      entityId: invoice.id,
      entityLabel: invoiceNumber,
    }).catch(() => {})

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'sales-invoices.POST')
  }
}
