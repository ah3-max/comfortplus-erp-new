import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { toTwd } from '@/lib/donghong/currency-converter'

// GET /api/donghong/supplier-quotations/compare?variantId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const variantId = new URL(req.url).searchParams.get('variantId')
    if (!variantId) {
      return NextResponse.json({ error: '必填 query param: variantId' }, { status: 400 })
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true, variantSku: true, masterSku: true, originCode: true, countryOrigin: true,
        masterProduct: { select: { id: true, name: true } },
      },
    })
    if (!variant) return NextResponse.json({ error: 'Variant 不存在' }, { status: 404 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const activeItems = await prisma.supplierQuotationItem.findMany({
      where: {
        variantId,
        quotation: {
          status:    'ACTIVE',
          validUntil: { gte: today },
        },
      },
      include: {
        quotation: {
          select: {
            id: true, quotationNumber: true, validUntil: true,
            leadTimeDays: true, minOrderQty: true, currency: true,
            incoterms: true, paymentTerms: true,
            supplier: { select: { id: true, name: true, code: true, country: true } },
          },
        },
      },
      orderBy: { unitPrice: 'asc' },
    })

    if (activeItems.length === 0) {
      return NextResponse.json({
        variant,
        items: [],
        summary: { lowestPriceTwd: null, highestPriceTwd: null, averagePriceTwd: null, supplierCount: 0 },
      })
    }

    // Build TWD-converted items
    const itemsWithTwd = activeItems.map(item => ({
      supplier:     item.quotation.supplier,
      quotation: {
        id:             item.quotation.id,
        quotationNumber: item.quotation.quotationNumber,
        validUntil:     item.quotation.validUntil,
        leadTimeDays:   item.quotation.leadTimeDays,
        minOrderQty:    item.quotation.minOrderQty,
        incoterms:      item.quotation.incoterms,
        paymentTerms:   item.quotation.paymentTerms,
      },
      unitPrice:    Number(item.unitPrice),
      currency:     item.quotation.currency,
      unitPriceTwd: toTwd(Number(item.unitPrice), item.quotation.currency),
    }))

    // Sort by TWD price ascending
    itemsWithTwd.sort((a, b) => a.unitPriceTwd - b.unitPriceTwd)

    const lowestPriceTwd  = itemsWithTwd[0].unitPriceTwd
    const highestPriceTwd = itemsWithTwd[itemsWithTwd.length - 1].unitPriceTwd
    const averagePriceTwd = Math.round(
      (itemsWithTwd.reduce((s, i) => s + i.unitPriceTwd, 0) / itemsWithTwd.length) * 100,
    ) / 100

    const items = itemsWithTwd.map(item => ({
      ...item,
      delta_pct: lowestPriceTwd === 0
        ? 0
        : Math.round(((item.unitPriceTwd - lowestPriceTwd) / lowestPriceTwd) * 10000) / 100,
      is_lowest: item.unitPriceTwd === lowestPriceTwd,
    }))

    const supplierCount = new Set(items.map(i => i.supplier.id)).size

    return NextResponse.json({
      variant,
      items,
      summary: { lowestPriceTwd, highestPriceTwd, averagePriceTwd, supplierCount },
    })
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.compare')
  }
}
