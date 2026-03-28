import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const rfq = await prisma.requestForQuotation.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
      },
      suppliers: {
        include: { supplier: { select: { id: true, name: true, code: true } } },
      },
    },
  })

  if (!rfq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(rfq)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.requestForQuotation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Status-only update (DRAFT → SENT → RESPONDED → COMPLETED)
    if (body.statusOnly) {
      const rfq = await prisma.requestForQuotation.update({
        where: { id },
        data: { status: body.status },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'rfq',
        action: 'STATUS_CHANGE',
        entityType: 'RequestForQuotation',
        entityId: id,
        entityLabel: existing.rfqNumber,
        changes: { status: { before: existing.status, after: body.status } },
      }).catch(() => {})

      return NextResponse.json(rfq)
    }

    // Supplier quote response update
    if (body.supplierQuote) {
      const rfqSupplier = await prisma.rFQSupplier.update({
        where: { id: body.supplierQuote.rfqSupplierId },
        data: {
          quotedPrice: Number(body.supplierQuote.quotedPrice),
          responseDate: new Date(),
          selected: body.supplierQuote.selected ?? false,
        },
      })

      return NextResponse.json(rfqSupplier)
    }

    // Full update (only DRAFT status)
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能編輯草稿狀態的詢價單' }, { status: 400 })
    }

    // Delete existing items and suppliers, recreate
    await Promise.all([
      prisma.rFQItem.deleteMany({ where: { rfqId: id } }),
      prisma.rFQSupplier.deleteMany({ where: { rfqId: id } }),
    ])

    const rfq = await prisma.requestForQuotation.update({
      where: { id },
      data: {
        handlerId: body.handlerId ?? existing.handlerId,
        validUntil: body.validUntil ? new Date(body.validUntil) : existing.validUntil,
        notes: body.notes ?? existing.notes,
        items: {
          create: body.items.map((item: {
            productId: string
            quantity: number
            specification?: string
          }) => ({
            productId: item.productId,
            quantity: item.quantity,
            specification: item.specification || null,
          })),
        },
        suppliers: body.supplierIds?.length
          ? {
              create: (body.supplierIds as string[]).map((supplierId: string) => ({
                supplierId,
              })),
            }
          : undefined,
      },
      include: {
        items: {
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        },
        suppliers: {
          include: { supplier: { select: { id: true, name: true, code: true } } },
        },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'rfq',
      action: 'UPDATE',
      entityType: 'RequestForQuotation',
      entityId: id,
      entityLabel: existing.rfqNumber,
    }).catch(() => {})

    return NextResponse.json(rfq)
  } catch (error) {
    return handleApiError(error, 'rfq.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const rfq = await prisma.requestForQuotation.findUnique({ where: { id } })
    if (!rfq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!['DRAFT', 'SENT'].includes(rfq.status)) {
      return NextResponse.json({ error: '只能取消草稿或已送出的詢價單' }, { status: 400 })
    }

    await prisma.requestForQuotation.update({ where: { id }, data: { status: 'CANCELLED' } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'rfq',
      action: 'CANCEL',
      entityType: 'RequestForQuotation',
      entityId: id,
      entityLabel: rfq.rfqNumber,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'rfq.DELETE')
  }
}
