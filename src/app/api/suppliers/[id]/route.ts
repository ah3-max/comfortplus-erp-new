import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

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
    await prisma.supplier.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'suppliers.delete')
  }
}
