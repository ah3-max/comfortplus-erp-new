import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const record = await prisma.fiscalPeriod.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        lockedBy: { select: { id: true, name: true } },
        _count: { select: { journalEntries: true } },
      },
    })
    if (!record) return NextResponse.json({ error: '找不到會計期間' }, { status: 404 })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'fiscal-periods.[id].GET')
  }
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
    const { action, notes } = body

    const period = await prisma.fiscalPeriod.findUnique({ where: { id } })
    if (!period) return NextResponse.json({ error: '找不到會計期間' }, { status: 404 })

    let updateData: Record<string, unknown> = {}

    if (action === 'CLOSE') {
      // Check no DRAFT journal entries in this period
      const draftCount = await prisma.journalEntry.count({
        where: { periodId: id, status: 'DRAFT' },
      })
      if (draftCount > 0) {
        return NextResponse.json(
          { error: `尚有 ${draftCount} 筆草稿傳票未過帳，請先完成過帳` },
          { status: 422 }
        )
      }
      if (period.status !== 'OPEN' && period.status !== 'CLOSING') {
        return NextResponse.json({ error: '只有「開放」或「結帳中」的期間可執行結帳' }, { status: 422 })
      }
      updateData = {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: session.user.id,
      }
    } else if (action === 'LOCK') {
      if (period.status !== 'CLOSED') {
        return NextResponse.json({ error: '只有「已結帳」期間可鎖定' }, { status: 422 })
      }
      updateData = {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedById: session.user.id,
      }
    } else if (action === 'REOPEN') {
      if (period.status === 'LOCKED') {
        return NextResponse.json({ error: '鎖定期間不可重新開啟，請聯繫系統管理員' }, { status: 422 })
      }
      updateData = {
        status: 'OPEN',
        closedAt: null,
        closedById: null,
      }
    } else if (action === 'START_CLOSING') {
      if (period.status !== 'OPEN') {
        return NextResponse.json({ error: '只有「開放」期間可開始結帳程序' }, { status: 422 })
      }
      updateData = { status: 'CLOSING' }
    } else {
      // Generic update (notes only)
      if (notes !== undefined) updateData.notes = notes
    }

    const record = await prisma.fiscalPeriod.update({
      where: { id },
      data: updateData,
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'fiscal-periods',
      action: action ?? 'UPDATE',
      entityType: 'FiscalPeriod',
      entityId: id,
      entityLabel: record.periodCode,
    }).catch(() => {})

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'fiscal-periods.[id].PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN'].includes(role)) {
    return NextResponse.json({ error: '僅系統管理員可刪除會計期間' }, { status: 403 })
  }

  try {
    const { id } = await params
    const period = await prisma.fiscalPeriod.findUnique({ where: { id } })
    if (!period) return NextResponse.json({ error: '找不到會計期間' }, { status: 404 })
    if (period.status !== 'OPEN') {
      return NextResponse.json({ error: '只有「開放」期間可刪除' }, { status: 422 })
    }

    await prisma.fiscalPeriod.delete({ where: { id } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'fiscal-periods',
      action: 'DELETE',
      entityType: 'FiscalPeriod',
      entityId: id,
      entityLabel: period.periodCode,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'fiscal-periods.[id].DELETE')
  }
}
