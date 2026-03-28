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

    const data = await prisma.cashFlowPlan.findMany({
      where: { planYear: year },
      orderBy: [{ planMonth: 'asc' }, { flowType: 'asc' }, { category: 'asc' }],
    })

    // Build monthly summary
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const monthly = months.map(m => {
      const rows = data.filter(d => d.planMonth === m)
      const inflow = rows.filter(r => r.flowType === 'INFLOW')
      const outflow = rows.filter(r => r.flowType === 'OUTFLOW')
      const plannedIn = inflow.reduce((s, r) => s + Number(r.plannedAmount), 0)
      const plannedOut = outflow.reduce((s, r) => s + Number(r.plannedAmount), 0)
      const actualIn = inflow.reduce((s, r) => s + Number(r.actualAmount), 0)
      const actualOut = outflow.reduce((s, r) => s + Number(r.actualAmount), 0)
      return {
        month: m,
        plannedInflow: plannedIn,
        plannedOutflow: plannedOut,
        plannedNet: plannedIn - plannedOut,
        actualInflow: actualIn,
        actualOutflow: actualOut,
        actualNet: actualIn - actualOut,
      }
    })

    return NextResponse.json({ data, monthly })
  } catch (error) {
    return handleApiError(error, 'cash-flow.GET')
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
    const { planYear, planMonth, flowType, category, description, plannedAmount, actualAmount, notes } = body

    if (!planYear || !planMonth || !flowType || !category || !description || plannedAmount == null) {
      return NextResponse.json({ error: '請填寫年月、類型、類別、說明及計畫金額' }, { status: 400 })
    }

    const record = await prisma.cashFlowPlan.create({
      data: {
        planYear,
        planMonth,
        flowType,
        category,
        description,
        plannedAmount,
        actualAmount: actualAmount ?? 0,
        notes: notes || null,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'cash-flow.POST')
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, actualAmount, plannedAmount, notes } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const record = await prisma.cashFlowPlan.update({
      where: { id },
      data: {
        ...(actualAmount != null && { actualAmount }),
        ...(plannedAmount != null && { plannedAmount }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'cash-flow.PUT')
  }
}
