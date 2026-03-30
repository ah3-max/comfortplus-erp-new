import { ShopeeAdapter } from './shopee'
import { MomoAdapter } from './momo'
import type { PlatformAdapter, PlatformConfig } from './types'

export * from './types'

/** Get adapter + config for a given platform code */
export function getPlatformAdapter(platform: string): PlatformAdapter | null {
  switch (platform.toUpperCase()) {
    case 'SHOPEE': return ShopeeAdapter
    case 'MOMO':   return MomoAdapter
    default:       return null
  }
}

/** Build PlatformConfig from environment variables for a given channel code */
export function buildPlatformConfig(platform: string): PlatformConfig {
  const p = platform.toUpperCase()
  if (p === 'SHOPEE') {
    return {
      partnerId:    process.env.SHOPEE_PARTNER_ID,
      partnerKey:   process.env.SHOPEE_PARTNER_KEY,
      shopId:       process.env.SHOPEE_SHOP_ID,
      accessToken:  process.env.SHOPEE_ACCESS_TOKEN,
    }
  }
  if (p === 'MOMO') {
    return {
      merchantId: process.env.MOMO_MERCHANT_ID,
      secretKey:  process.env.MOMO_SECRET_KEY,
    }
  }
  return {}
}
