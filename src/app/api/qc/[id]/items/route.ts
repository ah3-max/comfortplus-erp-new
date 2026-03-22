import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/qc/[id]/items — 新增或批量更新檢驗明細項目
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: qcId } = await params
  const body = await req.json()

  // Support single item or array
  const items: Array<{
    itemName: string
    standardValue?: string
    actualValue?: string
    isQualified?: boolean
    defectType?: string
    defectQty?: number
    judgment?: string
    notes?: string
  }> = Array.isArray(body) ? body : [body]

  if (!items.length || !items[0].itemName) {
    return NextResponse.json({ error: '項目名稱為必填' }, { status: 400 })
  }

  const created = await prisma.$transaction(
    items.map(item =>
      prisma.qcCheckItem.create({
        data: {
          qcId,
          itemName:      item.itemName,
          standardValue: item.standardValue ?? null,
          actualValue:   item.actualValue   ?? null,
          isQualified:   item.isQualified   ?? null,
          defectType:    item.defectType     ?? null,
          defectQty:     item.defectQty      ?? null,
          judgment:      item.judgment       ?? null,
          notes:         item.notes          ?? null,
        },
      })
    )
  )

  return NextResponse.json(created, { status: 201 })
}

// PATCH /api/qc/[id]/items — 更新單一 check item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params  // qcId not used directly; itemId comes from body
  const body = await req.json()
  const { itemId, ...data } = body

  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const updated = await prisma.qcCheckItem.update({
    where: { id: itemId },
    data: {
      actualValue:  data.actualValue  !== undefined ? data.actualValue  : undefined,
      isQualified:  data.isQualified  !== undefined ? data.isQualified  : undefined,
      defectType:   data.defectType   !== undefined ? data.defectType   : undefined,
      defectQty:    data.defectQty    !== undefined ? data.defectQty    : undefined,
      judgment:     data.judgment     !== undefined ? data.judgment     : undefined,
      notes:        data.notes        !== undefined ? data.notes        : undefined,
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/qc/[id]/items?itemId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  await prisma.qcCheckItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
