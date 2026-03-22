import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/customers/[id]/usage-profile
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: customerId } = await params
  const profile = await prisma.customerUsageProfile.findUnique({ where: { customerId } })
  return NextResponse.json(profile ?? null)
}

// PUT /api/customers/[id]/usage-profile — upsert
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: customerId } = await params
  const body = await req.json()

  const num  = (v: unknown) => (v !== undefined && v !== '' && v !== null ? Number(v) : null)
  const bool = (v: unknown, def = false) => (v !== undefined ? Boolean(v) : def)
  const str  = (v: unknown) => (v !== undefined && v !== '' ? String(v) : null)

  // Auto-calc monthly if daily provided and monthly not overridden
  const dailyLarge = num(body.dailyDiaperLargeQty)
  const dailySmall = num(body.dailyDiaperSmallQty)
  const dailyUnder = num(body.dailyUnderpadsQty)
  const dailyWipes = num(body.dailyWipesQty)

  const data = {
    profileDate:   body.profileDate ? new Date(body.profileDate) : undefined,

    totalBeds:         num(body.totalBeds),
    occupiedBeds:      num(body.occupiedBeds),
    vacantBeds:        num(body.vacantBeds),
    residentCareNote:  str(body.residentCareNote),

    foreignCaregiverRatio:   num(body.foreignCaregiverRatio),
    foreignCaregiverCountry: str(body.foreignCaregiverCountry) as never ?? null,

    managementQuality: str(body.managementQuality) as never ?? null,
    currentBrands:     str(body.currentBrands),
    competitorBrands:  str(body.competitorBrands),
    brandSwitchFreq:   str(body.brandSwitchFreq) as never ?? null,
    easySwitchBrand:   body.easySwitchBrand !== undefined && body.easySwitchBrand !== '' ? Boolean(body.easySwitchBrand) : null,
    procurementStyle:  str(body.procurementStyle) as never ?? null,

    dailyDiaperLargeQty: dailyLarge,
    dailyDiaperSmallQty: dailySmall,
    dailyUnderpadsQty:   dailyUnder,
    dailyWipesQty:       dailyWipes,
    usesWipes:           bool(body.usesWipes),

    monthlyDiaperLargeQty: num(body.monthlyDiaperLargeQty) ?? (dailyLarge !== null ? dailyLarge * 30 : null),
    monthlyDiaperSmallQty: num(body.monthlyDiaperSmallQty) ?? (dailySmall !== null ? dailySmall * 30 : null),
    monthlyUnderpadsQty:   num(body.monthlyUnderpadsQty)   ?? (dailyUnder !== null ? dailyUnder * 30 : null),
    monthlyWipesQty:       num(body.monthlyWipesQty)       ?? (dailyWipes !== null ? dailyWipes * 30 : null),

    updatedById: (session.user as { id?: string })?.id ?? null,
  }

  const profile = await prisma.customerUsageProfile.upsert({
    where:  { customerId },
    create: { id: crypto.randomUUID(), customerId, ...data },
    update: data,
  })

  return NextResponse.json(profile)
}
