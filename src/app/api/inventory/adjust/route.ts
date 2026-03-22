import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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

  const [updated] = await prisma.$transaction([
    prisma.inventory.update({
      where: { productId_warehouse_category: { productId, warehouse, category } },
      data: { quantity: newQuantity },
    }),
    prisma.inventoryTransaction.create({
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
    }),
  ])

  return NextResponse.json(updated, { status: 200 })
}
