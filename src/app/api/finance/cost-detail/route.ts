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
    const groupBy = searchParams.get('groupBy') ?? 'account'

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        account: { type: 'EXPENSE' },
        entry: { status: 'POSTED', entryDate: { gte: periodStart, lte: periodEnd } },
      },
      include: {
        account: { select: { code: true, name: true, subType: true } },
        entry: { select: { description: true } },
      },
    })

    const grouped: Record<string, { key: string; subKey: string; debit: number; credit: number; count: number }> = {}

    for (const line of lines) {
      let key: string
      let subKey: string
      if (groupBy === 'account') {
        key = `${line.account.code} ${line.account.name}`
        subKey = line.account.subType ?? ''
      } else if (groupBy === 'summary') {
        key = line.entry.description
        subKey = `${line.account.code} ${line.account.name}`
      } else {
        // month
        const date = new Date((line as { entry: { entryDate?: Date; description: string } }).entry.description ?? '')
        key = `${periodStart.getFullYear()}-${String(Math.ceil((lines.indexOf(line) + 1) / 30)).padStart(2, '0')}`
        // Use the entry date via a different approach
        key = line.account.code.slice(0, 2) // fallback
        subKey = line.account.name
      }

      if (!grouped[key]) grouped[key] = { key, subKey, debit: 0, credit: 0, count: 0 }
      grouped[key].debit += Number(line.debit)
      grouped[key].credit += Number(line.credit)
      grouped[key].count++
    }

    // For month groupBy, redo with actual entry date
    if (groupBy === 'month') {
      const monthGrouped: Record<string, { key: string; subKey: string; debit: number; credit: number; count: number }> = {}
      const linesWithDate = await prisma.journalEntryLine.findMany({
        where: {
          account: { type: 'EXPENSE' },
          entry: { status: 'POSTED', entryDate: { gte: periodStart, lte: periodEnd } },
        },
        include: {
          account: { select: { code: true, name: true, subType: true } },
          entry: { select: { entryDate: true, description: true } },
        },
      })
      for (const line of linesWithDate) {
        const d = line.entry.entryDate
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthGrouped[key]) monthGrouped[key] = { key, subKey: '', debit: 0, credit: 0, count: 0 }
        monthGrouped[key].debit += Number(line.debit)
        monthGrouped[key].credit += Number(line.credit)
        monthGrouped[key].count++
      }
      const totalCost = Object.values(monthGrouped).reduce((s, r) => s + (r.debit - r.credit), 0)
      const rows = Object.values(monthGrouped)
        .map(r => ({
          key: r.key, subKey: r.subKey,
          debitTotal: Math.round(r.debit * 100) / 100,
          creditTotal: Math.round(r.credit * 100) / 100,
          netCost: Math.round((r.debit - r.credit) * 100) / 100,
          entryCount: r.count,
          percentage: totalCost > 0 ? Math.round((r.debit - r.credit) / totalCost * 1000) / 10 : 0,
        }))
        .sort((a, b) => a.key.localeCompare(b.key))
      return NextResponse.json({
        period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
        groupBy, totalCost: Math.round(totalCost * 100) / 100, rows,
      })
    }

    const totalCost = Object.values(grouped).reduce((s, r) => s + (r.debit - r.credit), 0)
    const rows = Object.values(grouped)
      .map(r => ({
        key: r.key, subKey: r.subKey,
        debitTotal: Math.round(r.debit * 100) / 100,
        creditTotal: Math.round(r.credit * 100) / 100,
        netCost: Math.round((r.debit - r.credit) * 100) / 100,
        entryCount: r.count,
        percentage: totalCost > 0 ? Math.round((r.debit - r.credit) / totalCost * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.netCost - a.netCost)

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      groupBy, totalCost: Math.round(totalCost * 100) / 100, rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.cost-detail.GET')
  }
}
