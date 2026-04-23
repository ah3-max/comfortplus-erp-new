import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { productId, type, quantity, notes, warehouse = 'MAIN' } = body

  if (!productId || !type || quantity === undefined) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  const qty = Number(quantity)
  if (isNaN(qty) || qty === 0) {
    return NextResponse.json({ error: '數量必須為非零整數' }, { status: 400 })
  }

  const category = body.category ?? 'FINISHED_GOODS'

  const inv = await prisma.inventory.findUnique({
    where: { productId_warehouse_category: { productId, warehouse, category } },
  })

  if (!inv) {
    return NextResponse.json({ error: '找不到庫存記錄' }, { status: 404 })
  }

  // 計算調整後數量
  let newQuantity: number
  if (type === 'ADJUSTMENT') {
    newQuantity = qty
  } else if (type === 'IN') {
    newQuantity = inv.quantity + qty
  } else if (type === 'OUT' || type === 'RETURN') {
    newQuantity = inv.quantity + (type === 'RETURN' ? qty : -qty)
  } else {
    return NextResponse.json({ error: '無效的異動類型' }, { status: 400 })
  }

  if (newQuantity < 0) {
    return NextResponse.json({ error: `庫存不足，目前庫存：${inv.quantity}` }, { status: 400 })
  }

  const delta = newQuantity - inv.quantity

  // 樂觀鎖：version 不符表示有並發修改，回傳 409
  try {
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.inventory.updateMany({
      where: {
        id: inv.id,
        version: inv.version, // optimistic lock check
      },
      data: {
        quantity: newQuantity,
        version: { increment: 1 },
      },
    })
    if (updated.count === 0) throw Object.assign(new Error('VERSION_CONFLICT'), { code: 'VERSION_CONFLICT' })

    await tx.inventoryTransaction.create({
      data: {
        productId,
        warehouse,
        category,
        type,
        quantity: Math.abs(delta),
        beforeQty: inv.quantity,
        afterQty: newQuantity,
        notes: notes || null,
        createdById: session.user.id,
        referenceType: 'MANUAL',
      },
    })

    return tx.inventory.findUniqueOrThrow({
      where: { id: inv.id },
    })
  })

  // Look up product for entityLabel
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { sku: true, name: true } })

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? '',
    userRole: (session.user as { role?: string }).role ?? '',
    module: 'inventory',
    action: `ADJUST_${type}`,
    entityType: 'Inventory',
    entityId: inv.id,
    entityLabel: `${product?.name ?? ''} (${product?.sku ?? productId}) @ ${warehouse}/${category} — ${notes || '—'}`,
    changes: { quantity: { before: inv.quantity, after: newQuantity } },
  }).catch(() => {})

  return NextResponse.json(result, { status: 200 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'VERSION_CONFLICT') {
      return NextResponse.json({ error: '並發衝突，請重新載入後再試' }, { status: 409 })
    }
    throw e
  }
}
