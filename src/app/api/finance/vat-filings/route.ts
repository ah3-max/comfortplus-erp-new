import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
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
    const status = searchParams.get('status') ?? ''

    const where = {
      ...(status && { status }),
    }

    const records = await prisma.vatFiling.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({ data: records })
  } catch (error) {
    return handleApiError(error, 'vat-filings.GET')
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
    const { periodCode, startDate, endDate,
      outputTaxBase, outputTax, inputTaxBase, inputTax, notes } = body

    if (!periodCode || !startDate || !endDate) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    const filingNo = await generateSequenceNo('VAT_FILING')
    const netTax = (Number(outputTax) || 0) - (Number(inputTax) || 0)

    const record = await prisma.vatFiling.create({
      data: {
        filingNo,
        periodCode,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        outputTaxBase: Number(outputTaxBase) || 0,
        outputTax: Number(outputTax) || 0,
        inputTaxBase: Number(inputTaxBase) || 0,
        inputTax: Number(inputTax) || 0,
        netTax,
        notes,
        createdById: session.user.id,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'vat-filings',
      action: 'CREATE',
      entityType: 'VatFiling',
      entityId: record.id,
      entityLabel: `${filingNo} ${periodCode}`,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'vat-filings.POST')
  }
}
