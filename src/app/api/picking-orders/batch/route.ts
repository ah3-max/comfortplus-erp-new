import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/picking-orders/batch
 * 批次建立理貨單：從多筆銷貨單一次建立
 * Body: { salesInvoiceIds: string[], warehouseId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'WAREHOUSE'].includes(role)) {
      return NextResponse.json({ error: '無權限建立理貨單' }, { status: 403 })
    }

    const body = await req.json()
    const { salesInvoiceIds, warehouseId } = body as { salesInvoiceIds: string[]; warehouseId?: string }

    if (!Array.isArray(salesInvoiceIds) || salesInvoiceIds.length === 0) {
      return NextResponse.json({ error: '請選擇至少一筆銷貨單' }, { status: 400 })
    }
    if (salesInvoiceIds.length > 50) {
      return NextResponse.json({ error: '一次最多批次建立 50 筆' }, { status: 400 })
    }

    // Fetch all invoices
    const invoices = await prisma.salesInvoice.findMany({
      where: { id: { in: salesInvoiceIds } },
      include: {
        items: true,
        customer: { select: { id: true } },
      },
    })

    const results: { invoiceId: string; invoiceNumber: string; pickingNumber: string; skipped?: string }[] = []

    for (const invoice of invoices) {
      // Skip non-CONFIRMED invoices
      if (invoice.status !== 'CONFIRMED') {
        results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, pickingNumber: '', skipped: `狀態 ${invoice.status} 無法建立` })
        continue
      }

      // Check if picking order already exists for this invoice
      const existing = await prisma.pickingOrder.findFirst({
        where: { salesInvoiceId: invoice.id, status: { not: 'CANCELLED' } },
      })
      if (existing) {
        results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, pickingNumber: existing.pickingNumber, skipped: '已存在理貨單' })
        continue
      }

      const pickingNumber = await generateSequenceNo('PICKING_ORDER')
      await prisma.pickingOrder.create({
        data: {
          pickingNumber,
          date: new Date(),
          salesInvoiceId: invoice.id,
          customerId: invoice.customerId,
          handlerId: session.user.id,
          warehouseId: warehouseId ?? invoice.warehouseId ?? null,
          status: 'PENDING',
          createdById: session.user.id,
          items: {
            create: invoice.items.map(item => ({
              productId: item.productId,
              productName: item.productName,
              specification: item.specification || null,
              quantity: Number(item.quantity),
              pickedQuantity: 0,
              memo: null,
            })),
          },
        },
      })

      results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, pickingNumber })
    }

    const created  = results.filter(r => !r.skipped)
    const skipped  = results.filter(r => r.skipped)

    return NextResponse.json({
      created: created.length,
      skipped: skipped.length,
      results,
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'picking-orders.batch.POST')
  }
}
