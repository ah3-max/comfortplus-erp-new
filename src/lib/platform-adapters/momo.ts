/**
 * momo 購物 (摩天商城) adapter
 *
 * Required env vars:
 *   MOMO_MERCHANT_ID  - 商家 ID
 *   MOMO_SECRET_KEY   - API Secret Key
 *
 * momo 目前主要透過後台 CSV 匯出，或申請 EDI/API 對接
 * 此 adapter 實作 momo 供應商 API（需申請開通）
 *
 * Docs: https://sellers.momo.com.tw (需登入)
 * 若未開通 API，fallback 為解析 CSV 匯入
 */

import crypto from 'crypto'
import type { PlatformAdapter, PlatformConfig, PlatformOrder } from './types'

const MOMO_BASE = 'https://api.seller.momo.com.tw/v1'

function buildMomoSign(params: Record<string, string>, secretKey: string): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  return crypto.createHmac('sha256', secretKey).update(sorted).digest('hex').toUpperCase()
}

async function momoPost(path: string, body: Record<string, unknown>, config: PlatformConfig) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signBase: Record<string, string> = {
    merchant_id: config.merchantId ?? '',
    timestamp,
  }
  const sign = buildMomoSign(signBase, config.secretKey ?? '')

  const res = await fetch(`${MOMO_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Merchant-ID': config.merchantId ?? '',
      'X-Timestamp': timestamp,
      'X-Sign': sign,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`momo API error: ${res.status}`)
  return res.json()
}

export const MomoAdapter: PlatformAdapter = {
  async fetchOrders(config, lastSyncAt) {
    const result = await momoPost('/orders/search', {
      start_time: lastSyncAt.toISOString(),
      end_time: new Date().toISOString(),
      order_status: ['PAYMENT_SUCCESS', 'SHIPPING'],
      page: 1,
      page_size: 100,
    }, config)

    const rawOrders: Record<string, unknown>[] = result?.data?.orders ?? []
    const orders: PlatformOrder[] = rawOrders.map(o => {
      const items = ((o.items as Record<string, unknown>[]) ?? []).map(i => ({
        platformSku: String(i.sku ?? ''),
        productName: String(i.product_name ?? ''),
        quantity: Number(i.quantity ?? 1),
        unitPrice: Number(i.unit_price ?? 0),
        subtotal: Number(i.subtotal ?? 0),
      }))

      return {
        platformOrderNo: String(o.order_no ?? ''),
        buyerName: String(o.buyer_name ?? '') || null,
        buyerPhone: String(o.buyer_phone ?? '') || null,
        buyerAddress: null,
        recipientName: String(o.recipient_name ?? '') || null,
        recipientPhone: String(o.recipient_phone ?? '') || null,
        recipientAddress: String(o.recipient_address ?? '') || null,
        orderAmount: Number(o.order_amount ?? 0),
        platformFee: Number(o.platform_fee ?? 0) || null,
        shippingFee: Number(o.shipping_fee ?? 0) || null,
        paymentStatus: o.payment_status === 'PAID' ? 'PAID' : 'PENDING',
        deliveryStatus: o.delivery_status === 'SHIPPED' ? 'SHIPPED' : 'PENDING',
        orderedAt: new Date(String(o.ordered_at ?? Date.now())),
        notes: String(o.buyer_message ?? '') || null,
        items,
      }
    })

    return orders
  },
}
