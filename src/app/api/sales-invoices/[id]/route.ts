import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessInvoice, buildScopeContext } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { notifyByRole } from '@/lib/notify'
import { generateSequenceNo } from '@/lib/sequence'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    include: {
      customer: true,
      salesPerson: { select: { id: true, name: true } },
      handler: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      sourceOrder: { select: { id: true, orderNo: true, status: true } },
      items: {
        include: {
          product: { select: { sku: true, name: true, unit: true, sellingPrice: true } },
        },
      },
      pickingOrders: {
        select: { id: true, pickingNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      eInvoices: {
        select: { id: true, invoiceNumber: true, status: true, transmitStatus: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ctx = buildScopeContext(session as { user: { id: string; role: string } })
  if (!canAccessInvoice(ctx, invoice)) {
    return NextResponse.json({ error: '無權限查看此銷貨單' }, { status: 403 })
  }

  return NextResponse.json(invoice)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await req.json()

    // Status-only update
    if (body.statusOnly) {
      const current = await prisma.salesInvoice.findUnique({
        where: { id },
        include: {
          items: { include: { product: { select: { name: true } } } },
          customer: { select: { name: true, taxId: true } },
        },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const oldStatus = current.status
      const newStatus = body.status as string

      const invoice = await prisma.salesInvoice.update({
        where: { id },
        data: { status: body.status },
      })

      // Notify warehouse when confirmed + auto-create picking order
      if (newStatus === 'CONFIRMED') {
        const itemSummary = current.items.map(i => `${i.product?.name ?? i.productName}×${i.quantity}`).join('、')
        notifyByRole(['WAREHOUSE_MANAGER', 'WAREHOUSE'], {
          title: `銷貨單已確認：${current.invoiceNumber}`,
          message: `${current.customer?.name ?? ''} — ${itemSummary}`,
          linkUrl: `/sales-invoices/${id}`,
          category: 'INVOICE_CONFIRMED',
          priority: 'HIGH',
        }).catch(() => {})

        // Auto-create PickingOrder (idempotent: skip if already exists)
        const existingPicking = await prisma.pickingOrder.findFirst({ where: { salesInvoiceId: id } })
        if (!existingPicking) {
          const pickingNumber = await generateSequenceNo('PICKING_ORDER')
          await prisma.pickingOrder.create({
            data: {
              pickingNumber,
              date: new Date(),
              salesInvoiceId: id,
              customerId: current.customerId,
              handlerId: session.user.id,
              warehouseId: current.warehouseId,
              shippingAddress: current.shippingAddress ?? null,
              status: 'PENDING',
              createdById: session.user.id,
              items: {
                create: current.items.map(item => ({
                  productId: item.productId,
                  productName: item.productName,
                  specification: item.specification ?? null,
                  quantity: Number(item.quantity),
                  pickedQuantity: 0,
                })),
              },
            },
          })
        }

        // Auto-create EInvoice draft (idempotent: skip if already exists)
        const existingEInvoice = await prisma.eInvoice.findFirst({ where: { salesInvoiceId: id } })
        if (!existingEInvoice) {
          const eInvNumber = await generateSequenceNo('E_INVOICE')
          const invoiceType = current.customer?.taxId ? 'B2B' : 'B2C'
          await prisma.eInvoice.create({
            data: {
              invoiceNumber: eInvNumber,
              salesInvoiceId: id,
              customerId: current.customerId,
              customerName: current.customer?.name ?? '',
              invoiceType,
              subtotal: current.subtotal,
              taxAmount: current.taxAmount,
              totalAmount: current.totalAmount,
              buyerTaxId: current.customer?.taxId ?? null,
              buyerName: invoiceType === 'B2B' ? (current.customer?.name ?? null) : null,
              status: 'CREATED',
              transmitStatus: 'PENDING',
              createdById: session.user.id,
            },
          })
        }
      }

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'sales-invoices',
        action: 'STATUS_CHANGE',
        entityType: 'SalesInvoice',
        entityId: id,
        entityLabel: current.invoiceNumber,
        changes: { status: { before: oldStatus, after: newStatus } },
      }).catch(() => {})

      return NextResponse.json(invoice)
    }

    // Approval status update
    if (body.approvalOnly) {
      const current = await prisma.salesInvoice.findUnique({ where: { id }, select: { approvalStatus: true, invoiceNumber: true } })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const invoice = await prisma.salesInvoice.update({
        where: { id },
        data: { approvalStatus: body.approvalStatus },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'sales-invoices',
        action: 'APPROVAL_CHANGE',
        entityType: 'SalesInvoice',
        entityId: id,
        entityLabel: current.invoiceNumber,
        changes: { approvalStatus: { before: current.approvalStatus, after: body.approvalStatus } },
      }).catch(() => {})

      return NextResponse.json(invoice)
    }

    // Full update (only DRAFT)
    const existing = await prisma.salesInvoice.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能編輯草稿狀態的銷貨單' }, { status: 400 })
    }

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

    await prisma.salesInvoiceItem.deleteMany({ where: { salesInvoiceId: id } })

    const invoice = await prisma.salesInvoice.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        customerId: body.customerId,
        salesPersonId: body.salesPersonId,
        handlerId: body.handlerId,
        warehouseId: body.warehouseId,
        transactionType: body.transactionType,
        receiverName: body.receiverName || null,
        shippingAddress: body.shippingAddress || null,
        phone: body.phone || null,
        shippingNote: body.shippingNote || null,
        notes: body.notes || null,
        subtotal,
        taxAmount,
        totalAmount,
        items: { create: items },
      },
      include: { items: true },
    })

    return NextResponse.json(invoice)
  } catch (error) {
    return handleApiError(error, 'sales-invoices.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const invoice = await prisma.salesInvoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['DRAFT', 'CANCELLED'].includes(invoice.status)) {
      return NextResponse.json({ error: '只能刪除草稿或已取消的銷貨單' }, { status: 400 })
    }

    await prisma.salesInvoice.update({ where: { id }, data: { status: 'CANCELLED' } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'sales-invoices',
      action: 'CANCEL',
      entityType: 'SalesInvoice',
      entityId: id,
      entityLabel: invoice.invoiceNumber,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'sales-invoices.DELETE')
  }
}
