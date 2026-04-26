import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

// POST /api/donghong/supplier-quotations/[id]/items
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const quotation = await prisma.supplierQuotation.findUnique({
      where: { id },
      select: { status: true, supplierId: true },
    })
    if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (quotation.status !== 'DRAFT') {
      return NextResponse.json({ error: '已啟用報價不可新增品項，請建立新版本' }, { status: 400 })
    }

    const body = await req.json() as {
      variantId:   string
      unitPrice:   number
      unit?:       string
      packingSpec?: string | null
      specNotes?:  Record<string, unknown> | null
    }

    if (!body.variantId || body.unitPrice == null) {
      return NextResponse.json({ error: '必填欄位：variantId, unitPrice' }, { status: 400 })
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id: body.variantId },
      select: { id: true, supplierId: true, variantSku: true },
    })
    if (!variant) return NextResponse.json({ error: 'Variant 不存在' }, { status: 404 })

    const warnings: string[] = []
    if (variant.supplierId !== quotation.supplierId) {
      warnings.push(`Variant ${variant.variantSku} 的主要供應商與本報價供應商不同，已允許`)
    }

    const item = await prisma.supplierQuotationItem.create({
      data: {
        quotationId: id,
        variantId:   body.variantId,
        unitPrice:   body.unitPrice,
        unit:        body.unit        ?? 'pc',
        packingSpec: body.packingSpec ?? null,
        specNotes:   body.specNotes != null ? (body.specNotes as Prisma.InputJsonValue) : undefined,
      },
      include: {
        variant: { select: { id: true, variantSku: true, masterSku: true, originCode: true } },
      },
    })

    return NextResponse.json({ item, warnings }, { status: 201 })
  } catch (error) {
    // Unique constraint violation: same variant already in this quotation
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: '此 Variant 已在報價單中' }, { status: 409 })
    }
    return handleApiError(error, 'donghong.supplierQuotations.items.create')
  }
}
