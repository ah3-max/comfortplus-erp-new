import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

// GET /api/price-tiers — list all products with their price tiers
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(category && { category }),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        unit: true,
        sellingPrice: true,
        priceTiers: true,
      },
      orderBy: [{ category: 'asc' }, { sku: 'asc' }],
    })

    return NextResponse.json({ data: products })
  } catch (error) {
    return handleApiError(error, 'price-tiers.GET')
  }
}

// PUT /api/price-tiers — bulk upsert price tiers for multiple products
// Body: { items: [{ productId, priceA?, priceB?, ... priceJ? }] }
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const items: Array<{
      productId: string
      priceA?: number | null; priceB?: number | null; priceC?: number | null
      priceD?: number | null; priceE?: number | null; priceF?: number | null
      priceG?: number | null; priceH?: number | null; priceI?: number | null
      priceJ?: number | null
    }> = body.items ?? []

    if (!items.length) return NextResponse.json({ error: '無資料' }, { status: 400 })

    await prisma.$transaction(
      items.map(item =>
        prisma.productPriceTier.upsert({
          where: { productId: item.productId },
          create: {
            productId: item.productId,
            updatedById: session.user.id,
            priceA: item.priceA ?? null,
            priceB: item.priceB ?? null,
            priceC: item.priceC ?? null,
            priceD: item.priceD ?? null,
            priceE: item.priceE ?? null,
            priceF: item.priceF ?? null,
            priceG: item.priceG ?? null,
            priceH: item.priceH ?? null,
            priceI: item.priceI ?? null,
            priceJ: item.priceJ ?? null,
          },
          update: {
            updatedById: session.user.id,
            priceA: item.priceA ?? null,
            priceB: item.priceB ?? null,
            priceC: item.priceC ?? null,
            priceD: item.priceD ?? null,
            priceE: item.priceE ?? null,
            priceF: item.priceF ?? null,
            priceG: item.priceG ?? null,
            priceH: item.priceH ?? null,
            priceI: item.priceI ?? null,
            priceJ: item.priceJ ?? null,
          },
        })
      )
    )

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'price-tiers',
      action: 'UPDATE',
      entityType: 'ProductPriceTier',
      entityId: 'bulk',
      entityLabel: `批次更新 ${items.length} 筆`,
    }).catch(() => {})

    return NextResponse.json({ success: true, count: items.length })
  } catch (error) {
    return handleApiError(error, 'price-tiers.PUT')
  }
}
