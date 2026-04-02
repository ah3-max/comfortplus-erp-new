import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/finance/journal-entries/batch-post
 * 批量過帳：將多筆 DRAFT 傳票一次性變更為 POSTED
 * Body: { ids: string[] }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { ids } = (await req.json()) as { ids: string[] }
    if (!ids?.length) {
      return NextResponse.json({ error: '請選擇至少一筆傳票' }, { status: 400 })
    }

    const entries = await prisma.journalEntry.findMany({
      where: { id: { in: ids }, status: 'DRAFT' },
      select: { id: true, entryNo: true },
    })

    if (entries.length === 0) {
      return NextResponse.json({ error: '所選傳票皆非草稿狀態' }, { status: 400 })
    }

    const now = new Date()
    await prisma.journalEntry.updateMany({
      where: { id: { in: entries.map(e => e.id) } },
      data: { status: 'POSTED', postedAt: now, postedById: session.user.id },
    })

    for (const e of entries) {
      logAudit({
        userId: session.user.id, userName: session.user.name ?? '', userRole: role,
        module: 'journal-entries', action: 'BATCH_POST', entityType: 'JournalEntry',
        entityId: e.id, entityLabel: e.entryNo,
      }).catch(() => {})
    }

    return NextResponse.json({ posted: entries.length, ids: entries.map(e => e.id) })
  } catch (error) {
    return handleApiError(error, 'finance.journal-entries.batch-post')
  }
}
