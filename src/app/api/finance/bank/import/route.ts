import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
const MAX_CSV_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * POST /api/finance/bank/import
 *
 * 銀行對帳單 CSV 上傳 + 自動比對（一步完成）
 *
 * Body: multipart/form-data
 *   file          — CSV 檔案（必填）
 *   bankAccountId — 目標銀行帳戶 ID（必填）
 *
 * CSV 欄位格式（首行為標題，自動跳過）：
 *   日期, 摘要, 支出, 存入, 餘額, 參考號
 *
 * 比對邏輯：
 *   金額完全相符 + 方向一致 + 日期差 ≤ 1 天 → isReconciled = true
 *   否則 → isReconciled = false（待確認）
 *
 * 回傳：{ created, reconciled, pending, skipped, total }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const bankAccountId = formData.get('bankAccountId')

    if (!bankAccountId || typeof bankAccountId !== 'string') {
      return NextResponse.json({ error: '請提供 bankAccountId' }, { status: 400 })
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '請上傳 CSV 檔案' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: '僅接受 .csv 格式' }, { status: 400 })
    }
    if (file.size > MAX_CSV_BYTES) {
      return NextResponse.json({ error: 'CSV 檔案超過 5MB 上限' }, { status: 400 })
    }

    const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } })
    if (!account) return NextResponse.json({ error: '找不到銀行帳戶' }, { status: 404 })

    // ── 解析 CSV ─────────────────────────────────────────────────
    const text = await file.text()
    const lines = text.trim().split(/\r?\n/)

    type CsvRow = {
      txDate: Date
      description: string
      direction: 'DEBIT' | 'CREDIT'
      amount: number
      balance?: number
      referenceNo?: string
    }

    const rows: CsvRow[] = []
    for (let i = 1; i < lines.length; i++) {
      // 簡單 CSV 解析：支援雙引號包覆欄位
      const cols = parseCsvLine(lines[i])
      if (cols.length < 4) continue

      const rawDate   = cols[0].trim()
      const desc      = cols[1].trim()
      const debitAmt  = parseFloat(cols[2].replace(/,/g, '')) || 0
      const creditAmt = parseFloat(cols[3].replace(/,/g, '')) || 0
      const balanceAmt = cols[4] ? parseFloat(cols[4].replace(/,/g, '')) : undefined
      const refNo     = cols[5]?.trim() || undefined

      if (!rawDate || !desc) continue
      if (debitAmt === 0 && creditAmt === 0) continue

      const txDate = new Date(rawDate)
      if (isNaN(txDate.getTime())) continue

      rows.push({
        txDate,
        description: desc,
        direction: creditAmt > 0 ? 'CREDIT' : 'DEBIT',
        amount: creditAmt > 0 ? creditAmt : debitAmt,
        balance: isNaN(balanceAmt as number) ? undefined : balanceAmt,
        referenceNo: refNo,
      })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: '無法解析有效資料，請確認 CSV 格式' }, { status: 400 })
    }

    // ── 取得同期間系統付款紀錄（用於自動比對）────────────────────
    const minDate = new Date(Math.min(...rows.map(r => r.txDate.getTime())))
    const maxDate = new Date(Math.max(...rows.map(r => r.txDate.getTime())))
    // 日期範圍擴展 ±1 天
    minDate.setDate(minDate.getDate() - 1)
    maxDate.setDate(maxDate.getDate() + 1)

    const systemPayments = await prisma.paymentRecord.findMany({
      where: { paymentDate: { gte: minDate, lte: maxDate } },
      select: { id: true, amount: true, paymentDate: true, direction: true },
    })

    const usedPaymentIds = new Set<string>()

    // ── 逐筆處理 ─────────────────────────────────────────────────
    let created = 0, reconciled = 0, pending = 0, skipped = 0
    let lastBalance = Number(account.currentBalance)

    for (const row of rows) {
      // 去重：同帳戶 + 同日 + 同金額 + 同方向 + 同摘要
      const existing = await prisma.bankTransaction.findFirst({
        where: {
          bankAccountId,
          txDate: row.txDate,
          amount: row.amount,
          direction: row.direction,
          description: row.description,
        },
      })
      if (existing) { skipped++; continue }

      lastBalance = row.balance !== undefined
        ? row.balance
        : lastBalance + (row.direction === 'CREDIT' ? row.amount : -row.amount)

      // 自動比對：金額相符 + 方向一致 + 日期差 ≤ 1 天
      const matched = systemPayments.find(p => {
        if (usedPaymentIds.has(p.id)) return false
        const amountMatch = Math.abs(Number(p.amount) - row.amount) < 0.01
        const dirMatch = (row.direction === 'CREDIT' && p.direction === 'INCOMING')
          || (row.direction === 'DEBIT'   && p.direction === 'OUTGOING')
        const daysDiff = Math.abs(p.paymentDate.getTime() - row.txDate.getTime()) / 86400000
        return amountMatch && dirMatch && daysDiff <= 1
      })

      if (matched) usedPaymentIds.add(matched.id)

      await prisma.bankTransaction.create({
        data: {
          bankAccountId,
          txDate:         row.txDate,
          description:    row.description,
          direction:      row.direction,
          amount:         row.amount,
          balance:        lastBalance,
          referenceNo:    row.referenceNo ?? null,
          paymentRecordId: matched?.id ?? null,
          isReconciled:   !!matched,
          reconciledAt:   matched ? new Date() : null,
          createdById:    session.user.id,
        },
      })

      created++
      matched ? reconciled++ : pending++
    }

    // 更新帳戶餘額
    if (created > 0) {
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: lastBalance },
      })
    }

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'bank', action: 'IMPORT_CSV', entityType: 'BankAccount',
      entityId: bankAccountId,
      entityLabel: `${account.accountName} 匯入 ${created} 筆（對帳 ${reconciled}，待確認 ${pending}）`,
    }).catch(() => {})

    return NextResponse.json({
      created,
      reconciled,
      pending,
      skipped,
      total: rows.length,
      newBalance: lastBalance,
    })
  } catch (error) {
    return handleApiError(error, 'bank.import')
  }
}

// ── CSV 單行解析（支援雙引號欄位）──────────────────────────────────
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
