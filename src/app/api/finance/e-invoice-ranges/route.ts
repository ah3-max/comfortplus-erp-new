import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']
const PERIODS = ['01-02', '03-04', '05-06', '07-08', '09-10', '11-12']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined
  const activeOnly = searchParams.get('active') === 'true'

  const ranges = await prisma.eInvoiceNumberRange.findMany({
    where: {
      ...(year ? { year } : {}),
      ...(activeOnly ? { isActive: true } : {}),
    },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: [{ year: 'desc' }, { period: 'asc' }, { prefix: 'asc' }],
  })

  return NextResponse.json({ data: ranges })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { prefix, year, period, startNumber, endNumber, note } = body

    if (!prefix || !year || !period || !startNumber || !endNumber) {
      return NextResponse.json({ error: '請填寫所有必填欄位' }, { status: 400 })
    }

    const prefixUp = String(prefix).toUpperCase()
    if (!/^[A-Z]{2}$/.test(prefixUp)) {
      return NextResponse.json({ error: '字軌代號須為 2 碼大寫英文字母' }, { status: 400 })
    }

    if (!PERIODS.includes(period)) {
      return NextResponse.json({ error: '期別格式不正確' }, { status: 400 })
    }

    if (Number(startNumber) >= Number(endNumber)) {
      return NextResponse.json({ error: '起始號碼須小於結束號碼' }, { status: 400 })
    }

    const range = await prisma.eInvoiceNumberRange.create({
      data: {
        prefix: prefixUp,
        year: Number(year),
        period,
        startNumber: Number(startNumber),
        endNumber: Number(endNumber),
        currentNumber: Number(startNumber) - 1,
        note: note || null,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'e-invoice-ranges',
      action: 'CREATE',
      entityType: 'EInvoiceNumberRange',
      entityId: range.id,
      entityLabel: `${prefixUp} ${year}-${period}`,
    }).catch(() => {})

    return NextResponse.json(range, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'e-invoice-ranges.POST')
  }
}
