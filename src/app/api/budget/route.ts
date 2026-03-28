import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    const where = {
      budgetYear: year,
      ...(month !== null ? { budgetMonth: month } : {}),
    }

    const data = await prisma.budget.findMany({
      where,
      orderBy: [{ category: 'asc' }, { budgetMonth: 'asc' }],
    })

    // Summary
    const totalBudget = data.reduce((s, b) => s + Number(b.budgetAmount), 0)
    const totalActual = data.reduce((s, b) => s + Number(b.actualAmount), 0)

    return NextResponse.json({ data, summary: { totalBudget, totalActual, variance: totalActual - totalBudget } })
  } catch (error) {
    return handleApiError(error, 'budget.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { budgetYear, budgetMonth, department, category, description, budgetAmount, notes } = body

    if (!budgetYear || !category || !description || budgetAmount == null) {
      return NextResponse.json({ error: '請填寫年度、類別、說明及預算金額' }, { status: 400 })
    }

    const record = await prisma.budget.upsert({
      where: {
        budgetYear_budgetMonth_category_department: {
          budgetYear,
          budgetMonth: budgetMonth ?? null,
          category,
          department: department ?? null,
        },
      },
      update: { budgetAmount, notes: notes || null },
      create: {
        budgetYear,
        budgetMonth: budgetMonth ?? null,
        department: department || null,
        category,
        description,
        budgetAmount,
        notes: notes || null,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'budget.POST')
  }
}
