import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search     = searchParams.get('search')     ?? ''
  const warehouseId = searchParams.get('warehouseId') ?? ''
  const status     = searchParams.get('status')     ?? ''
  const category   = searchParams.get('category')   ?? ''
  const expiryAlert = searchParams.get('expiryAlert') === 'true'

  const now   = new Date()
  const soon  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const lots = await prisma.inventoryLot.findMany({
    where: {
      ...(warehouseId && { warehouseId }),
      ...(status     && { status: status as never }),
      ...(category   && { category: category as never }),
      ...(expiryAlert && {
        expiryDate: { lte: soon },
        status: { not: 'SCRAPPED' },
      }),
      ...(search && {
        OR: [
          { lotNo:          { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { sku:  { contains: search, mode: 'insensitive' } } },
          { sourceFactory:  { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      product:       { select: { id: true, sku: true, name: true, unit: true } },
      warehouse:     { select: { id: true, code: true, name: true } },
      supplier:      { select: { id: true, code: true, name: true, country: true } },
      purchaseOrder: { select: { poNo: true } },
    },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(lots)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.productId || !body.warehouseId || !body.quantity) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  // Generate smart lot number
  // Format: {SKU}-{SupplierCode}-{YYYYMM}-{SEQ}  e.g. NIGHT-L-DAFA-202403-001
  // Fallback: LOT{YYYYMMDD}{4-digit}
  const today = new Date()
  const yyyymm = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}`
  let lotNo: string
  try {
    const [product, supplier] = await Promise.all([
      body.productId ? prisma.product.findUnique({ where: { id: body.productId }, select: { sku: true } }) : null,
      body.supplierId ? prisma.supplier.findUnique({ where: { id: body.supplierId }, select: { code: true } }) : null,
    ])
    const skuPart  = (product?.sku  ?? 'PROD').replace(/[^A-Z0-9\-]/gi, '').toUpperCase().slice(0, 12)
    const supPart  = supplier?.code ? supplier.code.toUpperCase().slice(0, 8) : null
    const prefix   = supPart ? `${skuPart}-${supPart}-${yyyymm}` : `${skuPart}-${yyyymm}`
    const existing = await prisma.inventoryLot.count({ where: { lotNo: { startsWith: prefix } } })
    lotNo = `${prefix}-${String(existing + 1).padStart(3, '0')}`
  } catch {
    const count = await prisma.inventoryLot.count()
    const d = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
    lotNo = `LOT${d}${String(count + 1).padStart(4, '0')}`
  }

  // Resolve supplier name for text snapshot
  const supplierSnap = body.supplierId
    ? (await prisma.supplier.findUnique({ where: { id: body.supplierId }, select: { name: true } }))?.name
    : body.sourceFactory || null

  const lot = await prisma.inventoryLot.create({
    data: {
      lotNo,
      productId:       body.productId,
      warehouseId:     body.warehouseId,
      location:        body.location        || null,
      category:        body.category        ?? 'FINISHED_GOODS',
      status:          body.status          ?? 'AVAILABLE',
      quantity:        Number(body.quantity),
      manufactureDate: body.manufactureDate ? new Date(body.manufactureDate) : null,
      expiryDate:      body.expiryDate      ? new Date(body.expiryDate)      : null,
      supplierId:      body.supplierId      || null,
      sourceFactory:   supplierSnap         || body.sourceFactory || null,
      factoryLotNo:    body.factoryLotNo    || null,
      purchaseOrderId: body.purchaseOrderId || null,
      notes:           body.notes           || null,
    },
    include: {
      product:   { select: { sku: true, name: true, unit: true } },
      warehouse: { select: { code: true, name: true } },
    },
  })

  // Also upsert aggregate Inventory
  await prisma.inventory.upsert({
    where: { productId_warehouse_category: {
      productId: body.productId,
      warehouse: (await prisma.warehouse.findUnique({ where: { id: body.warehouseId } }))?.code ?? 'MAIN',
      category:  body.category ?? 'FINISHED_GOODS',
    }},
    update: { quantity: { increment: Number(body.quantity) } },
    create: {
      productId:  body.productId,
      warehouse:  (await prisma.warehouse.findUnique({ where: { id: body.warehouseId } }))?.code ?? 'MAIN',
      category:   body.category ?? 'FINISHED_GOODS',
      quantity:   Number(body.quantity),
      safetyStock: 0,
    },
  })

  return NextResponse.json(lot, { status: 201 })
}
