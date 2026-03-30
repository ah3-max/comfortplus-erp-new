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
    const search = searchParams.get('search') ?? ''
    const chequeType = searchParams.get('chequeType') ?? ''
    const status = searchParams.get('status') ?? ''
    const dueBefore = searchParams.get('dueBefore')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    const where = {
      ...(search && {
        OR: [
          { chequeNo: { contains: search, mode: 'insensitive' as const } },
          { partyName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(chequeType && { chequeType }),
      ...(status && { status }),
      ...(dueBefore && { dueDate: { lte: new Date(dueBefore) } }),
    }

    const [records, total] = await Promise.all([
      prisma.cheque.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.cheque.count({ where }),
    ])

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'cheques.GET')
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
    const { chequeNo, chequeType, bankName, bankBranch, accountNo, amount,
      issueDate, dueDate, partyName, partyId, partyType, notes } = body

    if (!chequeNo || !chequeType || !bankName || !amount || !dueDate) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    const record = await prisma.cheque.create({
      data: {
        chequeNo,
        chequeType,
        bankName,
        bankBranch,
        accountNo,
        amount: Number(amount),
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: new Date(dueDate),
        partyName,
        partyId,
        partyType,
        notes,
        createdById: session.user.id,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'cheques',
      action: 'CREATE',
      entityType: 'Cheque',
      entityId: record.id,
      entityLabel: `${chequeType === 'RECEIVABLE' ? '應收' : '應付'} ${chequeNo}`,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'cheques.POST')
  }
}
