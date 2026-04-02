import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { generateSequenceNo } from '@/lib/sequence'
import { notifyByRole } from '@/lib/notify'
import { createAutoJournal } from '@/lib/auto-journal'

/**
 * POST /api/orders/batch-confirm
 * Batch confirm multiple PENDING/DRAFT sales orders
 * Body: { orderIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES', 'CS'].includes(role)) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const body = await req.json() as { orderIds: string[] }
    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      return NextResponse.json({ error: '請提供訂單 ID 清單' }, { status: 400 })
    }

    const results: { orderId: string; orderNo: string; status: 'confirmed' | 'skipped'; reason?: string }[] = []

    for (const orderId of body.orderIds) {
      const order = await prisma.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: { select: { name: true, unit: true, costPrice: true } } } },
          customer: { select: { name: true } },
        },
      })

      if (!order) {
        results.push({ orderId, orderNo: '', status: 'skipped', reason: '找不到訂單' })
        continue
      }
      if (!['DRAFT', 'PENDING'].includes(order.status)) {
        results.push({ orderId, orderNo: order.orderNo, status: 'skipped', reason: `狀態為 ${order.status}，無法確認` })
        continue
      }

      // Reserve inventory with row-level lock (SELECT FOR UPDATE)
      let warehouseCode = 'MAIN'
      if (order.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: order.warehouseId }, select: { code: true } })
        if (wh?.code) warehouseCode = wh.code
      }

      try {
        await prisma.$transaction(async (tx) => {
          for (const item of order.items) {
            const rows = await tx.$queryRaw<Array<{ id: string; availableQty: number }>>`
              SELECT id, "availableQty" FROM "Inventory"
              WHERE "productId" = ${item.productId}
                AND warehouse = ${warehouseCode}
                AND category = 'FINISHED_GOODS'
              FOR UPDATE
            `
            const inv = rows[0]
            if (inv && inv.availableQty >= item.quantity) {
              await tx.inventory.update({
                where: { id: inv.id },
                data: { reservedQty: { increment: item.quantity }, availableQty: { decrement: item.quantity } },
              })
            }
          }

          await tx.salesOrder.update({
            where: { id: orderId },
            data: { status: 'CONFIRMED' },
          })
        })
      } catch {
        results.push({ orderId, orderNo: order.orderNo, status: 'skipped', reason: '庫存不足，無法確認' })
        continue
      }

      // Auto-create SalesInvoice (idempotent)
      const existingInvoice = await prisma.salesInvoice.findFirst({ where: { sourceOrderId: orderId } })
      if (!existingInvoice) {
        const warehouseId = order.warehouseId ?? (
          await prisma.warehouse.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } })
        )?.id

        if (warehouseId) {
          const TAX_RATE = 0.05
          const invoiceNumber = await generateSequenceNo('SALES_INVOICE')
          const invoiceItems = order.items.map(item => {
            const qty = Number(item.quantity)
            const price = Number(item.unitPrice)
            const sub = qty * price
            const tax = Math.round(sub * TAX_RATE)
            return {
              productId: item.productId,
              productName: item.product?.name ?? '',
              specification: null as string | null,
              quantity: qty,
              unit: item.product?.unit ?? null,
              unitPrice: price,
              unitPriceTax: Math.round(price * (1 + TAX_RATE) * 100) / 100,
              subtotal: sub,
              taxAmount: tax,
              totalAmount: sub + tax,
            }
          })
          const subtotal = invoiceItems.reduce((s, i) => s + i.subtotal, 0)
          const taxAmount = invoiceItems.reduce((s, i) => s + i.taxAmount, 0)

          await prisma.salesInvoice.create({
            data: {
              invoiceNumber,
              date: new Date(),
              customerId: order.customerId,
              salesPersonId: order.createdById,
              handlerId: session.user.id,
              warehouseId,
              sourceOrderId: orderId,
              subtotal,
              taxAmount,
              totalAmount: subtotal + taxAmount,
              status: 'DRAFT',
              createdById: session.user.id,
              items: { create: invoiceItems },
            },
          })
        }
      }

      // Auto-create AR (idempotent)
      const existingAR = await prisma.accountsReceivable.findFirst({ where: { orderId } })
      if (!existingAR) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 30)
        await prisma.accountsReceivable.create({
          data: {
            customerId: order.customerId,
            orderId,
            amount: Number(order.totalAmount),
            paidAmount: 0,
            dueDate,
            status: 'NOT_DUE',
          },
        })
      }

      // Auto journal: SALES_CONFIRM + SALES_COGS (idempotent)
      const subtotalAmt = Number(order.subtotal ?? order.totalAmount ?? 0)
      const taxAmt = Number(order.taxAmount ?? 0)
      createAutoJournal({
        type: 'SALES_CONFIRM',
        referenceType: 'SALES_ORDER',
        referenceId: orderId,
        entryDate: new Date(),
        description: `訂單確認 ${order.orderNo}`,
        amount: subtotalAmt,
        taxAmount: taxAmt,
        createdById: session.user.id,
      }).catch(() => {})
      const calculatedCog = order.items.reduce(
        (s, i) => s + Number(i.quantity) * Number(i.product?.costPrice ?? 0), 0
      )
      if (calculatedCog > 0) {
        await prisma.salesOrder.update({ where: { id: orderId }, data: { costOfGoods: calculatedCog } })
        createAutoJournal({
          type: 'SALES_COGS',
          referenceType: 'SALES_ORDER_COGS',
          referenceId: orderId,
          entryDate: new Date(),
          description: `銷貨成本 ${order.orderNo}`,
          amount: 0,
          cogAmount: calculatedCog,
          createdById: session.user.id,
        }).catch(() => {})
      }

      // Notify warehouse
      const itemSummary = order.items.map(i => `${i.product?.name ?? ''}×${i.quantity}`).join('、')
      notifyByRole(['WAREHOUSE_MANAGER', 'WAREHOUSE'], {
        title: `新訂單待出貨：${order.orderNo}`,
        message: `${order.customer?.name ?? ''} — ${itemSummary}`,
        linkUrl: `/orders/${orderId}`,
        category: 'ORDER_CONFIRMED',
        priority: 'HIGH',
      }).catch(() => {})

      results.push({ orderId, orderNo: order.orderNo, status: 'confirmed' })
    }

    const confirmed = results.filter(r => r.status === 'confirmed')
    const skipped   = results.filter(r => r.status === 'skipped')

    return NextResponse.json({
      message: `批次確認完成：${confirmed.length} 筆確認，${skipped.length} 筆略過`,
      confirmed: confirmed.length,
      skipped: skipped.length,
      results,
    })
  } catch (error) {
    return handleApiError(error, 'orders.batchConfirm')
  }
}
