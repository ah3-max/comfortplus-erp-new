/**
 * Simple in-memory rate limiter
 * 60 requests per minute per IP
 *
 * For production with multiple instances, use Redis instead.
 */

const windowMs = 60_000 // 1 minute
const maxRequests = 60

interface RateEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 300_000)

/**
 * Check if a request should be rate limited.
 * Returns null if OK, or a Response if rate limited.
 */
export function checkRateLimit(ip: string): Response | null {
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || entry.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++
  if (entry.count > maxRequests) {
    return new Response(
      JSON.stringify({ error: '請求過於頻繁，請稍後再試' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      },
    )
  }

  return null
}
