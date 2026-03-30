import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId   = searchParams.get('customerId')   ?? ''
  const customerType = searchParams.get('customerType') ?? ''
  const activeOnly   = searchParams.get('active') !== 'false'

  const now = new Date()
  const lists = await prisma.priceList.findMany({
    where: {
      ...(activeOnly && { isActive: true, effectiveDate: { lte: now }, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] }),
      ...(customerId   && { OR: [{ customerId }, { customerId: null }] }),
      ...(customerType && { OR: [{ customerType: customerType as never }, { customerType: null }] }),
    },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      items: { include: { product: { select: { id: true, sku: true, name: true, sellingPrice: true } } } },
    },
    orderBy: { effectiveDate: 'desc' },
  })

  return NextResponse.json(lists)
  } catch (error) { return handleApiError(error, 'price-lists.list') }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.name || !body.effectiveDate || !body.items?.length) {
    return NextResponse.json({ error: '請填寫名稱、生效日與至少一項商品' }, { status: 400 })
  }

  const list = await prisma.priceList.create({
    data: {
      name:          body.name,
      customerType:  body.customerType  || null,
      customerId:    body.customerId    || null,
      channel:       body.channel       || null,
      currency:      body.currency      ?? 'TWD',
      effectiveDate: new Date(body.effectiveDate),
      expiryDate:    body.expiryDate ? new Date(body.expiryDate) : null,
      notes:         body.notes || null,
      items: {
        create: (body.items as { productId: string; standardPrice: number; specialPrice?: number; discountRate?: number; floorPrice?: number; requiresApproval?: boolean }[]).map(i => ({
          productId:        i.productId,
          standardPrice:    i.standardPrice,
          specialPrice:     i.specialPrice     ?? null,
          discountRate:     i.discountRate      ?? null,
          floorPrice:       i.floorPrice        ?? null,
          requiresApproval: i.requiresApproval  ?? false,
        })),
      },
    },
    include: { items: { include: { product: { select: { id: true, sku: true, name: true } } } } },
  })

  return NextResponse.json(list, { status: 201 })
  } catch (error) { return handleApiError(error, 'price-lists.create') }
}
