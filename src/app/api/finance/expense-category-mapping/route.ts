import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/expense-category-mapping
 * List all expense category → GL account mappings.
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await prisma.expenseCategoryMapping.findMany({
      orderBy: { category: 'asc' },
    })
    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, 'expense-category-mapping.GET')
  }
}

/**
 * POST /api/finance/expense-category-mapping
 * Upsert a category mapping.
 * Body: { category, accountCode, accountName, isActive? }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { category, accountCode, accountName, isActive } = body

    if (!category || !accountCode || !accountName) {
      return NextResponse.json({ error: '缺少必填欄位' }, { status: 400 })
    }

    const data = await prisma.expenseCategoryMapping.upsert({
      where: { category },
      create: { category, accountCode, accountName, isActive: isActive ?? true },
      update: { accountCode, accountName, isActive: isActive ?? true },
    })

    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error, 'expense-category-mapping.POST')
  }
}
