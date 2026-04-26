import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { generateQuotationNumber } from '@/lib/donghong/quotation-number-generator'
import { BusinessUnit, QuotationStatus } from '@prisma/client'

const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'GM']

function buFilter(role: string): BusinessUnit[] | undefined {
  if (FULL_ACCESS_ROLES.includes(role)) return undefined
  return ['DONGHONG', 'SHARED']
}

// GET /api/donghong/supplier-quotations
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const supplierId      = sp.get('supplierId')      ?? undefined
    const status          = sp.get('status')          as QuotationStatus | null
    const validUntilFrom  = sp.get('validUntilFrom')  ?? undefined
    const validUntilTo    = sp.get('validUntilTo')    ?? undefined
    const page            = Math.max(1, parseInt(sp.get('page')     ?? '1',  10))
    const pageSize        = Math.min(100, parseInt(sp.get('pageSize') ?? '20', 10))

    const allowedBUs = buFilter(session.user.role as string)

    const where = {
      ...(allowedBUs ? { businessUnit: { in: allowedBUs } } : {}),
      ...(supplierId && { supplierId }),
      ...(status     && { status }),
      ...(validUntilFrom || validUntilTo
        ? {
            validUntil: {
              ...(validUntilFrom ? { gte: new Date(validUntilFrom) } : {}),
              ...(validUntilTo   ? { lte: new Date(validUntilTo)   } : {}),
            },
          }
        : {}),
    }

    const [total, data] = await prisma.$transaction([
      prisma.supplierQuotation.count({ where }),
      prisma.supplierQuotation.findMany({
        where,
        include: {
          supplier:  { select: { id: true, name: true, code: true, country: true } },
          items:     { select: { id: true, variantId: true, unitPrice: true, unit: true } },
          _count:    { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.list')
  }
}

// POST /api/donghong/supplier-quotations
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      supplierId:    string
      quotedAt:      string
      validFrom:     string
      validUntil:    string
      currency?:     string
      incoterms?:    string
      paymentTerms?: string
      minOrderQty?:  number
      leadTimeDays?: number
      notes?:        string
      attachmentUrl?: string
    }

    if (!body.supplierId || !body.quotedAt || !body.validFrom || !body.validUntil) {
      return NextResponse.json(
        { error: '必填欄位：supplierId, quotedAt, validFrom, validUntil' },
        { status: 400 },
      )
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: body.supplierId },
      select: { id: true, donghongBusinessUnit: true },
    })
    if (!supplier) return NextResponse.json({ error: '供應商不存在' }, { status: 404 })

    const quotationNumber = await generateQuotationNumber()
    const businessUnit: BusinessUnit =
      (supplier.donghongBusinessUnit as BusinessUnit) ?? 'DONGHONG'

    const quotation = await prisma.supplierQuotation.create({
      data: {
        quotationNumber,
        supplierId:    body.supplierId,
        quotedAt:      new Date(body.quotedAt),
        validFrom:     new Date(body.validFrom),
        validUntil:    new Date(body.validUntil),
        currency:      body.currency     ?? 'CNY',
        incoterms:     body.incoterms    ?? null,
        paymentTerms:  body.paymentTerms ?? null,
        minOrderQty:   body.minOrderQty  ?? null,
        leadTimeDays:  body.leadTimeDays ?? null,
        notes:         body.notes        ?? null,
        attachmentUrl: body.attachmentUrl ?? null,
        status:        'DRAFT',
        businessUnit,
        createdById:   session.user.id,
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(quotation, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.create')
  }
}
