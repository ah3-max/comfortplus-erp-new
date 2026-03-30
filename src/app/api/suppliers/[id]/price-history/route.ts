import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  if (!body.itemName || !body.unitCost || !body.effectiveDate) {
    return NextResponse.json({ error: '請填寫品項名稱、單價、生效日' }, { status: 400 })
  }

  const record = await prisma.supplierPriceHistory.create({
    data: {
      supplierId:    id,
      productId:     body.productId  || null,
      itemName:      body.itemName,
      unitCost:      Number(body.unitCost),
      currency:      body.currency   || 'TWD',
      effectiveDate: new Date(body.effectiveDate),
      notes:         body.notes      || null,
    },
    include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
  })

  return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'supplierPriceHistory.post')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('recordId')
  if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

  await params // consume
  await prisma.supplierPriceHistory.delete({ where: { id: recordId } })
  return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'supplierPriceHistory.delete')
  }
}
