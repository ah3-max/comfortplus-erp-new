import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/customers/[id]/demand-forecast
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: customerId } = await params
    const forecast = await prisma.customerDemandForecast.findUnique({ where: { customerId } })
    return NextResponse.json(forecast ?? null)
  } catch (error) {
    return handleApiError(error, 'customers.demandForecast.get')
  }
}

// PUT /api/customers/[id]/demand-forecast — upsert + optional sync from usage profile
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: customerId } = await params
    const body = await req.json()

    const num  = (v: unknown) => (v !== undefined && v !== '' && v !== null ? Number(v) : null)
    const str  = (v: unknown) => (v !== undefined && v !== '' ? String(v) : null)
    const date = (v: unknown) => (v ? new Date(v as string) : null)

    // If syncFromUsage=true, pull daily quantities from usage profile
    let syncedDaily: Record<string, number | null> = {}
    if (body.syncFromUsage) {
      const up = await prisma.customerUsageProfile.findUnique({ where: { customerId } })
      if (up) {
        syncedDaily = {
          dailyDiaperLargeQty: up.dailyDiaperLargeQty,
          dailyDiaperSmallQty: up.dailyDiaperSmallQty,
          dailyUnderpadsQty:   up.dailyUnderpadsQty,
          dailyWipesQty:       up.dailyWipesQty,
          monthlyDiaperLargeQty: up.monthlyDiaperLargeQty,
          monthlyDiaperSmallQty: up.monthlyDiaperSmallQty,
          monthlyUnderpadsQty:   up.monthlyUnderpadsQty,
          monthlyWipesQty:       up.monthlyWipesQty,
        }
      }
    }

    const dailyLarge = num(body.dailyDiaperLargeQty) ?? syncedDaily.dailyDiaperLargeQty ?? null
    const dailySmall = num(body.dailyDiaperSmallQty) ?? syncedDaily.dailyDiaperSmallQty ?? null
    const dailyUnder = num(body.dailyUnderpadsQty)   ?? syncedDaily.dailyUnderpadsQty   ?? null
    const dailyWipes = num(body.dailyWipesQty)       ?? syncedDaily.dailyWipesQty       ?? null

    const data = {
      forecastMonth: body.forecastMonth ? new Date(body.forecastMonth) : undefined,

      dailyDiaperLargeQty: dailyLarge,
      dailyDiaperSmallQty: dailySmall,
      dailyUnderpadsQty:   dailyUnder,
      dailyWipesQty:       dailyWipes,

      // Monthly: use explicit value, else auto-calc from daily × 30
      monthlyDiaperLargeQty: num(body.monthlyDiaperLargeQty) ?? (dailyLarge !== null ? dailyLarge * 30 : null),
      monthlyDiaperSmallQty: num(body.monthlyDiaperSmallQty) ?? (dailySmall !== null ? dailySmall * 30 : null),
      monthlyUnderpadsQty:   num(body.monthlyUnderpadsQty)   ?? (dailyUnder !== null ? dailyUnder * 30 : null),
      monthlyWipesQty:       num(body.monthlyWipesQty)       ?? (dailyWipes !== null ? dailyWipes * 30 : null),

      orderFrequency:        str(body.orderFrequency)        as never ?? null,
      avgOrderQty:           num(body.avgOrderQty),
      nextExpectedOrderDate: date(body.nextExpectedOrderDate),
      forecastConfidence:    str(body.forecastConfidence)    as never ?? null,
      notes:                 str(body.notes),
    }

    const forecast = await prisma.customerDemandForecast.upsert({
      where:  { customerId },
      create: { id: crypto.randomUUID(), customerId, ...data },
      update: data,
    })

    return NextResponse.json(forecast)
  } catch (error) {
    return handleApiError(error, 'customers.demandForecast.upsert')
  }
}
