import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessOrder, buildScopeContext } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { notifyByRole } from '@/lib/notify'
import { generateSequenceNo } from '@/lib/sequence'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true } },
      quotation: { select: { quotationNo: true } },
      items: {
        include: {
          product: { select: { sku: true, name: true, unit: true, sellingPrice: true } },
        },
      },
      shipments: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Data scope check: SALES/CS can only view their own orders
  const ctx = buildScopeContext(session as { user: { id: string; role: string } })
  if (!canAccessOrder(ctx, order)) {
    return NextResponse.json({ error: '無權限查看此訂單' }, { status: 403 })
  }

  return NextResponse.json(order)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {

  const { id } = await params
  const body = await req.json()

  // 僅更新狀態 + 自動庫存處理
  if (body.statusOnly) {
    const currentOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { name: true, sku: true, unit: true, sellingPrice: true } } } },
        customer: { select: { name: true } },
      },
    })
    if (!currentOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const oldStatus = currentOrder.status
    const newStatus = body.status as string

    const order = await prisma.$transaction(async (tx) => {
      /*
       * 並發安全：使用 SELECT ... FOR UPDATE 行級鎖
       * 防止兩個業務同時確認訂單搶同一商品庫存
       * 第一個 transaction 拿到鎖後，第二個會等待直到第一個 commit
       */

      // CONFIRMED → 預留庫存（行級鎖）
      if (newStatus === 'CONFIRMED' && ['DRAFT', 'PENDING'].includes(oldStatus)) {
        for (const item of currentOrder.items) {
          // 行級鎖：鎖住這筆庫存記錄直到 transaction 結束
          const rows = await tx.$queryRaw<Array<{ id: string; availableQty: number }>>`
            SELECT id, "availableQty" FROM "Inventory"
            WHERE "productId" = ${item.productId}
              AND warehouse = 'MAIN'
              AND category = 'FINISHED_GOODS'
            FOR UPDATE
          `
          const inv = rows[0]
          if (inv) {
            // 再次檢查可用量（拿到鎖之後的最新值）
            if (inv.availableQty < item.quantity) {
              throw new Error(`庫存不足：商品可用量 ${inv.availableQty}，需求 ${item.quantity}`)
            }
            await tx.inventory.update({
              where: { id: inv.id },
              data: { reservedQty: { increment: item.quantity }, availableQty: { decrement: item.quantity } },
            })
          }
        }
      }

      // CANCELLED → 釋放預留庫存（行級鎖）
      if (newStatus === 'CANCELLED' && ['CONFIRMED', 'ALLOCATING', 'READY_TO_SHIP'].includes(oldStatus)) {
        for (const item of currentOrder.items) {
          const rows = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Inventory"
            WHERE "productId" = ${item.productId}
              AND warehouse = 'MAIN'
              AND category = 'FINISHED_GOODS'
            FOR UPDATE
          `
          const inv = rows[0]
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { reservedQty: { decrement: item.quantity }, availableQty: { increment: item.quantity } },
            })
          }
        }
      }

      return tx.salesOrder.update({
        where: { id },
        data: { status: body.status },
      })
    })

    // ── 訂單確認 → 通知倉儲 + 自動建立銷貨單 ──
    if (newStatus === 'CONFIRMED') {
      const customerName = currentOrder.customer?.name ?? ''
      const itemSummary = currentOrder.items.map(i => `${i.product?.name ?? ''}×${i.quantity}`).join('、')
      notifyByRole(['WAREHOUSE_MANAGER', 'WAREHOUSE'], {
        title: `新訂單待出貨：${currentOrder.orderNo}`,
        message: `${customerName} — ${itemSummary}`,
        linkUrl: `/orders/${id}`,
        category: 'ORDER_CONFIRMED',
        priority: 'HIGH',
      }).catch(() => {})

      // Auto-create SalesInvoice (idempotent)
      const existingInvoice = await prisma.salesInvoice.findFirst({ where: { sourceOrderId: id } })
      if (!existingInvoice && currentOrder.warehouseId) {
        const TAX_RATE = 0.05
        const invoiceNumber = await generateSequenceNo('SALES_INVOICE')
        const invoiceItems = currentOrder.items.map(item => {
          const qty = Number(item.quantity)
          const price = Number(item.unitPrice)
          const sub = qty * price
          const tax = Math.round(sub * TAX_RATE)
          const total = sub + tax
          const unitPriceTax = Math.round(price * (1 + TAX_RATE) * 100) / 100
          return {
            productId: item.productId,
            productName: item.product?.name ?? '',
            specification: null as string | null,
            quantity: qty,
            unit: item.product?.unit ?? null,
            unitPrice: price,
            unitPriceTax,
            subtotal: sub,
            taxAmount: tax,
            totalAmount: total,
          }
        })
        const subtotal = invoiceItems.reduce((s, i) => s + i.subtotal, 0)
        const taxAmount = invoiceItems.reduce((s, i) => s + i.taxAmount, 0)
        const totalAmount = invoiceItems.reduce((s, i) => s + i.totalAmount, 0)

        await prisma.salesInvoice.create({
          data: {
            invoiceNumber,
            date: new Date(),
            customerId: currentOrder.customerId,
            salesPersonId: currentOrder.createdById,
            handlerId: session.user.id,
            warehouseId: currentOrder.warehouseId,
            sourceOrderId: id,
            subtotal,
            taxAmount,
            totalAmount,
            status: 'DRAFT',
            createdById: session.user.id,
            items: { create: invoiceItems },
          },
        })
      }
    }

    // Audit log
    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'orders',
      action: 'STATUS_CHANGE',
      entityType: 'SalesOrder',
      entityId: id,
      entityLabel: currentOrder.orderNo,
      changes: { status: { before: oldStatus, after: newStatus } },
    }).catch(() => {})

    return NextResponse.json(order)
  }

  // 更新付款金額
  if (body.paymentOnly) {
    const existing = await prisma.salesOrder.findUnique({ where: { id }, select: { paidAmount: true, orderNo: true } })
    const order = await prisma.salesOrder.update({
      where: { id },
      data: { paidAmount: Number(body.paidAmount) },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'orders',
      action: 'PAYMENT_UPDATE',
      entityType: 'SalesOrder',
      entityId: id,
      entityLabel: existing?.orderNo ?? '',
      changes: { paidAmount: { before: Number(existing?.paidAmount ?? 0), after: Number(body.paidAmount) } },
    }).catch(() => {})

    return NextResponse.json(order)
  }

  // 完整更新（僅限 PENDING 狀態）
  const existing = await prisma.salesOrder.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'PENDING' && existing.status !== 'DRAFT') {
    return NextResponse.json({ error: '只能編輯草稿或待確認狀態的訂單' }, { status: 400 })
  }

  const totalAmount = body.items.reduce(
    (sum: number, item: { quantity: number; unitPrice: number; discount: number }) =>
      sum + item.quantity * item.unitPrice * (1 - item.discount / 100),
    0
  )

  await prisma.salesOrderItem.deleteMany({ where: { orderId: id } })

  const order = await prisma.salesOrder.update({
    where: { id },
    data: {
      customerId: body.customerId,
      requestedDeliveryDate: body.requestedDeliveryDate ? new Date(body.requestedDeliveryDate) : undefined,
      subtotal:       totalAmount,
      discountAmount: body.discountAmount !== undefined ? Number(body.discountAmount) : undefined,
      shippingFee:    body.shippingFee    !== undefined ? Number(body.shippingFee)    : undefined,
      taxAmount:      body.taxAmount      !== undefined ? Number(body.taxAmount)      : undefined,
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
    include: { items: true },
  })

  return NextResponse.json(order)
  } catch (error) {
    return handleApiError(error, 'orders.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const order = await prisma.salesOrder.findUnique({ where: { id } })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['PENDING', 'CANCELLED'].includes(order.status)) {
      return NextResponse.json({ error: '只能刪除待確認或已取消的訂單' }, { status: 400 })
    }

    await prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'orders.DELETE')
  }
}
