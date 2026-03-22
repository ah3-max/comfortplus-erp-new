import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/health — System health check
 * No auth required — used by uptime monitors & load balancers
 */
export async function GET() {
  let dbOk = false
  let dbLatency = 0

  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbLatency = Date.now() - start
    dbOk = true
  } catch { /* db down */ }

  const status = dbOk ? 'ok' : 'error'

  return NextResponse.json(
    {
      status,
      version: '1.0.0',
      db: dbOk,
      dbLatencyMs: dbLatency,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  )
}
