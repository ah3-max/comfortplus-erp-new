import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/vehicles — 車輛列表（含保養到期警示）
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    include: {
      drivers: { where: { isActive: true }, select: { id: true, name: true, phone: true } },
      maintenances: { orderBy: { serviceDate: 'desc' }, take: 3 },
      _count: { select: { trips: true, maintenances: true } },
    },
    orderBy: { plateNo: 'asc' },
  })

  // 計算到期警示
  const now = new Date()
  const warn30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const data = vehicles.map(v => {
    const alerts: string[] = []
    if (v.insuranceExpiry && v.insuranceExpiry < warn30) alerts.push(`保險${v.insuranceExpiry < now ? '已過期' : '即將到期'}`)
    if (v.inspectionExpiry && v.inspectionExpiry < warn30) alerts.push(`驗車${v.inspectionExpiry < now ? '已過期' : '即將到期'}`)
    if (v.licenseTaxExpiry && v.licenseTaxExpiry < warn30) alerts.push(`牌照稅${v.licenseTaxExpiry < now ? '已過期' : '即將到期'}`)
    if (v.fuelTaxExpiry && v.fuelTaxExpiry < warn30) alerts.push(`燃料稅${v.fuelTaxExpiry < now ? '已過期' : '即將到期'}`)

    // 檢查下次保養是否到期
    const latestMaint = v.maintenances[0]
    if (latestMaint?.nextServiceDate && latestMaint.nextServiceDate < warn30) {
      alerts.push(`保養${latestMaint.nextServiceDate < now ? '已逾期' : '即將到期'}`)
    }
    if (latestMaint?.nextServiceKm && v.currentOdometer && v.currentOdometer >= latestMaint.nextServiceKm - 500) {
      alerts.push('保養里程將到')
    }

    return { ...v, alerts }
  })

  return NextResponse.json(data)
}

// POST /api/vehicles — 新增車輛
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const vehicle = await prisma.vehicle.create({
    data: {
      plateNo: body.plateNo,
      vehicleType: body.vehicleType ?? null,
      brand: body.brand ?? null,
      model: body.model ?? null,
      year: body.year ? Number(body.year) : null,
      maxWeight: body.maxWeight ? Number(body.maxWeight) : null,
      owner: body.owner ?? null,
      fuelType: body.fuelType ?? null,
      currentOdometer: body.currentOdometer ? Number(body.currentOdometer) : null,
      insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
      inspectionExpiry: body.inspectionExpiry ? new Date(body.inspectionExpiry) : null,
      licenseTaxExpiry: body.licenseTaxExpiry ? new Date(body.licenseTaxExpiry) : null,
      fuelTaxExpiry: body.fuelTaxExpiry ? new Date(body.fuelTaxExpiry) : null,
      notes: body.notes ?? null,
    },
  })

  return NextResponse.json(vehicle)
}
