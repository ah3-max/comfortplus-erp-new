import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { handleApiError } from '@/lib/api-error'
import { resolvePrices } from '@/lib/pricing'

/**
 * GET /api/pricing/resolve?customerId=X&productIds=P1,P2,P3
 *
 * Resolve the final price for each product given a customer.
 * Priority: SpecialPrice > CustomerPriceLevel tier > PriceList > Product.sellingPrice
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const productIdsParam = searchParams.get('productIds')

    if (!customerId) return NextResponse.json({ error: '缺少 customerId' }, { status: 400 })
    if (!productIdsParam) return NextResponse.json({ error: '缺少 productIds' }, { status: 400 })

    const productIds = productIdsParam.split(',').filter(Boolean)
    const { prices, priceLevel } = await resolvePrices(customerId, productIds)
    return NextResponse.json({ prices, priceLevel })
  } catch (error) {
    return handleApiError(error, 'pricing.resolve')
  }
}
