import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/margin/simulate?productId=xxx&unitPrice=150&qty=1000
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const unitPrice = parseFloat(searchParams.get('unitPrice') ?? '0')
  const qty = parseInt(searchParams.get('qty') ?? '1')

  if (!productId || unitPrice <= 0) {
    return NextResponse.json({ error: 'productId and unitPrice required' }, { status: 400 })
  }

  // Get product cost structure
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true, sku: true, name: true,
      costPrice: true, floorPrice: true, minSellPrice: true, sellingPrice: true,
      costStructure: true,
    },
  })

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const cost = product.costStructure
  const costs = {
    factoryCost: Number(cost?.factoryCost ?? product.costPrice ?? 0),
    packagingCost: Number(cost?.packagingCost ?? 0),
    intlLogistics: Number(cost?.intlLogisticsCost ?? 0),
    customs: Number(cost?.customsCost ?? 0),
    storage: Number(cost?.storageCost ?? 0),
    domesticDelivery: Number(cost?.domesticLogisticsCost ?? 0),
    totalCost: Number(cost?.totalCost ?? product.costPrice ?? 0),
  }

  const totalRevenue = unitPrice * qty
  const totalCost = costs.totalCost * qty
  const grossProfit = totalRevenue - totalCost
  const grossMarginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0

  // Warnings
  const warnings: string[] = []
  const minSell = Number(product.minSellPrice ?? 0)
  const floorPrice = Number(product.floorPrice ?? 0)

  if (minSell > 0 && unitPrice < minSell) {
    warnings.push(`低於最低售價 $${minSell}`)
  }
  if (floorPrice > 0 && unitPrice < floorPrice) {
    warnings.push(`低於成本底價 $${floorPrice}，虧錢！`)
  }
  if (unitPrice < costs.totalCost) {
    warnings.push(`低於總成本 $${costs.totalCost}，每片虧 $${(costs.totalCost - unitPrice).toFixed(1)}`)
  }
  if (grossMarginPct < 10) {
    warnings.push(`毛利率 ${grossMarginPct}% 低於 10% 門檻`)
  }
  if (grossMarginPct < 20) {
    warnings.push(`毛利率 ${grossMarginPct}% 低於 20% 建議值`)
  }

  return NextResponse.json({
    product: { id: product.id, sku: product.sku, name: product.name },
    pricing: {
      unitPrice,
      qty,
      totalRevenue,
      sellingPrice: Number(product.sellingPrice),
      minSellPrice: minSell,
      floorPrice,
    },
    costs,
    margin: {
      grossProfit: Math.round(grossProfit),
      grossMarginPct,
      profitPerUnit: Math.round((grossProfit / qty) * 10) / 10,
    },
    warnings,
  })
}
