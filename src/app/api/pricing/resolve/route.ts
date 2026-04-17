import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

interface ResolvedPrice {
  price: number
  source: 'SPECIAL' | 'TIER' | 'LIST' | 'DEFAULT'
  priceLevel?: string
}

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

    if (!customerId) {
      return NextResponse.json({ error: '缺少 customerId' }, { status: 400 })
    }
    if (!productIdsParam) {
      return NextResponse.json({ error: '缺少 productIds' }, { status: 400 })
    }

    const productIds = productIdsParam.split(',').filter(Boolean)
    if (productIds.length === 0) {
      return NextResponse.json({ prices: {} })
    }

    const now = new Date()

    // Batch-fetch all data in parallel
    const [specialPrices, customerLevel, priceTiers, priceLists, products] = await Promise.all([
      // 1. Special prices for this customer × requested products
      prisma.specialPrice.findMany({
        where: {
          customerId,
          productId: { in: productIds },
          effectiveDate: { lte: now },
          OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
        },
        select: { productId: true, price: true },
      }),

      // 2. Customer price level
      prisma.customerPriceLevel.findUnique({
        where: { customerId },
        select: { priceLevel: true },
      }),

      // 3. Product price tiers for requested products
      prisma.productPriceTier.findMany({
        where: { productId: { in: productIds } },
      }),

      // 4. Active price lists for this customer (or matching customer type)
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { type: true },
      }).then(async (customer) => {
        if (!customer) return []
        return prisma.priceList.findMany({
          where: {
            isActive: true,
            effectiveDate: { lte: now },
            OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
            AND: [
              {
                OR: [
                  { customerId },
                  { customerId: null, customerType: customer.type },
                  { customerId: null, customerType: null },
                ],
              },
            ],
          },
          include: {
            items: {
              where: { productId: { in: productIds } },
              select: { productId: true, specialPrice: true, standardPrice: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      }),

      // 5. Default selling prices
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sellingPrice: true },
      }),
    ])

    // Build lookup maps
    const specialMap = new Map(specialPrices.map(sp => [sp.productId, Number(sp.price)]))

    const level = customerLevel?.priceLevel ?? null
    const tierMap = new Map(priceTiers.map(t => [t.productId, t]))

    // PriceList items: first match wins (most specific list first — customerId > customerType > all)
    const priceListMap = new Map<string, number>()
    for (const list of priceLists) {
      for (const item of list.items) {
        if (!priceListMap.has(item.productId)) {
          const p = item.specialPrice ? Number(item.specialPrice) : Number(item.standardPrice)
          if (p > 0) priceListMap.set(item.productId, p)
        }
      }
    }

    const defaultMap = new Map(products.map(p => [p.id, Number(p.sellingPrice ?? 0)]))

    // Resolve each product
    const prices: Record<string, ResolvedPrice> = {}

    for (const pid of productIds) {
      // Priority 1: SpecialPrice
      const special = specialMap.get(pid)
      if (special != null && special > 0) {
        prices[pid] = { price: special, source: 'SPECIAL' }
        continue
      }

      // Priority 2: CustomerPriceLevel tier
      if (level) {
        const tier = tierMap.get(pid)
        if (tier) {
          const tierKey = `price${level}` as keyof typeof tier
          const tierPrice = tier[tierKey]
          if (tierPrice != null && Number(tierPrice) > 0) {
            prices[pid] = { price: Number(tierPrice), source: 'TIER', priceLevel: level }
            continue
          }
        }
      }

      // Priority 3: PriceList
      const listPrice = priceListMap.get(pid)
      if (listPrice != null && listPrice > 0) {
        prices[pid] = { price: listPrice, source: 'LIST' }
        continue
      }

      // Priority 4: Default selling price
      prices[pid] = { price: defaultMap.get(pid) ?? 0, source: 'DEFAULT' }
    }

    return NextResponse.json({ prices, priceLevel: level })
  } catch (error) {
    return handleApiError(error, 'pricing.resolve')
  }
}
