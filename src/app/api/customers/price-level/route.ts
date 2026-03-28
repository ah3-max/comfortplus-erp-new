import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/customers/price-level — list all customer price levels
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    const data = await prisma.customerPriceLevel.findMany({
      where: search ? {
        customer: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        },
      } : {},
      include: {
        customer: { select: { id: true, name: true, code: true, type: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, 'customers.price-level.GET')
  }
}

// PUT /api/customers/price-level — bulk upsert
// Body: { items: [{ customerId, priceLevel, notes? }] }
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const items: Array<{ customerId: string; priceLevel: string; notes?: string }> = body.items ?? []
    if (!items.length) return NextResponse.json({ error: '無資料' }, { status: 400 })

    const validLevels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
    for (const item of items) {
      if (!validLevels.includes(item.priceLevel)) {
        return NextResponse.json({ error: `無效的價格等級: ${item.priceLevel}` }, { status: 400 })
      }
    }

    await prisma.$transaction(
      items.map(item =>
        prisma.customerPriceLevel.upsert({
          where: { customerId: item.customerId },
          create: { customerId: item.customerId, priceLevel: item.priceLevel, notes: item.notes ?? null },
          update: { priceLevel: item.priceLevel, notes: item.notes ?? null },
        })
      )
    )

    return NextResponse.json({ success: true, count: items.length })
  } catch (error) {
    return handleApiError(error, 'customers.price-level.PUT')
  }
}
