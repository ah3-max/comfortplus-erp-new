import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''

  const scraps = await prisma.stockScrap.findMany({
    where: {
      ...(search && {
        OR: [
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { scrapNo: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      product:   { select: { sku: true, name: true, unit: true } },
      warehouse: { select: { code: true, name: true } },
      lot:       { select: { lotNo: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(scraps)
  } catch (error) { return handleApiError(error, 'inventory.scrap.list') }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.productId || !body.warehouseId || !body.quantity) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  const qty = Number(body.quantity)
  if (qty <= 0) return NextResponse.json({ error: '報廢數量必須大於零' }, { status: 400 })

  const warehouse = await prisma.warehouse.findUnique({ where: { id: body.warehouseId } })
  if (!warehouse) return NextResponse.json({ error: '找不到倉庫' }, { status: 404 })

  // Check inventory availability
  const inv = await prisma.inventory.findFirst({
    where: { productId: body.productId, warehouse: warehouse.code },
  })
  if (!inv || inv.quantity < qty) {
    return NextResponse.json({ error: `庫存不足，可用：${inv?.quantity ?? 0}` }, { status: 400 })
  }

  const count = await prisma.stockScrap.count()
  const today = new Date()
  const d = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
  const scrapNo = `SP${d}${String(count + 1).padStart(4, '0')}`

  const scrap = await prisma.$transaction(async (tx) => {
    const s = await tx.stockScrap.create({
      data: {
        scrapNo,
        productId:   body.productId,
        warehouseId: body.warehouseId,
        lotId:       body.lotId || null,
        quantity:    qty,
        reason:      body.reason      || null,
        notes:       body.notes       || null,
        createdById: session.user.id,
        scrapDate:   body.scrapDate ? new Date(body.scrapDate) : new Date(),
      },
    })

    await tx.inventory.updateMany({
      where: { productId: body.productId, warehouse: warehouse.code },
      data:  { quantity: { decrement: qty } },
    })

    await tx.inventoryTransaction.create({
      data: {
        productId: body.productId, warehouse: warehouse.code,
        type: 'SCRAP', quantity: qty,
        beforeQty: inv.quantity, afterQty: inv.quantity - qty,
        referenceType: 'SCRAP', referenceId: scrapNo,
        notes: `報廢 ${scrapNo}：${body.reason || '—'}`,
        createdById: session.user.id,
      },
    })

    return s
  })

  return NextResponse.json(scrap, { status: 201 })
  } catch (error) { return handleApiError(error, 'inventory.scrap.create') }
}
