import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const CAN_MANAGE = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'ECOMMERCE', 'PROCUREMENT']

// GET /api/products/sku-mappings?platform=SHOPEE&channelId=xxx
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform')
  const channelId = searchParams.get('channelId')
  const productId = searchParams.get('productId')

  try {
    const mappings = await prisma.productSkuMapping.findMany({
      where: {
        ...(platform ? { platform } : {}),
        ...(channelId ? { channelId } : {}),
        ...(productId ? { productId } : {}),
        isActive: true,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
      orderBy: [{ platform: 'asc' }, { platformSku: 'asc' }],
    })
    return NextResponse.json(mappings)
  } catch (err) {
    return handleApiError(err, 'products.skuMappings.list')
  }
}

// POST /api/products/sku-mappings
// body: { productId, platform, platformSku, channelId?, notes? }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!CAN_MANAGE.includes(session.user.role as string)) {
    return NextResponse.json({ error: '無權限新增 SKU 對照' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { productId, platform, platformSku, channelId, notes } = body

    if (!productId || !platform || !platformSku) {
      return NextResponse.json({ error: 'productId, platform, platformSku 為必填' }, { status: 400 })
    }

    const mapping = await prisma.productSkuMapping.upsert({
      where: { platform_platformSku: { platform, platformSku } },
      update: { productId, channelId: channelId ?? null, notes, isActive: true, createdById: session.user.id },
      create: { productId, platform, platformSku, channelId: channelId ?? null, notes, createdById: session.user.id },
    })
    return NextResponse.json(mapping, { status: 201 })
  } catch (err) {
    return handleApiError(err, 'products.skuMappings.create')
  }
}

// DELETE /api/products/sku-mappings?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!CAN_MANAGE.includes(session.user.role as string)) {
    return NextResponse.json({ error: '無權限刪除 SKU 對照' }, { status: 403 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    await prisma.productSkuMapping.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, 'products.skuMappings.delete')
  }
}
