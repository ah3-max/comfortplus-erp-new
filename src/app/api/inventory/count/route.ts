import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''

  const counts = await prisma.stockCount.findMany({
    where: { ...(status && { status: status as never }) },
    include: {
      warehouse:  { select: { code: true, name: true } },
      createdBy:  { select: { name: true } },
      _count:     { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(counts)
  } catch (error) { return handleApiError(error, 'inventory.count.list') }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.warehouseId) return NextResponse.json({ error: '請選擇倉庫' }, { status: 400 })

  const count = await prisma.stockCount.count()
  const today = new Date()
  const d = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
  const countNo = `SC${d}${String(count + 1).padStart(4, '0')}`

  // Snapshot current inventory for this warehouse
  const warehouse = await prisma.warehouse.findUnique({ where: { id: body.warehouseId } })
  if (!warehouse) return NextResponse.json({ error: '找不到倉庫' }, { status: 404 })

  const inventoryItems = await prisma.inventory.findMany({
    where: { warehouse: warehouse.code },
  })

  const stockCount = await prisma.stockCount.create({
    data: {
      countNo,
      warehouseId:  body.warehouseId,
      createdById:  session.user.id,
      notes:        body.notes || null,
      countDate:    body.countDate ? new Date(body.countDate) : new Date(),
      items: {
        create: inventoryItems.map(inv => ({
          productId: inv.productId,
          systemQty: inv.quantity,
          countedQty: 0,
          variance:   0,
        })),
      },
    },
    include: {
      warehouse: { select: { code: true, name: true } },
      items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
    },
  })

  return NextResponse.json(stockCount, { status: 201 })
  } catch (error) { return handleApiError(error, 'inventory.count.create') }
}
