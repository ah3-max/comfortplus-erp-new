import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

type Params = { params: Promise<{ id: string }> }

// GET /api/donghong/supplier-quotations/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const quotation = await prisma.supplierQuotation.findUnique({
      where: { id },
      include: {
        supplier:  { select: { id: true, name: true, code: true, country: true } },
        items: {
          include: {
            variant: {
              select: {
                id: true, variantSku: true, masterSku: true, originCode: true,
                masterProduct: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        supersededBy: {
          select: { id: true, quotationNumber: true, status: true, createdAt: true },
        },
        replacedBy: {
          select: { id: true, quotationNumber: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(quotation)
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.get')
  }
}

// PATCH /api/donghong/supplier-quotations/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await prisma.supplierQuotation.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: '已啟用報價不可編輯，請建立新版本' },
        { status: 400 },
      )
    }

    const body = await req.json() as {
      quotedAt?:     string
      validFrom?:    string
      validUntil?:   string
      currency?:     string
      incoterms?:    string | null
      paymentTerms?: string | null
      minOrderQty?:  number | null
      leadTimeDays?: number | null
      notes?:        string | null
      attachmentUrl?: string | null
    }

    const updated = await prisma.supplierQuotation.update({
      where: { id },
      data: {
        ...(body.quotedAt    && { quotedAt:    new Date(body.quotedAt) }),
        ...(body.validFrom   && { validFrom:   new Date(body.validFrom) }),
        ...(body.validUntil  && { validUntil:  new Date(body.validUntil) }),
        ...(body.currency    !== undefined && { currency:     body.currency }),
        ...(body.incoterms   !== undefined && { incoterms:    body.incoterms }),
        ...(body.paymentTerms !== undefined && { paymentTerms: body.paymentTerms }),
        ...(body.minOrderQty  !== undefined && { minOrderQty:  body.minOrderQty }),
        ...(body.leadTimeDays !== undefined && { leadTimeDays: body.leadTimeDays }),
        ...(body.notes        !== undefined && { notes:        body.notes }),
        ...(body.attachmentUrl !== undefined && { attachmentUrl: body.attachmentUrl }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.patch')
  }
}

// DELETE /api/donghong/supplier-quotations/[id]  → soft cancel
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await prisma.supplierQuotation.findUnique({
      where: { id },
      select: { status: true, quotationNumber: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (['CANCELLED', 'SUPERSEDED'].includes(existing.status)) {
      return NextResponse.json({ error: '報價已取消或已被取代，無法再次取消' }, { status: 400 })
    }

    const cancelled = await prisma.supplierQuotation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: { id: true, quotationNumber: true, status: true },
    })

    return NextResponse.json(cancelled)
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.cancel')
  }
}
