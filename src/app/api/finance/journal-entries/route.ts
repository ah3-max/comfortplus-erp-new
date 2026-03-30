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
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const where = {
      ...(search && {
        OR: [
          { entryNo: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
    }

    const [total, data] = await Promise.all([
      prisma.journalEntry.count({ where }),
      prisma.journalEntry.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          postedBy: { select: { id: true, name: true } },
          lines: {
            include: { account: { select: { code: true, name: true } } },
          },
        },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.journal-entries.GET')
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
    const { entryDate, description, entryType, lines, notes } = body

    if (!entryDate || !description || !lines?.length) {
      return NextResponse.json({ error: '缺少必填欄位' }, { status: 400 })
    }

    // Validate debit = credit
    const totalDebit = lines.reduce((s: number, l: { debit?: number }) => s + (l.debit ?? 0), 0)
    const totalCredit = lines.reduce((s: number, l: { credit?: number }) => s + (l.credit ?? 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: `借貸不平衡：借方 ${totalDebit} ≠ 貸方 ${totalCredit}` }, { status: 400 })
    }

    const entryNo = await generateSequenceNo('JOURNAL_ENTRY')

    const entry = await prisma.journalEntry.create({
      data: {
        entryNo,
        entryDate: new Date(entryDate),
        description,
        entryType: entryType || 'MANUAL',
        totalDebit,
        totalCredit,
        notes: notes || null,
        createdById: session.user.id,
        lines: {
          create: lines.map((l: {
            accountId: string; debit?: number; credit?: number; description?: string
          }, idx: number) => ({
            accountId: l.accountId,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            description: l.description ?? null,
            lineNo: idx + 1,
          })),
        },
      },
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'journal-entries',
      action: 'CREATE',
      entityType: 'JournalEntry',
      entityId: entry.id,
      entityLabel: entryNo,
    }).catch(() => {})

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'finance.journal-entries.POST')
  }
}
