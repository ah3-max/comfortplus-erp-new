/**
 * Unified API Error Handler
 *
 * Production: returns generic message, logs full error server-side
 * Development: returns full error details for debugging
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { PeriodLockedError } from '@/lib/period-guard'

const IS_PROD = process.env.NODE_ENV === 'production'

interface ApiErrorOptions {
  /** HTTP status code */
  status?: number
  /** User-facing error message */
  message?: string
  /** Internal module name for logging */
  module?: string
}

/**
 * Wrap an API handler with standardized error handling.
 *
 * Usage:
 *   export const GET = apiHandler(async (req) => { ... return NextResponse.json(data) })
 */
export function apiHandler(
  handler: (req: Request, context?: unknown) => Promise<Response>,
  opts?: { module?: string },
) {
  return async (req: Request, context?: unknown) => {
    try {
      return await handler(req, context)
    } catch (error) {
      return handleApiError(error, opts?.module)
    }
  }
}

/**
 * Convert any error into a safe NextResponse.
 * Call this inside catch blocks in API routes.
 */
export function handleApiError(error: unknown, module?: string): NextResponse {
  const err = error instanceof Error ? error : new Error(String(error))

  // Always log full error server-side
  logger.error(module ?? 'api', err.message, err)

  // Period locked errors → 423 Locked
  if (error instanceof PeriodLockedError) {
    return NextResponse.json({ error: err.message }, { status: 423 })
  }

  // Prisma-specific errors
  const prismaCode = (error as { code?: string })?.code
  if (prismaCode === 'P2002') {
    return NextResponse.json(
      { error: '資料重複，請確認後再試' },
      { status: 409 },
    )
  }
  if (prismaCode === 'P2025') {
    return NextResponse.json(
      { error: '找不到此資料' },
      { status: 404 },
    )
  }
  if (prismaCode === 'P2003') {
    return NextResponse.json(
      { error: '此資料有關聯資料，無法刪除' },
      { status: 409 },
    )
  }

  // Production: generic message
  if (IS_PROD) {
    return NextResponse.json(
      { error: '伺服器錯誤，請稍後再試' },
      { status: 500 },
    )
  }

  // Development: full error for debugging
  return NextResponse.json(
    {
      error: err.message,
      stack: err.stack,
      module,
    },
    { status: 500 },
  )
}
