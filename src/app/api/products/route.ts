import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// 角色權限定義
const CAN_SEE_COST     = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE']
const CAN_SEE_MANAGER  = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'PROCUREMENT', 'FINANCE']

function maskProduct(p: Record<string, unknown>, role: string) {
  const out = { ...p }
  if (!CAN_SEE_COST.includes(role)) {
    delete out.costPrice
    delete out.floorPrice
    delete out.oemBasePrice
  }
  if (!CAN_SEE_MANAGER.includes(role)) {
    delete out.minSellPrice
  }
  return out
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') ?? ''
  const category = searchParams.get('category') ?? ''
  const series   = searchParams.get('series') ?? ''
  const showAll  = searchParams.get('all') === '1'  // 採購/報價選品用：含停售

  const products = await prisma.product.findMany({
    where: {
      ...(showAll ? {} : { isActive: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku:  { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category }),
      ...(series   && { series }),
    },
    include: {
      inventory: { where: { warehouse: 'MAIN' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const role = session.user.role as string
  return NextResponse.json(products.map(p => maskProduct(p as unknown as Record<string, unknown>, role)))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const role = session.user.role as string

  // 檢查 SKU 是否重複
  const existing = await prisma.product.findUnique({ where: { sku: body.sku } })
  if (existing) return NextResponse.json({ error: 'SKU 已存在' }, { status: 400 })

  const product = await prisma.product.create({
    data: {
      sku:           body.sku,
      name:          body.name,
      category:      body.category,
      series:        body.series        || null,
      size:          body.size          || null,
      packagingType: body.packagingType || null,
      piecesPerPack: body.piecesPerPack ? Number(body.piecesPerPack) : null,
      packsPerBox:   body.packsPerBox   ? Number(body.packsPerBox)   : null,
      specification: body.specification || null,
      unit:          body.unit          || '包',
      boxQuantity:   body.packsPerBox   ? Number(body.packsPerBox) : (body.boxQuantity ? Number(body.boxQuantity) : null),
      barcode:       body.barcode       || null,
      costPrice:     CAN_SEE_COST.includes(role)    ? Number(body.costPrice    ?? 0) : 0,
      floorPrice:    CAN_SEE_COST.includes(role)    ? (body.floorPrice    ? Number(body.floorPrice)    : null) : null,
      sellingPrice:  Number(body.sellingPrice ?? 0),
      channelPrice:  body.channelPrice   ? Number(body.channelPrice)   : null,
      wholesalePrice: body.wholesalePrice ? Number(body.wholesalePrice) : null,
      minSellPrice:  CAN_SEE_MANAGER.includes(role) ? (body.minSellPrice  ? Number(body.minSellPrice)  : null) : null,
      oemBasePrice:  CAN_SEE_COST.includes(role)    ? (body.oemBasePrice  ? Number(body.oemBasePrice)  : null) : null,
      weight:        body.weight  ? Number(body.weight)  : null,
      volume:        body.volume  || null,
      storageNotes:  body.storageNotes || null,
      description:   body.description  || null,
    },
  })

  await prisma.inventory.create({
    data: {
      productId:   product.id,
      warehouse:   'MAIN',
      quantity:    Number(body.initialStock ?? 0),
      safetyStock: Number(body.safetyStock  ?? 0),
    },
  })

  if (body.initialStock && Number(body.initialStock) > 0) {
    await prisma.inventoryTransaction.create({
      data: {
        productId:   product.id,
        warehouse:   'MAIN',
        type:        'IN',
        quantity:    Number(body.initialStock),
        notes:       '初始庫存建立',
        createdById: session.user.id,
      },
    })
  }

  return NextResponse.json(maskProduct(product as unknown as Record<string, unknown>, role), { status: 201 })
}
