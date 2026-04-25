import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true, poNo: true, status: true, orderType: true,
            totalAmount: true, paidAmount: true, expectedDate: true, createdAt: true,
          },
        },
        priceHistory: {
          orderBy: { effectiveDate: 'desc' },
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        },
        _count: { select: { purchaseOrders: true } },
      },
    })

    if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(supplier)
  } catch (error) {
    return handleApiError(error, 'suppliers.get')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const before = await prisma.supplier.findUnique({
      where: { id },
      select: { name: true, isActive: true, taxId: true, paymentTerms: true },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name:             body.name,
        contactPerson:    body.contactPerson    || null,
        phone:            body.phone            || null,
        email:            body.email            || null,
        address:          body.address          || null,
        taxId:            body.taxId            || null,
        paymentTerms:     body.paymentTerms     || null,
        leadTimeDays:     body.leadTimeDays     ? Number(body.leadTimeDays) : null,
        supplyCategories: body.supplyCategories || null,
        supplyItems:      body.supplyItems      || null,
        notes:            body.notes            || null,
        isActive:         body.isActive ?? true,
      },
    })

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    if (before.name !== supplier.name) changes.name = { before: before.name, after: supplier.name }
    if (before.isActive !== supplier.isActive) changes.isActive = { before: before.isActive, after: supplier.isActive }
    if (before.taxId !== supplier.taxId) changes.taxId = { before: before.taxId, after: supplier.taxId }
    if (before.paymentTerms !== supplier.paymentTerms) changes.paymentTerms = { before: before.paymentTerms, after: supplier.paymentTerms }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'suppliers',
      action: 'UPDATE',
      entityType: 'Supplier',
      entityId: id,
      entityLabel: `${supplier.code} ${supplier.name}`,
      changes,
    }).catch(() => {})

    return NextResponse.json(supplier)
  } catch (error) {
    return handleApiError(error, 'suppliers.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const target = await prisma.supplier.findUnique({ where: { id }, select: { code: true, name: true } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.supplier.update({ where: { id }, data: { isActive: false } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'suppliers',
      action: 'DEACTIVATE',
      entityType: 'Supplier',
      entityId: id,
      entityLabel: `${target.code} ${target.name}`,
      changes: { isActive: { before: true, after: false } },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'suppliers.delete')
  }
}
