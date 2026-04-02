import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'
import { buildScopeContext, canAccessQuotation } from '@/lib/scope'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: true,
      },
    })

    if (!quotation) return NextResponse.json({ error: '找不到報價單' }, { status: 404 })

    // 5-4: scope check — SALES/CS can only convert their own quotations
    const ctx = buildScopeContext(session as { user: { id: string; role: string } })
    if (!canAccessQuotation(ctx, quotation)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (quotation.status !== 'ACCEPTED') {
      return NextResponse.json({ error: '只有已接受的報價單可以轉換為訂單' }, { status: 400 })
    }

    // Validate customer is active
    const customer = await prisma.customer.findUnique({
      where: { id: quotation.customerId },
      select: { id: true, name: true, isActive: true, creditLimit: true },
    })
    if (!customer) return NextResponse.json({ error: '客戶不存在' }, { status: 400 })
    if (!customer.isActive) return NextResponse.json({ error: `客戶「${customer.name}」已停用` }, { status: 400 })

    // Credit limit check
    if (customer.creditLimit) {
      const outstandingAR = await prisma.accountsReceivable.aggregate({
        where: { customerId: customer.id, status: { in: ['NOT_DUE', 'DUE', 'PARTIAL_PAID'] } },
        _sum: { amount: true, paidAmount: true },
      })
      const outstanding = Number(outstandingAR._sum?.amount ?? 0) - Number(outstandingAR._sum?.paidAmount ?? 0)
      const orderAmount = Number(quotation.totalAmount ?? 0)
      if (outstanding + orderAmount > Number(customer.creditLimit)) {
        return NextResponse.json({
          error: `超過信用額度：已使用 ${outstanding.toLocaleString()}，本單 ${orderAmount.toLocaleString()}，額度 ${Number(customer.creditLimit).toLocaleString()}`,
        }, { status: 400 })
      }
    }

    // Inventory availability check
    const defaultWhForCheck = await prisma.warehouse.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { code: true } })
    const whCode = defaultWhForCheck?.code ?? 'MAIN'
    for (const item of quotation.items) {
      const inv = await prisma.inventory.findFirst({
        where: { productId: item.productId, warehouse: whCode, category: 'FINISHED_GOODS' },
        select: { availableQty: true },
      })
      if (!inv || Number(inv.availableQty) < Number(item.quantity)) {
        return NextResponse.json({ error: `商品庫存不足（ID: ${item.productId}，可用: ${inv?.availableQty ?? 0}，需求: ${item.quantity}）` }, { status: 400 })
      }
    }

    const orderNo = await generateSequenceNo('SALES_ORDER')

    // 3-8: Find default warehouse to attach to order
    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    const order = await prisma.salesOrder.create({
      data: {
        orderNo,
        customerId:  quotation.customerId,
        createdById: session.user.id,
        quotationId: quotation.id,
        subtotal:    quotation.totalAmount,
        totalAmount: quotation.totalAmount,
        currency:    quotation.currency,
        status:      'PENDING',
        notes:       quotation.notes,
        warehouseId: defaultWarehouse?.id ?? null,
        items: {
          create: quotation.items.map((item) => ({
            productId:       item.productId,
            productNameSnap: item.productNameSnap,
            skuSnap:         item.skuSnap,
            specSnap:        item.specSnap,
            quantity:        item.quantity,
            unitPrice:       item.unitPrice,
            discount:        item.discount,
            subtotal:        item.subtotal,
          })),
        },
      },
    })

    await prisma.quotation.update({
      where: { id },
      data: { status: 'CONVERTED' },
    })

    return NextResponse.json({ orderId: order.id, orderNo: order.orderNo })
  } catch (error) {
    return handleApiError(error, 'quotations.convert')
  }
}
