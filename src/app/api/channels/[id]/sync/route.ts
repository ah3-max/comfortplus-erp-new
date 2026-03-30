import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPlatformAdapter, buildPlatformConfig } from '@/lib/platform-adapters'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/channels/[id]/sync
 * 從電商平台拉取新訂單並寫入 ChannelOrder
 *
 * Supported platforms: SHOPEE, MOMO
 * Requires env vars per platform (see platform adapter files)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'ECOMMERCE'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params

    const channel = await prisma.salesChannel.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, platform: true, isActive: true },
    })
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    if (!channel.isActive) return NextResponse.json({ error: 'Channel is inactive' }, { status: 400 })

    const adapter = getPlatformAdapter(channel.platform)
    if (!adapter) {
      return NextResponse.json({
        error: `Platform ${channel.platform} does not support API sync. Please import orders manually.`,
        supported: false,
      }, { status: 422 })
    }

    const config = buildPlatformConfig(channel.platform)
    // Check required credentials
    if (channel.platform === 'SHOPEE' && (!config.partnerId || !config.partnerKey || !config.accessToken)) {
      return NextResponse.json({
        error: 'Shopee credentials not configured. Set SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, SHOPEE_SHOP_ID, SHOPEE_ACCESS_TOKEN in environment.',
        missingCredentials: true,
      }, { status: 422 })
    }
    if (channel.platform === 'MOMO' && (!config.merchantId || !config.secretKey)) {
      return NextResponse.json({
        error: 'momo credentials not configured. Set MOMO_MERCHANT_ID and MOMO_SECRET_KEY in environment.',
        missingCredentials: true,
      }, { status: 422 })
    }

    // Find last synced order to determine time range
    const lastOrder = await prisma.channelOrder.findFirst({
      where: { channelId: id },
      orderBy: { orderedAt: 'desc' },
      select: { orderedAt: true },
    })
    const lastSyncAt = lastOrder?.orderedAt
      ? new Date(lastOrder.orderedAt.getTime() - 60_000) // 1 min overlap
      : new Date(Date.now() - 7 * 86_400_000) // default: last 7 days

    // Pull orders from platform
    const platformOrders = await adapter.fetchOrders(config, lastSyncAt)
    if (!platformOrders.length) {
      return NextResponse.json({ synced: 0, skipped: 0, message: '沒有新訂單' })
    }

    // Fetch products for SKU matching
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, sellingPrice: true },
    })
    // Direct SKU map (case-insensitive)
    const directSkuMap = new Map(products.map(p => [p.sku.toLowerCase(), p]))

    // Platform SKU mapping table (highest priority)
    const skuMappings = await prisma.productSkuMapping.findMany({
      where: {
        platform: channel.platform,
        isActive: true,
        OR: [{ channelId: id }, { channelId: null }],
      },
      select: { platformSku: true, productId: true, channelId: true },
      orderBy: { channelId: 'desc' }, // channel-specific takes priority over global
    })
    // Build: platformSku → productId (channel-specific overrides global)
    const mappingMap = new Map<string, string>()
    for (const m of skuMappings) {
      if (!mappingMap.has(m.platformSku.toLowerCase())) {
        mappingMap.set(m.platformSku.toLowerCase(), m.productId)
      }
    }

    let synced = 0; let skipped = 0
    const unmatchedSkus: string[] = []

    for (const po of platformOrders) {
      // Skip if already imported
      const exists = await prisma.channelOrder.findFirst({
        where: { channelId: id, channelOrderNo: po.platformOrderNo },
        select: { id: true },
      })
      if (exists) { skipped++; continue }

      // Build items: mapping table first, then direct SKU match, then skip with warning
      const itemsData = po.items.map(item => {
        const key = item.platformSku.toLowerCase()
        const productId = mappingMap.get(key) ?? directSkuMap.get(key)?.id ?? null
        if (!productId) unmatchedSkus.push(item.platformSku)
        return {
          platformSku: item.platformSku,
          productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        }
      }).filter(i => i.productId !== null) as { platformSku: string; productId: string; quantity: number; unitPrice: number; subtotal: number }[]

      if (!itemsData.length) { skipped++; continue }

      await prisma.channelOrder.create({
        data: {
          channelId: id,
          channelOrderNo: po.platformOrderNo,
          buyerName: po.buyerName,
          buyerPhone: po.buyerPhone,
          buyerAddress: po.buyerAddress,
          recipientName: po.recipientName,
          recipientPhone: po.recipientPhone,
          recipientAddress: po.recipientAddress,
          orderAmount: po.orderAmount,
          platformFee: po.platformFee,
          shippingFee: po.shippingFee,
          netAmount: po.orderAmount - (po.platformFee ?? 0) - (po.shippingFee ?? 0),
          paymentStatus: po.paymentStatus,
          deliveryStatus: po.deliveryStatus,
          orderedAt: po.orderedAt,
          notes: po.notes,
          items: { create: itemsData },
        },
      })
      synced++
    }

    // Deduplicate unmatched SKUs
    const uniqueUnmatched = [...new Set(unmatchedSkus)]

    return NextResponse.json({
      synced,
      skipped,
      total: platformOrders.length,
      message: `同步完成：${synced} 筆新訂單，${skipped} 筆已存在`,
      ...(uniqueUnmatched.length > 0 && {
        warnings: [`以下 ${uniqueUnmatched.length} 個平台 SKU 找不到對應商品，相關明細已略過：${uniqueUnmatched.join('、')}。請至商品管理設定 SKU 對照表。`],
        unmatchedSkus: uniqueUnmatched,
      }),
    })
  } catch (e) {
    return handleApiError(e, 'channels.sync')
  }
}
