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
  const list = await prisma.priceList.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      items: { include: { product: { select: { id: true, sku: true, name: true, sellingPrice: true, costPrice: true } } } },
    },
  })
  if (!list) return NextResponse.json({ error: '找不到價格表' }, { status: 404 })
  return NextResponse.json(list)
  } catch (error) { return handleApiError(error, 'price-lists.get') }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // If items provided, replace all
  if (body.items) {
    await prisma.priceListItem.deleteMany({ where: { priceListId: id } })
    await prisma.priceListItem.createMany({
      data: (body.items as { productId: string; standardPrice: number; specialPrice?: number; discountRate?: number; floorPrice?: number; requiresApproval?: boolean }[]).map(i => ({
        priceListId: id,
        productId: i.productId,
        standardPrice: i.standardPrice,
        specialPrice: i.specialPrice ?? null,
        discountRate: i.discountRate ?? null,
        floorPrice: i.floorPrice ?? null,
        requiresApproval: i.requiresApproval ?? false,
      })),
    })
  }

  const list = await prisma.priceList.update({
    where: { id },
    data: {
      name:          body.name          ?? undefined,
      customerType:  body.customerType  !== undefined ? (body.customerType || null) : undefined,
      customerId:    body.customerId    !== undefined ? (body.customerId || null) : undefined,
      channel:       body.channel       ?? undefined,
      currency:      body.currency      ?? undefined,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
      expiryDate:    body.expiryDate    ? new Date(body.expiryDate) : body.expiryDate === null ? null : undefined,
      isActive:      body.isActive      ?? undefined,
      notes:         body.notes         ?? undefined,
    },
    include: { items: { include: { product: { select: { id: true, sku: true, name: true } } } } },
  })

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? '',
    userRole: (session.user as { role?: string }).role ?? '',
    module: 'price-lists',
    action: 'UPDATE',
    entityType: 'PriceList',
    entityId: id,
    entityLabel: `${list.name} (${list.items.length} 項${body.items ? ' — 項目已取代' : ''})`,
  }).catch(() => {})

  return NextResponse.json(list)
  } catch (error) { return handleApiError(error, 'price-lists.update') }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const target = await prisma.priceList.findUnique({ where: { id }, select: { name: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.priceList.delete({ where: { id } })

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? '',
    userRole: (session.user as { role?: string }).role ?? '',
    module: 'price-lists',
    action: 'DELETE',
    entityType: 'PriceList',
    entityId: id,
    entityLabel: target.name,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
  } catch (error) { return handleApiError(error, 'price-lists.delete') }
}
