'use client'

import { useState, useCallback, useRef } from 'react'

interface ResolvedPrice {
  price: number
  source: 'SPECIAL' | 'TIER' | 'LIST' | 'DEFAULT'
  priceLevel?: string
}

interface PriceResolverResult {
  prices: Record<string, ResolvedPrice>
  priceLevel: string | null
  loading: boolean
  resolvePrice: (productId: string) => Promise<ResolvedPrice | null>
  resolvePrices: (productIds: string[]) => Promise<Record<string, ResolvedPrice>>
  clearCache: () => void
}

/**
 * Hook to resolve customer-specific prices.
 * Caches results per customer; clears when customerId changes.
 */
export function usePriceResolver(customerId: string | null): PriceResolverResult {
  const [prices, setPrices] = useState<Record<string, ResolvedPrice>>({})
  const [priceLevel, setPriceLevel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<Record<string, ResolvedPrice>>({})
  const lastCustomerRef = useRef<string | null>(null)

  // Reset cache when customer changes
  if (customerId !== lastCustomerRef.current) {
    lastCustomerRef.current = customerId
    cacheRef.current = {}
    // Don't call setPrices here to avoid render loop — it'll update on next resolve
  }

  const resolvePrices = useCallback(async (productIds: string[]): Promise<Record<string, ResolvedPrice>> => {
    if (!customerId || productIds.length === 0) return {}

    // Filter out already-cached IDs
    const uncached = productIds.filter(id => !(id in cacheRef.current))

    if (uncached.length > 0) {
      setLoading(true)
      try {
        const res = await fetch(`/api/pricing/resolve?customerId=${customerId}&productIds=${uncached.join(',')}`)
        if (res.ok) {
          const data = await res.json()
          // Merge into cache
          Object.assign(cacheRef.current, data.prices ?? {})
          if (data.priceLevel) setPriceLevel(data.priceLevel)
        }
      } finally {
        setLoading(false)
      }
    }

    // Build result from cache
    const result: Record<string, ResolvedPrice> = {}
    for (const pid of productIds) {
      if (cacheRef.current[pid]) result[pid] = cacheRef.current[pid]
    }
    setPrices(prev => ({ ...prev, ...result }))
    return result
  }, [customerId])

  const resolvePrice = useCallback(async (productId: string): Promise<ResolvedPrice | null> => {
    const result = await resolvePrices([productId])
    return result[productId] ?? null
  }, [resolvePrices])

  const clearCache = useCallback(() => {
    cacheRef.current = {}
    setPrices({})
    setPriceLevel(null)
  }, [])

  return { prices, priceLevel, loading, resolvePrice, resolvePrices, clearCache }
}
