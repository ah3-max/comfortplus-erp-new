import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''

  const transfers = await prisma.stockTransfer.findMany({
    where: { ...(status && { status: status as never }) },
    include: {
      fromWarehouse: { select: { code: true, name: true } },
      toWarehouse:   { select: { code: true, name: true } },
      requestedBy:   { select: { name: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(transfers)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.fromWarehouseId || !body.toWarehouseId || !body.items?.length) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }
  if (body.fromWarehouseId === body.toWarehouseId) {
    return NextResponse.json({ error: '出入庫倉庫不可相同' }, { status: 400 })
  }

  const count = await prisma.stockTransfer.count()
  const today = new Date()
  const d = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
  const transferNo = `TR${d}${String(count + 1).padStart(4, '0')}`

  const transfer = await prisma.stockTransfer.create({
    data: {
      transferNo,
      fromWarehouseId: body.fromWarehouseId,
      toWarehouseId:   body.toWarehouseId,
      requestedById:   session.user.id,
      notes:           body.notes || null,
      items: {
        create: body.items.map((i: { productId: string; lotId?: string; quantity: number }) => ({
          productId: i.productId,
          lotId:     i.lotId || null,
          quantity:  i.quantity,
        })),
      },
    },
    include: {
      fromWarehouse: { select: { code: true, name: true } },
      toWarehouse:   { select: { code: true, name: true } },
      items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
    },
  })

  return NextResponse.json(transfer, { status: 201 })
}
