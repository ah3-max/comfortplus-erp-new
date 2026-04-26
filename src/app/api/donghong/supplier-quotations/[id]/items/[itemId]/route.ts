import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ id: string; itemId: string }> }

// PATCH /api/donghong/supplier-quotations/[id]/items/[itemId]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, itemId } = await params

    const quotation = await prisma.supplierQuotation.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    if (quotation.status !== 'DRAFT') {
      return NextResponse.json({ error: '已啟用報價不可修改品項，請建立新版本' }, { status: 400 })
    }

    const item = await prisma.supplierQuotationItem.findUnique({
      where: { id: itemId },
      select: { quotationId: true },
    })
    if (!item || item.quotationId !== id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await req.json() as {
      unitPrice?:   number
      unit?:        string
      packingSpec?: string | null
      specNotes?:   Record<string, unknown> | null
    }

    const updated = await prisma.supplierQuotationItem.update({
      where: { id: itemId },
      data: {
        ...(body.unitPrice   !== undefined && { unitPrice:   body.unitPrice }),
        ...(body.unit        !== undefined && { unit:        body.unit }),
        ...(body.packingSpec !== undefined && { packingSpec: body.packingSpec }),
        ...(body.specNotes !== undefined && {
          specNotes: body.specNotes != null ? (body.specNotes as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
      },
      include: {
        variant: { select: { id: true, variantSku: true, masterSku: true, originCode: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.items.patch')
  }
}

// DELETE /api/donghong/supplier-quotations/[id]/items/[itemId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, itemId } = await params

    const quotation = await prisma.supplierQuotation.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    if (quotation.status !== 'DRAFT') {
      return NextResponse.json({ error: '已啟用報價不可刪除品項，請建立新版本' }, { status: 400 })
    }

    const item = await prisma.supplierQuotationItem.findUnique({
      where: { id: itemId },
      select: { quotationId: true },
    })
    if (!item || item.quotationId !== id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await prisma.supplierQuotationItem.delete({ where: { id: itemId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.items.delete')
  }
}
