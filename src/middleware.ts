import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware: Rate limiting for API routes
 *
 * Simple in-memory counter per IP.
 * Edge runtime compatible (no Node.js APIs).
 */

const windowMs = 60_000
const maxRequests = 120 // generous limit

const store = new Map<string, { count: number; resetAt: number }>()

export function middleware(req: NextRequest) {
  // Only rate-limit API routes
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip auth endpoint
  if (req.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || entry.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return NextResponse.next()
  }

  entry.count++
  if (entry.count > maxRequests) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) },
      },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
