import { NextRequest, NextResponse } from 'next/server'

/**
 * Next.js Edge Middleware — runs on every request before route handlers.
 *
 * Responsibilities:
 *   1. Inject X-Request-ID (UUID v4) for request tracing across logs
 *   2. Pass through client-provided X-Request-ID if present
 *
 * The response includes the same X-Request-ID header so frontend/Nginx
 * can correlate requests with server logs.
 */
export function middleware(req: NextRequest) {
  const requestId = req.headers.get('X-Request-ID') || crypto.randomUUID()

  // Clone request headers and inject request ID
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('X-Request-ID', requestId)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Echo back in response for frontend/Nginx correlation
  response.headers.set('X-Request-ID', requestId)

  return response
}

export const config = {
  // Run on all routes except static assets and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/).*)'],
}
