import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const COST_ACCESS_ROLES = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE']

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!COST_ACCESS_ROLES.includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const variant = await prisma.productVariant.findUnique({ where: { id }, select: { id: true } })
    if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })

    const sp = new URL(req.url).searchParams
    const page     = Math.max(1, parseInt(sp.get('page')     ?? '1',  10))
    const pageSize = Math.min(100, parseInt(sp.get('pageSize') ?? '20', 10))

    const [total, data] = await prisma.$transaction([
      prisma.variantCostSnapshot.count({ where: { variantId: id } }),
      prisma.variantCostSnapshot.findMany({
        where:   { variantId: id },
        orderBy: { effectiveDate: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'donghong.variants.costHistory')
  }
}
