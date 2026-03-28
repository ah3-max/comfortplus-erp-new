import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      postedBy: { select: { id: true, name: true } },
      lines: {
        include: { account: true },
        orderBy: { lineNo: 'asc' },
      },
    },
  })

  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(entry)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const current = await prisma.journalEntry.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Post journal entry
    if (body.action === 'POST') {
      if (current.status !== 'DRAFT') {
        return NextResponse.json({ error: '只能過帳草稿狀態的傳票' }, { status: 400 })
      }
      const updated = await prisma.journalEntry.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: session.user.id },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'journal-entries',
        action: 'POST',
        entityType: 'JournalEntry',
        entityId: id,
        entityLabel: current.entryNo,
      }).catch(() => {})

      return NextResponse.json(updated)
    }

    // Reverse posted journal entry
    if (body.action === 'REVERSE') {
      if (current.status !== 'POSTED') {
        return NextResponse.json({ error: '只能沖正已過帳的傳票' }, { status: 400 })
      }

      const originalLines = await prisma.journalEntryLine.findMany({
        where: { entryId: id },
        orderBy: { lineNo: 'asc' },
      })

      const reversalEntryNo = await generateSequenceNo('JOURNAL_ENTRY')

      const result = await prisma.$transaction(async (tx) => {
        // Create reversal entry with swapped debit/credit
        const reversalEntry = await tx.journalEntry.create({
          data: {
            entryNo: reversalEntryNo,
            entryDate: new Date(),
            description: `沖正：${current.description}`,
            status: 'POSTED',
            entryType: 'ADJUSTMENT',
            referenceType: 'JournalEntry',
            referenceId: id,
            totalDebit: current.totalCredit,
            totalCredit: current.totalDebit,
            postedAt: new Date(),
            postedById: session.user.id,
            createdById: session.user.id,
            notes: body.notes || null,
            lines: {
              create: originalLines.map((line, idx) => ({
                accountId: line.accountId,
                debit: line.credit,
                credit: line.debit,
                description: line.description ? `沖正：${line.description}` : '沖正',
                lineNo: idx + 1,
              })),
            },
          },
          include: {
            lines: { include: { account: { select: { code: true, name: true } } } },
          },
        })

        // Mark original entry as reversed
        await tx.journalEntry.update({
          where: { id },
          data: {
            status: 'REVERSED',
            reversedById: session.user.id,
            reversedEntryId: reversalEntry.id,
          },
        })

        return reversalEntry
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'journal-entries',
        action: 'REVERSE',
        entityType: 'JournalEntry',
        entityId: id,
        entityLabel: current.entryNo,
        changes: {
          reversalEntryId: { before: null, after: result.id },
          reversalEntryNo: { before: null, after: result.entryNo },
        },
      }).catch(() => {})

      return NextResponse.json(result)
    }

    if (current.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能編輯草稿傳票' }, { status: 400 })
    }

    // Update draft
    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        description: body.description ?? undefined,
        notes: body.notes ?? undefined,
        entryDate: body.entryDate ? new Date(body.entryDate) : undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'finance.journal-entries.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const entry = await prisma.journalEntry.findUnique({ where: { id } })
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (entry.status === 'POSTED') {
      return NextResponse.json({ error: '已過帳的傳票不能刪除' }, { status: 400 })
    }

    await prisma.journalEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'finance.journal-entries.DELETE')
  }
}
