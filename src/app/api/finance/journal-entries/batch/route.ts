import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

interface BatchEntryLine {
  accountId: string
  debit?: number
  credit?: number
  description?: string
}

interface BatchEntry {
  entryDate: string
  description: string
  entryType?: string
  notes?: string
  lines: BatchEntryLine[]
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
    const { entries } = body as { entries: BatchEntry[] }

    if (!entries?.length) {
      return NextResponse.json({ error: '至少需要一筆傳票' }, { status: 400 })
    }

    // Validate each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (!entry.entryDate || !entry.description || !entry.lines?.length) {
        return NextResponse.json(
          { error: `第 ${i + 1} 筆傳票缺少必填欄位（entryDate, description, lines）` },
          { status: 400 },
        )
      }

      const totalDebit = entry.lines.reduce((s, l) => s + (l.debit ?? 0), 0)
      const totalCredit = entry.lines.reduce((s, l) => s + (l.credit ?? 0), 0)
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return NextResponse.json(
          { error: `第 ${i + 1} 筆傳票借貸不平衡：借方 ${totalDebit} ≠ 貸方 ${totalCredit}` },
          { status: 400 },
        )
      }
    }

    // Generate all sequence numbers before the transaction
    const entryNos: string[] = []
    for (let i = 0; i < entries.length; i++) {
      entryNos.push(await generateSequenceNo('JOURNAL_ENTRY'))
    }

    const created = await prisma.$transaction(async (tx) => {
      const results = []
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const totalDebit = entry.lines.reduce((s, l) => s + (l.debit ?? 0), 0)
        const totalCredit = entry.lines.reduce((s, l) => s + (l.credit ?? 0), 0)

        const record = await tx.journalEntry.create({
          data: {
            entryNo: entryNos[i],
            entryDate: new Date(entry.entryDate),
            description: entry.description,
            entryType: entry.entryType || 'MANUAL',
            totalDebit,
            totalCredit,
            notes: entry.notes || null,
            createdById: session.user.id,
            lines: {
              create: entry.lines.map((l, idx) => ({
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
        results.push(record)
      }
      return results
    })

    // Log audit for each entry (non-blocking)
    for (const entry of created) {
      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'journal-entries',
        action: 'BATCH_CREATE',
        entityType: 'JournalEntry',
        entityId: entry.id,
        entityLabel: entry.entryNo,
      }).catch(() => {})
    }

    return NextResponse.json({ created: created.length, entries: created }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'finance.journal-entries.batch.POST')
  }
}
