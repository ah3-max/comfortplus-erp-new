import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { quotationScope, buildScopeContext } from '@/lib/scope'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    // Data scope: SALES/CS only see their own quotations
    const scope = quotationScope(buildScopeContext(session as { user: { id: string; role: string } }))

    const where = {
      ...scope,
      ...(search && {
        OR: [
          { quotationNo: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(status && { status: status as never }),
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.quotation.count({ where }),
    ])

    return NextResponse.json({
      data: quotations,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'quotations.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    if (!body.customerId || !body.items?.length) {
      return NextResponse.json({ error: '請選擇客戶並至少新增一項商品' }, { status: 400 })
    }

    const quotationNo = await generateSequenceNo('QUOTATION')

    const totalAmount = body.items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number; discount: number }) =>
        sum + item.quantity * item.unitPrice * (1 - item.discount / 100),
      0
    )

    // 取得商品資料用於快照
    const productIds = body.items.map((i: { productId: string }) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true, specification: true, unit: true, costPrice: true, minSellPrice: true },
    })
    const productMap = Object.fromEntries(products.map(p => [p.id, p]))

    // 檢查是否需要審批（任一品項低於最低售價）
    let needsApproval = false
    for (const item of body.items as { productId: string; unitPrice: number }[]) {
      const p = productMap[item.productId]
      if (p?.minSellPrice && item.unitPrice < Number(p.minSellPrice)) {
        needsApproval = true
        break
      }
    }

    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        customerId:        body.customerId,
        customerContactId: body.customerContactId || null,
        createdById:       session.user.id,
        status:            'DRAFT',
        version:           body.version       ?? 1,
        validUntil:        body.validUntil    ? new Date(body.validUntil) : null,
        totalAmount,
        currency:          body.currency      ?? 'TWD',
        taxType:           body.taxType       || null,
        paymentTerm:       body.paymentTerm   || null,
        deliveryTerm:      body.deliveryTerm  || null,
        requiresApproval:  needsApproval,
        notes:             body.notes         || null,
        items: {
          create: (body.items as {
            productId: string; quantity: number; unitPrice: number; discount: number; notes?: string
          }[]).map(item => {
            const p = productMap[item.productId]
            const subtotal = item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100)
            const cost = p ? Number(p.costPrice) * item.quantity : 0
            const margin = subtotal - cost
            return {
              productId:       item.productId,
              productNameSnap: p?.name    || null,
              skuSnap:         p?.sku     || null,
              specSnap:        p?.specification || null,
              unit:            p?.unit    || null,
              quantity:        item.quantity,
              unitPrice:       item.unitPrice,
              discount:        item.discount ?? 0,
              subtotal,
              costSnap:        p ? Number(p.costPrice) : null,
              grossMargin:     margin,
              grossMarginRate: subtotal > 0 ? Math.round((margin / subtotal) * 10000) / 100 : null,
              notes:           item.notes || null,
            }
          }),
        },
      },
      include: {
        customer: { select: { name: true } },
        items: true,
      },
    })

    return NextResponse.json(quotation, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'quotations.create')
  }
}
