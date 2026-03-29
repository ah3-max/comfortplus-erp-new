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

// Login-specific rate limiter: 10 attempts per 15 minutes per IP
const LOGIN_WINDOW = 15 * 60_000
const LOGIN_MAX = 10
const loginStore = new Map<string, { count: number; resetAt: number }>()

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

  // ── Login rate limiting ──
  if (req.method === 'POST' && pathname === '/api/auth/callback/credentials') {
    const ip = req.headers.get('cf-connecting-ip')
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const now = Date.now()
    const entry = loginStore.get(ip)
    if (!entry || entry.resetAt < now) {
      loginStore.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW })
    } else {
      entry.count++
      if (entry.count > LOGIN_MAX) {
        return NextResponse.json(
          { error: '登入嘗試過於頻繁，請 15 分鐘後再試' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } },
        )
      }
    }
  }

  // ── Skip auth redirect for /api/auth/* ──
  if (pathname.startsWith('/api/auth/')) {
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
