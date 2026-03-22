import { auth } from '@/auth'
import { NextResponse } from 'next/server'

/**
 * Proxy (Next.js 16) — auth redirect + API rate limiting
 *
 * Rate limit: 120 requests/min per IP on /api/* routes
 */

const RATE_WINDOW = 60_000
const RATE_MAX = 120
const rateStore = new Map<string, { count: number; resetAt: number }>()

export default auth((req) => {
  const pathname = req.nextUrl.pathname

  // ── API rate limiting ──
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const now = Date.now()
    const entry = rateStore.get(ip)

    if (!entry || entry.resetAt < now) {
      rateStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    } else {
      entry.count++
      if (entry.count > RATE_MAX) {
        return NextResponse.json(
          { error: '請求過於頻繁，請稍後再試' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } },
        )
      }
    }
    // API routes: don't redirect, just pass through after rate check
    return NextResponse.next()
  }

  // ── Auth redirect (non-API) ──
  const isLoggedIn = !!req.auth
  const isLoginPage = pathname === '/login'

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
