import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET — 取得客戶標籤
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: customerId } = await params
    const maps = await prisma.customerTagMap.findMany({
      where: { customerId },
      include: { tag: true },
    })
    return NextResponse.json(maps.map(m => m.tag))
  } catch (error) {
    return handleApiError(error, 'customers.tags.list')
  }
}

// POST — 新增標籤 { tagId }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: customerId } = await params
    const { tagId } = await req.json()
    const map = await prisma.customerTagMap.upsert({
      where: { customerId_tagId: { customerId, tagId } },
      update: {},
      create: { customerId, tagId },
      include: { tag: true },
    })
    return NextResponse.json(map.tag)
  } catch (error) {
    return handleApiError(error, 'customers.tags.add')
  }
}

// DELETE — 移除標籤 { tagId }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: customerId } = await params
    const { tagId } = await req.json()
    await prisma.customerTagMap.deleteMany({ where: { customerId, tagId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'customers.tags.remove')
  }
}
