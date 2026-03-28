import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const invoice = await prisma.eInvoice.findUnique({
    where: { id },
    include: {
      salesInvoice: { select: { id: true, invoiceNumber: true } },
      customer: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(invoice)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.eInvoice.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Update transmit status only
    if (body.transmitOnly) {
      const invoice = await prisma.eInvoice.update({
        where: { id },
        data: {
          transmitStatus: body.transmitStatus,
          transmittedAt: body.transmitStatus === 'TRANSMITTED' ? new Date() : undefined,
        },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'e-invoices',
        action: 'TRANSMIT_STATUS',
        entityType: 'EInvoice',
        entityId: id,
        entityLabel: existing.invoiceNumber,
        changes: { transmitStatus: { before: existing.transmitStatus, after: body.transmitStatus } },
      }).catch(() => {})

      return NextResponse.json(invoice)
    }

    // Status-only update (CREATED → APPROVED)
    if (body.statusOnly) {
      const invoice = await prisma.eInvoice.update({
        where: { id },
        data: { status: body.status },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'e-invoices',
        action: 'STATUS_CHANGE',
        entityType: 'EInvoice',
        entityId: id,
        entityLabel: existing.invoiceNumber,
        changes: { status: { before: existing.status, after: body.status } },
      }).catch(() => {})

      return NextResponse.json(invoice)
    }

    // Full update (only CREATED status)
    if (existing.status !== 'CREATED') {
      return NextResponse.json({ error: '只能編輯新增狀態的發票' }, { status: 400 })
    }

    const invoice = await prisma.eInvoice.update({
      where: { id },
      data: {
        salesInvoiceId: body.salesInvoiceId ?? existing.salesInvoiceId,
        customerId: body.customerId ?? existing.customerId,
        customerName: body.customerName ?? existing.customerName,
        invoiceType: body.invoiceType ?? existing.invoiceType,
        subtotal: body.subtotal !== undefined ? Number(body.subtotal) : undefined,
        taxAmount: body.taxAmount !== undefined ? Number(body.taxAmount) : undefined,
        totalAmount: body.totalAmount !== undefined ? Number(body.totalAmount) : undefined,
        buyerTaxId: body.buyerTaxId ?? existing.buyerTaxId,
        buyerName: body.buyerName ?? existing.buyerName,
      },
      include: {
        salesInvoice: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'e-invoices',
      action: 'UPDATE',
      entityType: 'EInvoice',
      entityId: id,
      entityLabel: existing.invoiceNumber,
    }).catch(() => {})

    return NextResponse.json(invoice)
  } catch (error) {
    return handleApiError(error, 'e-invoices.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const invoice = await prisma.eInvoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (invoice.transmitStatus === 'TRANSMITTED') {
      return NextResponse.json({ error: '已傳送的發票無法作廢' }, { status: 400 })
    }

    await prisma.eInvoice.update({ where: { id }, data: { status: 'VOIDED' } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'e-invoices',
      action: 'VOID',
      entityType: 'EInvoice',
      entityId: id,
      entityLabel: invoice.invoiceNumber,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'e-invoices.DELETE')
  }
}
