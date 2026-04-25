import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const CAN_SEE_COST    = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE']
const CAN_SEE_MANAGER = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'PROCUREMENT', 'FINANCE']

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const product = await prisma.product.findUnique({ where: { id }, include: { inventory: true } })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(maskProduct(product as unknown as Record<string, unknown>, session.user.role as string))
  } catch (error) {
    return handleApiError(error, 'products.get')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const role = session.user.role as string

    if (body.sku) {
      const existing = await prisma.product.findFirst({ where: { sku: body.sku, id: { not: id } } })
      if (existing) return NextResponse.json({ error: '此 SKU 已被其他商品使用' }, { status: 400 })
    }

    const before = await prisma.product.findUnique({
      where: { id },
      select: { sku: true, name: true, sellingPrice: true, costPrice: true, isActive: true },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const product = await prisma.product.update({
      where: { id },
      data: {
        name:          body.name,
        category:      body.category,
        series:        body.series        ?? null,
        size:          body.size          ?? null,
        packagingType: body.packagingType ?? null,
        piecesPerPack: body.piecesPerPack ? Number(body.piecesPerPack) : null,
        packsPerBox:   body.packsPerBox   ? Number(body.packsPerBox)   : null,
        specification: body.specification || null,
        unit:          body.unit          || '包',
        boxQuantity:   body.packsPerBox   ? Number(body.packsPerBox) : (body.boxQuantity ? Number(body.boxQuantity) : null),
        barcode:       body.barcode       || null,
        sellingPrice:  Number(body.sellingPrice ?? 0),
        channelPrice:  body.channelPrice   ? Number(body.channelPrice)   : null,
        wholesalePrice: body.wholesalePrice ? Number(body.wholesalePrice) : null,
        weight:        body.weight  ? Number(body.weight)  : null,
        volume:        body.volume  || null,
        storageNotes:  body.storageNotes || null,
        description:   body.description  || null,
        // 敏感欄位只有授權角色能修改
        ...(CAN_SEE_COST.includes(role) && {
          costPrice:   Number(body.costPrice   ?? 0),
          floorPrice:  body.floorPrice  ? Number(body.floorPrice)  : null,
          oemBasePrice: body.oemBasePrice ? Number(body.oemBasePrice) : null,
        }),
        ...(CAN_SEE_MANAGER.includes(role) && {
          minSellPrice: body.minSellPrice ? Number(body.minSellPrice) : null,
        }),
      },
    })

    if (body.safetyStock !== undefined) {
      await prisma.inventory.updateMany({
        where: { productId: id, warehouse: 'MAIN' },
        data:  { safetyStock: Number(body.safetyStock) },
      })
    }

    if (body.isActive !== undefined) {
      await prisma.product.update({ where: { id }, data: { isActive: body.isActive } })
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    if (Number(before.sellingPrice) !== Number(product.sellingPrice)) {
      changes.sellingPrice = { before: Number(before.sellingPrice), after: Number(product.sellingPrice) }
    }
    if (Number(before.costPrice) !== Number(product.costPrice)) {
      changes.costPrice = { before: Number(before.costPrice), after: Number(product.costPrice) }
    }
    if (before.name !== product.name) changes.name = { before: before.name, after: product.name }
    if (body.isActive !== undefined && before.isActive !== body.isActive) {
      changes.isActive = { before: before.isActive, after: body.isActive }
    }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'products',
      action: 'UPDATE',
      entityType: 'Product',
      entityId: id,
      entityLabel: `${product.sku} ${product.name}`,
      changes,
    }).catch(() => {})

    return NextResponse.json(maskProduct(product as unknown as Record<string, unknown>, role))
  } catch (error) {
    return handleApiError(error, 'products.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const target = await prisma.product.findUnique({ where: { id }, select: { sku: true, name: true } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.product.update({ where: { id }, data: { isActive: false } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'products',
      action: 'DEACTIVATE',
      entityType: 'Product',
      entityId: id,
      entityLabel: `${target.sku} ${target.name}`,
      changes: { isActive: { before: true, after: false } },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'products.delete')
  }
}
