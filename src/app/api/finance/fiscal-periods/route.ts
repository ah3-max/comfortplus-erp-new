import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined
    const status = searchParams.get('status') ?? ''
    const periodType = searchParams.get('periodType') ?? ''

    const where = {
      ...(year && { year }),
      ...(status && { status: status as never }),
      ...(periodType && { periodType }),
    }

    const records = await prisma.fiscalPeriod.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        lockedBy: { select: { id: true, name: true } },
        _count: { select: { journalEntries: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return NextResponse.json({ data: records })
  } catch (error) {
    return handleApiError(error, 'fiscal-periods.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { periodType, year, month, quarter, startDate, endDate, notes } = body

    if (!year || !startDate || !endDate) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    // Build periodCode
    let periodCode = String(year)
    if (periodType === 'MONTHLY' && month) {
      periodCode = `${year}-${String(month).padStart(2, '0')}`
    } else if (periodType === 'QUARTERLY' && quarter) {
      periodCode = `${year}-Q${quarter}`
    }

    // Check for duplicate
    const existing = await prisma.fiscalPeriod.findUnique({ where: { periodCode } })
    if (existing) {
      return NextResponse.json({ error: `期間 ${periodCode} 已存在` }, { status: 409 })
    }

    const record = await prisma.fiscalPeriod.create({
      data: {
        periodCode,
        periodType: periodType ?? 'MONTHLY',
        year: Number(year),
        month: month ? Number(month) : null,
        quarter: quarter ? Number(quarter) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes,
        createdById: session.user.id,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'fiscal-periods',
      action: 'CREATE',
      entityType: 'FiscalPeriod',
      entityId: record.id,
      entityLabel: periodCode,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'fiscal-periods.POST')
  }
}
