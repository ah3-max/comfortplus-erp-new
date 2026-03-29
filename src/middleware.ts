import { NextRequest, NextResponse } from 'next/server'

/**
 * Login rate limiting middleware.
 * Uses in-memory store — works for single-instance standalone deployment.
 * For multi-instance: replace with Redis/KV.
 */
const loginWindowMs = 15 * 60_000
const loginMaxAttempts = 10

interface RateEntry { count: number; resetAt: number }
const loginStore = new Map<string, RateEntry>()

function getClientIp(req: NextRequest): string {
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return '127.0.0.1'
}

export function middleware(req: NextRequest) {
  // Only rate-limit login attempts
  if (req.method === 'POST' && req.nextUrl.pathname === '/api/auth/callback/credentials') {
    const ip = getClientIp(req)
    const now = Date.now()
    const entry = loginStore.get(ip)

    if (!entry || entry.resetAt < now) {
      loginStore.set(ip, { count: 1, resetAt: now + loginWindowMs })
    } else {
      entry.count++
      if (entry.count > loginMaxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        return NextResponse.json(
          { error: '登入嘗試過於頻繁，請 15 分鐘後再試' },
          {
            status: 429,
            headers: { 'Retry-After': String(retryAfter) },
          }
        )
      }
    }

    // Cleanup old entries lazily
    if (loginStore.size > 10_000) {
      for (const [key, e] of loginStore) {
        if (e.resetAt < now) loginStore.delete(key)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/auth/callback/credentials',
}
