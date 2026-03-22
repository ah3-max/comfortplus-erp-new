import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'

// GET /api/pickup — List pickups (filtered by role)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''
  const warehouse = searchParams.get('warehouse') ?? ''
  const mine = searchParams.get('mine') === 'true'

  const pickups = await prisma.warehousePickup.findMany({
    where: {
      ...(mine && { pickedById: session.user.id }),
      ...(status && { status: status as never }),
      ...(warehouse && { warehouse }),
    },
    include: {
      pickedBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, code: true } },
      order: { select: { id: true, orderNo: true } },
      items: {
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(pickups)
}

// POST /api/pickup — Create a new pickup record
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    warehouse?: string
    purpose?: string
    customerId?: string
    orderId?: string
    items: { productId: string; quantity: number; notes?: string }[]
    notes?: string
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: '請至少選擇一項商品' }, { status: 400 })
  }

  const pickupNo = await generateSequenceNo('PICKUP')

  const pickup = await prisma.warehousePickup.create({
    data: {
      pickupNo,
      warehouse: body.warehouse ?? 'MARKETING',
      pickedById: session.user.id,
      purpose: (body.purpose as never) ?? 'DELIVERY',
      customerId: body.customerId || null,
      orderId: body.orderId || null,
      status: 'PENDING_PHOTO',
      notes: body.notes || null,
      items: {
        create: body.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes || null,
        })),
      },
    },
    include: {
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
      customer: { select: { name: true } },
    },
  })

  return NextResponse.json(pickup, { status: 201 })
}
