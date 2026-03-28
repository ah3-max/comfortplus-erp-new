import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const entryType = searchParams.get('entryType') // MANUAL / AUTO / ADJUSTMENT / CLOSING
    const status = searchParams.get('status') ?? 'POSTED'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const where: Record<string, unknown> = {
      entryDate: { gte: periodStart, lte: periodEnd },
    }
    if (status) where.status = status
    if (entryType) where.entryType = entryType

    const [total, entries] = await Promise.all([
      prisma.journalEntry.count({ where }),
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: { account: { select: { code: true, name: true, type: true } } },
            orderBy: { lineNo: 'asc' },
          },
          createdBy: { select: { name: true } },
          postedBy: { select: { name: true } },
        },
        orderBy: { entryDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const rows = entries.map(e => ({
      id: e.id,
      entryNo: e.entryNo,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      description: e.description,
      status: e.status,
      entryType: e.entryType,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      totalDebit: Number(e.totalDebit),
      totalCredit: Number(e.totalCredit),
      postedAt: e.postedAt?.toISOString().slice(0, 10) ?? null,
      createdBy: e.createdBy?.name ?? '',
      postedBy: e.postedBy?.name ?? null,
      lines: e.lines.map(l => ({
        lineNo: l.lineNo,
        accountCode: l.account.code,
        accountName: l.account.name,
        accountType: l.account.type,
        description: l.description ?? '',
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    }))

    return NextResponse.json({
      data: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.transaction-detail.GET')
  }
}
