import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await prisma.regionMapping.findMany({
      orderBy: [{ city: 'asc' }, { district: 'asc' }],
    })

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, 'region-mapping.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { city, district, region, deliveryZone, defaultRouteId } = body

    if (!city || !region) {
      return NextResponse.json({ error: '城市與區域為必填' }, { status: 400 })
    }

    const mapping = await prisma.regionMapping.upsert({
      where: {
        city_district: {
          city,
          district: district ?? '',
        },
      },
      update: {
        region,
        deliveryZone: deliveryZone ?? null,
        defaultRouteId: defaultRouteId ?? null,
      },
      create: {
        city,
        district: district ?? '',
        region,
        deliveryZone: deliveryZone ?? null,
        defaultRouteId: defaultRouteId ?? null,
      },
    })

    return NextResponse.json(mapping, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'region-mapping.POST')
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    const existing = await prisma.regionMapping.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { city, district, region, deliveryZone, defaultRouteId } = body
    const data: Record<string, unknown> = {}
    if (city !== undefined) data.city = city
    if (district !== undefined) data.district = district
    if (region !== undefined) data.region = region
    if (deliveryZone !== undefined) data.deliveryZone = deliveryZone
    if (defaultRouteId !== undefined) data.defaultRouteId = defaultRouteId

    const mapping = await prisma.regionMapping.update({ where: { id }, data })
    return NextResponse.json(mapping)
  } catch (error) {
    return handleApiError(error, 'region-mapping.PUT')
  }
}
