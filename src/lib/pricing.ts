/**
 * pricing.ts — 中央價格解析器
 *
 * 給定 customerId + productIds，回傳每項商品應套用的成交價。
 * 優先序：SpecialPrice > CustomerPriceLevel+Tier > PriceList > Product.sellingPrice
 *
 * 同時是 /api/pricing/resolve 與 AI skill / 後台批次邏輯的單一資料來源。
 */
import { prisma } from '@/lib/prisma'

export type PriceSource = 'SPECIAL' | 'TIER' | 'LIST' | 'DEFAULT'

export interface ResolvedPrice {
  price: number
  source: PriceSource
  priceLevel?: string
}

export interface ResolveResult {
  prices: Record<string, ResolvedPrice>
  priceLevel: string | null
}

export async function resolvePrices(customerId: string, productIds: string[]): Promise<ResolveResult> {
  if (productIds.length === 0) return { prices: {}, priceLevel: null }
  const now = new Date()

  const [specialPrices, customerLevel, priceTiers, priceLists, products] = await Promise.all([
    prisma.specialPrice.findMany({
      where: {
        customerId,
        productId: { in: productIds },
        effectiveDate: { lte: now },
        OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
      },
      select: { productId: true, price: true },
    }),
    prisma.customerPriceLevel.findUnique({
      where: { customerId },
      select: { priceLevel: true },
    }),
    prisma.productPriceTier.findMany({
      where: { productId: { in: productIds } },
    }),
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
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sellingPrice: true },
    }),
  ])

  const specialMap = new Map(specialPrices.map(sp => [sp.productId, Number(sp.price)]))
  const level = customerLevel?.priceLevel ?? null
  const tierMap = new Map(priceTiers.map(t => [t.productId, t]))

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
  const prices: Record<string, ResolvedPrice> = {}

  for (const pid of productIds) {
    const special = specialMap.get(pid)
    if (special != null && special > 0) {
      prices[pid] = { price: special, source: 'SPECIAL' }
      continue
    }
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
    const listPrice = priceListMap.get(pid)
    if (listPrice != null && listPrice > 0) {
      prices[pid] = { price: listPrice, source: 'LIST' }
      continue
    }
    prices[pid] = { price: defaultMap.get(pid) ?? 0, source: 'DEFAULT' }
  }

  return { prices, priceLevel: level }
}
