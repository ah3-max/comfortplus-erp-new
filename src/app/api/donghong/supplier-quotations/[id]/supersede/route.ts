import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { generateQuotationNumber } from '@/lib/donghong/quotation-number-generator'

type Params = { params: Promise<{ id: string }> }

// POST /api/donghong/supplier-quotations/[id]/supersede
// Creates a new DRAFT version, copies all items, marks old as SUPERSEDED
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const old = await prisma.supplierQuotation.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!old) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (old.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `只有 ACTIVE 狀態的報價可建立新版本，目前為 ${old.status}` },
        { status: 400 },
      )
    }

    const quotationNumber = await generateQuotationNumber()

    const [newQuotation] = await prisma.$transaction([
      prisma.supplierQuotation.create({
        data: {
          quotationNumber,
          supplierId:    old.supplierId,
          quotedAt:      new Date(),
          validFrom:     old.validFrom,
          validUntil:    old.validUntil,
          currency:      old.currency,
          incoterms:     old.incoterms,
          paymentTerms:  old.paymentTerms,
          minOrderQty:   old.minOrderQty,
          leadTimeDays:  old.leadTimeDays,
          notes:         old.notes,
          status:        'DRAFT',
          businessUnit:  old.businessUnit,
          createdById:   session.user.id,
          items: {
            create: old.items.map(item => ({
              variantId:   item.variantId,
              unitPrice:   item.unitPrice,
              unit:        item.unit,
              packingSpec: item.packingSpec,
              specNotes:   item.specNotes ?? undefined,
            })),
          },
        },
        select: { id: true, quotationNumber: true, status: true },
      }),
      prisma.supplierQuotation.update({
        where: { id },
        data: { status: 'SUPERSEDED' },
      }),
    ])

    // Link old → new via supersededById (done as separate update to avoid circular ref at create time)
    await prisma.supplierQuotation.update({
      where: { id },
      data: { supersededById: newQuotation.id },
    })

    return NextResponse.json(newQuotation, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.supersede')
  }
}
