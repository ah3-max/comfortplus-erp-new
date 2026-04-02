import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/finance/bank-accounts/[id]/import-statement
 *
 * 匯入銀行流水 CSV。預設欄位格式：
 *   日期, 摘要, 支出, 存入, 餘額, 備註
 *
 * Body: { rows: Array<{ txDate, description, debit?, credit?, balance?, referenceNo? }> }
 *
 * 或 Body: { csv: string } — 自動解析逗號分隔
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const account = await prisma.bankAccount.findUnique({ where: { id } })
    if (!account) return NextResponse.json({ error: '找不到銀行帳戶' }, { status: 404 })

    const body = await req.json()
    let rows: Array<{
      txDate: string; description: string
      debit?: number; credit?: number; balance?: number; referenceNo?: string
    }> = body.rows ?? []

    // CSV 自動解析
    if (body.csv && typeof body.csv === 'string') {
      const lines = body.csv.trim().split('\n')
      // 跳過標題行
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''))
        if (cols.length < 4) continue
        rows.push({
          txDate:      cols[0],
          description: cols[1],
          debit:       cols[2] ? parseFloat(cols[2]) || 0 : 0,
          credit:      cols[3] ? parseFloat(cols[3]) || 0 : 0,
          balance:     cols[4] ? parseFloat(cols[4]) || undefined : undefined,
          referenceNo: cols[5] || undefined,
        })
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: '無可匯入的資料' }, { status: 400 })
    }

    let created = 0
    let skipped = 0
    let lastBalance = Number(account.currentBalance)

    for (const row of rows) {
      if (!row.txDate || !row.description) { skipped++; continue }

      const debitAmt  = Number(row.debit ?? 0)
      const creditAmt = Number(row.credit ?? 0)
      if (debitAmt === 0 && creditAmt === 0) { skipped++; continue }

      const direction = creditAmt > 0 ? 'CREDIT' : 'DEBIT'
      const amount    = creditAmt > 0 ? creditAmt : debitAmt
      const balanceDelta = direction === 'CREDIT' ? amount : -amount
      lastBalance = row.balance !== undefined ? Number(row.balance) : lastBalance + balanceDelta

      // 檢查重複（同日期+同金額+同摘要）
      const existing = await prisma.bankTransaction.findFirst({
        where: {
          bankAccountId: id,
          txDate: new Date(row.txDate),
          amount,
          direction,
          description: row.description,
        },
      })
      if (existing) { skipped++; continue }

      await prisma.bankTransaction.create({
        data: {
          bankAccountId: id,
          txDate: new Date(row.txDate),
          description: row.description,
          direction,
          amount,
          balance: lastBalance,
          referenceNo: row.referenceNo ?? null,
          isReconciled: false,
          createdById: session.user.id,
        },
      })
      created++
    }

    // 更新帳戶餘額
    await prisma.bankAccount.update({
      where: { id },
      data: { currentBalance: lastBalance },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'bank-accounts', action: 'IMPORT_STATEMENT', entityType: 'BankAccount',
      entityId: id, entityLabel: `${account.accountName} 匯入 ${created} 筆`,
    }).catch(() => {})

    return NextResponse.json({ created, skipped, total: rows.length, newBalance: lastBalance })
  } catch (error) {
    return handleApiError(error, 'bank-accounts.[id].import-statement')
  }
}
