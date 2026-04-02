import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const channel    = searchParams.get('channel')    ?? ''
    const competitor = searchParams.get('competitor') ?? ''
    const dateFrom   = searchParams.get('dateFrom')   ?? ''
    const dateTo     = searchParams.get('dateTo')     ?? ''
    const page       = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize   = 50

    const where = {
      ...(channel    && { channel }),
      ...(competitor && { competitor }),
      ...((dateFrom || dateTo) && {
        recordDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo) }),
        },
      }),
    }

    const [data, total] = await prisma.$transaction([
      prisma.competitorPrice.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: [{ recordDate: 'desc' }, { channel: 'asc' }, { competitor: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.competitorPrice.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'competitor-prices.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.recordDate || !body.channel || !body.competitor || !body.productName || !body.unitPrice) {
      return NextResponse.json({ error: '請填寫日期、通路、競品、商品名稱與單價' }, { status: 400 })
    }

    const record = await prisma.competitorPrice.create({
      data: {
        recordDate:    new Date(body.recordDate),
        channel:       body.channel,
        competitor:    body.competitor,
        productName:   body.productName,
        sku:           body.sku           || null,
        spec:          body.spec          || null,
        unitPrice:     Number(body.unitPrice),
        originalPrice: body.originalPrice ? Number(body.originalPrice) : null,
        promoNote:     body.promoNote     || null,
        isOnShelf:     body.isOnShelf !== false,
        sourceUrl:     body.sourceUrl     || null,
        notes:         body.notes         || null,
        createdById:   session.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'competitor-prices.create')
  }
}
