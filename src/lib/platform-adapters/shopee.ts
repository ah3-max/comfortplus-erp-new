/**
 * Shopee Open Platform adapter
 *
 * Required env vars:
 *   SHOPEE_PARTNER_ID     - Partner ID from Shopee Open Platform
 *   SHOPEE_PARTNER_KEY    - Partner Key
 *   SHOPEE_SHOP_ID        - Shop ID
 *   SHOPEE_ACCESS_TOKEN   - OAuth2 access token (refreshed separately)
 *
 * Docs: https://open.shopee.com/documents
 * API Base: https://partner.shopeemobile.com/api/v2
 */

import crypto from 'crypto'
import type { PlatformAdapter, PlatformConfig, PlatformOrder } from './types'

const SHOPEE_BASE = 'https://partner.shopeemobile.com/api/v2'

function buildSignature(path: string, timestamp: number, config: PlatformConfig): string {
  const baseStr = `${config.partnerId}${path}${timestamp}${config.accessToken}${config.shopId}`
  return crypto.createHmac('sha256', config.partnerKey ?? '').update(baseStr).digest('hex')
}

function buildHeaders() {
  return { 'Content-Type': 'application/json' }
}

async function shopeeGet(path: string, query: Record<string, string | number>, config: PlatformConfig) {
  const timestamp = Math.floor(Date.now() / 1000)
  const sign = buildSignature(path, timestamp, config)
  const params = new URLSearchParams({
    partner_id: String(config.partnerId ?? ''),
    timestamp: String(timestamp),
    access_token: config.accessToken ?? '',
    shop_id: String(config.shopId ?? ''),
    sign,
    ...Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])),
  })
  const res = await fetch(`${SHOPEE_BASE}${path}?${params}`, { headers: buildHeaders() })
  if (!res.ok) throw new Error(`Shopee API error: ${res.status}`)
  return res.json()
}

export const ShopeeAdapter: PlatformAdapter = {
  async fetchOrders(config, lastSyncAt) {
    const timeFrom = Math.floor(lastSyncAt.getTime() / 1000)
    const timeTo = Math.floor(Date.now() / 1000)

    // Step 1: Get order list
    const listResult = await shopeeGet('/order/get_order_list', {
      time_range_field: 'create_time',
      time_from: timeFrom,
      time_to: timeTo,
      page_size: 50,
      order_status: 'READY_TO_SHIP',
    }, config)

    const orderList: { order_sn: string }[] = listResult?.response?.order_list ?? []
    if (!orderList.length) return []

    const orderSns = orderList.map(o => o.order_sn)

    // Step 2: Get order details
    const detailResult = await shopeeGet('/order/get_order_detail', {
      order_sn_list: orderSns.join(','),
      response_optional_fields: 'buyer_info,recipient_address,item_list,payment_method,total_amount,actual_shipping_fee',
    }, config)

    const orders: PlatformOrder[] = []
    for (const o of (detailResult?.response?.order_list ?? [])) {
      const buyer = o.buyer_info ?? {}
      const recipient = o.recipient_address ?? {}
      const items = (o.item_list ?? []).map((i: Record<string, unknown>) => ({
        platformSku: String(i.item_sku ?? i.model_sku ?? ''),
        productName: String(i.item_name ?? ''),
        quantity: Number(i.model_quantity_purchased ?? 1),
        unitPrice: Number(i.model_discounted_price ?? 0),
        subtotal: Number(i.model_quantity_purchased ?? 1) * Number(i.model_discounted_price ?? 0),
      }))

      orders.push({
        platformOrderNo: o.order_sn,
        buyerName: buyer.username ?? null,
        buyerPhone: buyer.buyer_phone_number ?? null,
        buyerAddress: null,
        recipientName: recipient.name ?? null,
        recipientPhone: recipient.phone ?? null,
        recipientAddress: [recipient.city, recipient.district, recipient.state, recipient.region, recipient.zip].filter(Boolean).join(' ') || null,
        orderAmount: Number(o.total_amount ?? 0),
        platformFee: null,
        shippingFee: Number(o.actual_shipping_fee ?? 0),
        paymentStatus: o.payment_method ? 'PAID' : 'PENDING',
        deliveryStatus: 'PENDING',
        orderedAt: new Date((o.create_time ?? 0) * 1000),
        notes: o.message_to_seller ?? null,
        items,
      })
    }

    return orders
  },
}
