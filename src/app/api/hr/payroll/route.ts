import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const ALLOWED_ROLES = ['FINANCE', 'SUPER_ADMIN']

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const periodYear = searchParams.get('periodYear')
    const periodMonth = searchParams.get('periodMonth')

    const where: Record<string, unknown> = {}
    if (periodYear) where.periodYear = parseInt(periodYear, 10)
    if (periodMonth) where.periodMonth = parseInt(periodMonth, 10)

    const records = await prisma.payrollRecord.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    })

    return NextResponse.json(records)
  } catch (error) {
    return handleApiError(error, 'hr.payroll')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      userId, periodYear, periodMonth, baseSalary, allowances,
      overtimePay, bonus, deductions, laborInsurance,
      healthInsurance, tax, netPay, notes,
    } = body

    if (!userId || !periodYear || !periodMonth || baseSalary == null || netPay == null) {
      return NextResponse.json(
        { error: '請填寫必填欄位 (userId, periodYear, periodMonth, baseSalary, netPay)' },
        { status: 400 },
      )
    }

    const data = {
      baseSalary,
      allowances,
      overtimePay,
      bonus,
      deductions,
      laborInsurance,
      healthInsurance,
      tax,
      netPay,
      notes,
    }

    const record = await prisma.payrollRecord.upsert({
      where: {
        userId_periodYear_periodMonth: { userId, periodYear, periodMonth },
      },
      create: { userId, periodYear, periodMonth, ...data },
      update: data,
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'hr.payroll')
  }
}
