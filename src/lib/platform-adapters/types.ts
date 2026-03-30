/** Normalized order from any external platform */
export interface PlatformOrder {
  platformOrderNo: string
  buyerName: string | null
  buyerPhone: string | null
  buyerAddress: string | null
  recipientName: string | null
  recipientPhone: string | null
  recipientAddress: string | null
  orderAmount: number
  platformFee: number | null
  shippingFee: number | null
  paymentStatus: string
  deliveryStatus: string
  orderedAt: Date
  notes: string | null
  items: PlatformOrderItem[]
}

export interface PlatformOrderItem {
  /** Platform's own SKU/model id — used to match our Product */
  platformSku: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface PlatformAdapter {
  /** Pull new orders since lastSyncAt */
  fetchOrders(config: PlatformConfig, lastSyncAt: Date): Promise<PlatformOrder[]>
}

export interface PlatformConfig {
  partnerId?: string
  partnerKey?: string
  shopId?: string
  accessToken?: string
  refreshToken?: string
  /** momo-specific */
  merchantId?: string
  secretKey?: string
}
