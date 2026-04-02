/**
 * 財務模組測試資料種子檔
 * 執行: npx tsx prisma/seed-finance.ts
 *
 * 建立完整財務資料鏈：
 *   FiscalPeriod → BankAccount → AR/AP → PaymentRecord → ReceiptRecord/DisbursementRecord
 *   → JournalEntry → BankTransaction → PettyCash → Budget → FixedAsset → Cheque → VatFiling
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🏦 開始建立財務測試資料...\n')

  // ── 查找必要的參照資料 ──────────────────────────────────────────────
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
  const financeUser = await prisma.user.findFirst({ where: { email: 'finance@comfortplus.com' } })
  const salesUser = await prisma.user.findFirst({ where: { email: 'sales@comfortplus.com' } })
  const procUser = await prisma.user.findFirst({ where: { email: 'procurement@comfortplus.com' } })

  if (!adminUser || !financeUser) {
    console.error('❌ 找不到 admin 或 finance 用戶，請先執行 seed.ts')
    return
  }

  const customers = await prisma.customer.findMany({ take: 8, orderBy: { code: 'asc' } })
  const suppliers = await prisma.supplier.findMany({ take: 5, orderBy: { code: 'asc' } })

  if (customers.length === 0 || suppliers.length === 0) {
    console.error('❌ 找不到客戶或供應商，請先執行 seed.ts')
    return
  }

  // 查找會計科目
  const accounts = await prisma.accountingAccount.findMany({
    where: { code: { in: ['1102', '1103', '1130', '1150', '1180', '2130', '2160', '4110', '4120', '5100', '6110', '6210', '6220'] } },
  })
  const acctMap = Object.fromEntries(accounts.map(a => [a.code, a.id]))

  if (!acctMap['1130'] || !acctMap['1102']) {
    console.error('❌ 找不到會計科目（1130/1102），請先執行 seed.ts')
    return
  }

  const fId = financeUser.id
  const aId = adminUser.id
  const sId = salesUser?.id ?? aId
  const pId = procUser?.id ?? aId

  // ══════════════════════════════════════════════════════════════════════
  // 1. 會計期間 FiscalPeriod — 2026年1~12月
  // ══════════════════════════════════════════════════════════════════════
  console.log('📅 建立會計期間...')
  for (let m = 1; m <= 12; m++) {
    const code = `2026-${String(m).padStart(2, '0')}`
    const start = new Date(2026, m - 1, 1)
    const end = new Date(2026, m, 0) // last day of month
    const isPast = m < 4 // Jan-Mar already "closed"
    await prisma.fiscalPeriod.upsert({
      where: { periodCode: code },
      update: {},
      create: {
        periodCode: code,
        periodType: 'MONTHLY',
        year: 2026,
        month: m,
        startDate: start,
        endDate: end,
        status: isPast ? 'CLOSED' : 'OPEN',
        closedAt: isPast ? new Date(2026, m, 5) : null,
        closedById: isPast ? fId : null,
        createdById: fId,
      },
    })
  }
  console.log('  ✅ 12 個月度期間')

  // ══════════════════════════════════════════════════════════════════════
  // 2. 銀行帳戶 BankAccount
  // ══════════════════════════════════════════════════════════════════════
  console.log('🏦 建立銀行帳戶...')
  const bankData = [
    { accountName: '營運主帳戶', accountNo: '012-456-789012', bankName: '中國信託商業銀行', bankCode: '822', accountType: 'CHECKING', openingBalance: 2500000, currentBalance: 3820000 },
    { accountName: '薪資專戶', accountNo: '013-789-012345', bankName: '台灣銀行', bankCode: '004', accountType: 'CHECKING', openingBalance: 800000, currentBalance: 650000 },
    { accountName: '外幣帳戶(USD)', accountNo: '014-321-654789', bankName: '兆豐國際商銀', bankCode: '017', accountType: 'SAVINGS', openingBalance: 50000, currentBalance: 42000, currency: 'USD' },
  ]
  const bankAccounts: { id: string; accountName: string }[] = []
  for (const b of bankData) {
    const acct = await prisma.bankAccount.upsert({
      where: { id: `seed-bank-${b.accountNo}` },
      update: { currentBalance: b.currentBalance },
      create: {
        id: `seed-bank-${b.accountNo}`,
        ...b,
        openingBalance: b.openingBalance,
        currentBalance: b.currentBalance,
        currency: b.currency ?? 'TWD',
        createdById: fId,
      },
    })
    bankAccounts.push({ id: acct.id, accountName: acct.accountName })
  }
  console.log(`  ✅ ${bankAccounts.length} 個銀行帳戶`)

  // ══════════════════════════════════════════════════════════════════════
  // 3. AR 應收帳款
  // ══════════════════════════════════════════════════════════════════════
  console.log('📋 建立應收/應付帳款...')
  const arData = [
    { cust: 0, amount: 380000, paid: 380000, status: 'PAID' as const, dueDate: new Date(2026, 0, 25), invoiceNo: 'INV-2026-0101' },
    { cust: 1, amount: 250000, paid: 120000, status: 'PARTIAL_PAID' as const, dueDate: new Date(2026, 1, 15), invoiceNo: 'INV-2026-0201' },
    { cust: 2, amount: 185000, paid: 185000, status: 'PAID' as const, dueDate: new Date(2026, 1, 28), invoiceNo: 'INV-2026-0202' },
    { cust: 3, amount: 520000, paid: 0, status: 'NOT_DUE' as const, dueDate: new Date(2026, 3, 15), invoiceNo: 'INV-2026-0301' },
    { cust: 0, amount: 290000, paid: 290000, status: 'PAID' as const, dueDate: new Date(2026, 2, 10), invoiceNo: 'INV-2026-0302' },
    { cust: 4, amount: 175000, paid: 0, status: 'DUE' as const, dueDate: new Date(2026, 2, 1), invoiceNo: 'INV-2026-0303' },
    { cust: 5, amount: 420000, paid: 200000, status: 'PARTIAL_PAID' as const, dueDate: new Date(2026, 3, 5), invoiceNo: 'INV-2026-0401' },
    { cust: 6, amount: 310000, paid: 0, status: 'NOT_DUE' as const, dueDate: new Date(2026, 4, 15), invoiceNo: 'INV-2026-0501' },
  ]

  const arRecords: { id: string; customerId: string; amount: number; invoiceNo: string }[] = []
  for (let i = 0; i < arData.length; i++) {
    const d = arData[i]
    const custIdx = Math.min(d.cust, customers.length - 1)
    const arId = `seed-ar-${String(i + 1).padStart(3, '0')}`
    const ar = await prisma.accountsReceivable.upsert({
      where: { id: arId },
      update: { paidAmount: d.paid, status: d.status },
      create: {
        id: arId,
        customerId: customers[custIdx].id,
        invoiceNo: d.invoiceNo,
        invoiceDate: new Date(d.dueDate.getTime() - 30 * 86400000),
        dueDate: d.dueDate,
        amount: d.amount,
        paidAmount: d.paid,
        status: d.status,
      },
    })
    arRecords.push({ id: ar.id, customerId: customers[custIdx].id, amount: d.amount, invoiceNo: d.invoiceNo })
  }
  console.log(`  ✅ ${arRecords.length} 筆應收帳款`)

  // ══════════════════════════════════════════════════════════════════════
  // 4. AP 應付帳款
  // ══════════════════════════════════════════════════════════════════════
  const apData = [
    { sup: 0, amount: 620000, paid: 620000, status: 'PAID' as const, dueDate: new Date(2026, 0, 20) },
    { sup: 1, amount: 340000, paid: 0, status: 'NOT_DUE' as const, dueDate: new Date(2026, 3, 10) },
    { sup: 2, amount: 280000, paid: 280000, status: 'PAID' as const, dueDate: new Date(2026, 1, 25) },
    { sup: 0, amount: 450000, paid: 200000, status: 'PARTIAL_PAID' as const, dueDate: new Date(2026, 2, 15) },
    { sup: 3, amount: 195000, paid: 0, status: 'DUE' as const, dueDate: new Date(2026, 2, 5) },
    { sup: 1, amount: 510000, paid: 0, status: 'NOT_DUE' as const, dueDate: new Date(2026, 4, 20) },
  ]

  const apRecords: { id: string; supplierId: string; amount: number }[] = []
  for (let i = 0; i < apData.length; i++) {
    const d = apData[i]
    const supIdx = Math.min(d.sup, suppliers.length - 1)
    const apId = `seed-ap-${String(i + 1).padStart(3, '0')}`
    const ap = await prisma.accountsPayable.upsert({
      where: { id: apId },
      update: { paidAmount: d.paid, status: d.status },
      create: {
        id: apId,
        supplierId: suppliers[supIdx].id,
        invoiceNo: `SUP-INV-${String(i + 1).padStart(4, '0')}`,
        invoiceDate: new Date(d.dueDate.getTime() - 30 * 86400000),
        dueDate: d.dueDate,
        amount: d.amount,
        paidAmount: d.paid,
        status: d.status,
      },
    })
    apRecords.push({ id: ap.id, supplierId: suppliers[supIdx].id, amount: d.amount })
  }
  console.log(`  ✅ ${apRecords.length} 筆應付帳款`)

  // ══════════════════════════════════════════════════════════════════════
  // 5. 收款記錄 ReceiptRecord（已收款的 AR）
  // ══════════════════════════════════════════════════════════════════════
  console.log('💰 建立收款/付款記錄...')
  const receiptData = [
    { arIdx: 0, amount: 380000, date: new Date(2026, 0, 22), method: '匯款' },
    { arIdx: 1, amount: 120000, date: new Date(2026, 1, 10), method: '匯款' },
    { arIdx: 2, amount: 185000, date: new Date(2026, 1, 25), method: '支票' },
    { arIdx: 4, amount: 290000, date: new Date(2026, 2, 8), method: '匯款' },
    { arIdx: 6, amount: 200000, date: new Date(2026, 3, 1), method: '現金' },
  ]
  let receiptCount = 0
  for (let i = 0; i < receiptData.length; i++) {
    const d = receiptData[i]
    const ar = arRecords[d.arIdx]
    const rcptId = `seed-rcpt-${String(i + 1).padStart(3, '0')}`
    const exists = await prisma.receiptRecord.findUnique({ where: { id: rcptId } })
    if (!exists) {
      await prisma.receiptRecord.create({
        data: {
          id: rcptId,
          arId: ar.id,
          customerId: ar.customerId,
          receiptDate: d.date,
          receiptMethod: d.method,
          amount: d.amount,
          reconcileStatus: 'RECONCILED',
          createdById: fId,
        },
      })
      receiptCount++
    }
  }
  console.log(`  ✅ ${receiptCount} 筆收款記錄`)

  // ══════════════════════════════════════════════════════════════════════
  // 6. 付款記錄 DisbursementRecord（已付款的 AP）
  // ══════════════════════════════════════════════════════════════════════
  const disbData = [
    { apIdx: 0, amount: 620000, date: new Date(2026, 0, 18), method: '匯款' },
    { apIdx: 2, amount: 280000, date: new Date(2026, 1, 20), method: '匯款' },
    { apIdx: 3, amount: 200000, date: new Date(2026, 2, 10), method: '支票' },
  ]
  let disbCount = 0
  for (let i = 0; i < disbData.length; i++) {
    const d = disbData[i]
    const ap = apRecords[d.apIdx]
    const disbId = `seed-disb-${String(i + 1).padStart(3, '0')}`
    const exists = await prisma.disbursementRecord.findUnique({ where: { id: disbId } })
    if (!exists) {
      await prisma.disbursementRecord.create({
        data: {
          id: disbId,
          apId: ap.id,
          payee: suppliers.find(s => s.id === ap.supplierId)?.name ?? '供應商',
          paymentDate: d.date,
          paymentMethod: d.method,
          amount: d.amount,
          createdById: fId,
        },
      })
      disbCount++
    }
  }
  console.log(`  ✅ ${disbCount} 筆付款記錄（AP沖帳）`)

  // ══════════════════════════════════════════════════════════════════════
  // 7. 付款單 PaymentRecord（INCOMING 收款 + OUTGOING 付款）
  // ══════════════════════════════════════════════════════════════════════
  const paymentData = [
    // 收款
    { dir: 'INCOMING', type: 'FULL', custIdx: 0, amount: 380000, date: new Date(2026, 0, 22), method: '匯款', bank: '中信822', ref: 'TRF-0122-001', no: 'PAY-2026-001' },
    { dir: 'INCOMING', type: 'PROGRESS', custIdx: 1, amount: 120000, date: new Date(2026, 1, 10), method: '匯款', bank: '中信822', ref: 'TRF-0210-001', no: 'PAY-2026-002' },
    { dir: 'INCOMING', type: 'FULL', custIdx: 2, amount: 185000, date: new Date(2026, 1, 25), method: '支票', bank: '台銀004', ref: 'CHQ-0225-001', no: 'PAY-2026-003' },
    { dir: 'INCOMING', type: 'FULL', custIdx: 0, amount: 290000, date: new Date(2026, 2, 8), method: '匯款', bank: '中信822', ref: 'TRF-0308-001', no: 'PAY-2026-004' },
    { dir: 'INCOMING', type: 'PROGRESS', custIdx: 6, amount: 200000, date: new Date(2026, 3, 1), method: '現金', bank: '', ref: 'CASH-0401-001', no: 'PAY-2026-005' },
    // 付款
    { dir: 'OUTGOING', type: 'FULL', supIdx: 0, amount: 620000, date: new Date(2026, 0, 18), method: '匯款', bank: '中信822', ref: 'TRF-OUT-0118', no: 'PAY-2026-006' },
    { dir: 'OUTGOING', type: 'FULL', supIdx: 2, amount: 280000, date: new Date(2026, 1, 20), method: '匯款', bank: '中信822', ref: 'TRF-OUT-0220', no: 'PAY-2026-007' },
    { dir: 'OUTGOING', type: 'PROGRESS', supIdx: 0, amount: 200000, date: new Date(2026, 2, 10), method: '支票', bank: '台銀004', ref: 'CHQ-OUT-0310', no: 'PAY-2026-008' },
    { dir: 'OUTGOING', type: 'DEPOSIT', amount: 85000, date: new Date(2026, 2, 15), method: '現金', bank: '', ref: 'ADV-0315-001', no: 'PAY-2026-009', notes: '展覽訂金' },
    { dir: 'OUTGOING', type: 'DEPOSIT', amount: 35000, date: new Date(2026, 2, 20), method: '匯款', bank: '中信822', ref: 'ADV-0320-001', no: 'PAY-2026-010', notes: '設備維修預付' },
  ]
  let payCount = 0
  for (const d of paymentData) {
    const exists = await prisma.paymentRecord.findUnique({ where: { paymentNo: d.no } })
    if (exists) continue
    await prisma.paymentRecord.create({
      data: {
        paymentNo: d.no,
        direction: d.dir as 'INCOMING' | 'OUTGOING',
        paymentType: d.type as 'FULL' | 'PROGRESS' | 'DEPOSIT' | 'FINAL' | 'REFUND' | 'ADJUSTMENT',
        customerId: d.custIdx !== undefined ? customers[Math.min(d.custIdx, customers.length - 1)].id : null,
        supplierId: (d as { supIdx?: number }).supIdx !== undefined ? suppliers[Math.min((d as { supIdx: number }).supIdx, suppliers.length - 1)].id : null,
        amount: d.amount,
        paymentDate: d.date,
        paymentMethod: d.method,
        bankAccount: d.bank || null,
        referenceNo: d.ref,
        notes: (d as { notes?: string }).notes ?? null,
        createdById: fId,
      },
    })
    payCount++
  }
  console.log(`  ✅ ${payCount} 筆付款單（含收款5筆 + 付款3筆 + 暫付2筆）`)

  // ══════════════════════════════════════════════════════════════════════
  // 8. 銀行交易 BankTransaction
  // ══════════════════════════════════════════════════════════════════════
  console.log('🏦 建立銀行交易記錄...')
  const mainBank = bankAccounts[0]
  const txData = [
    { date: new Date(2026, 0, 5), desc: '客戶匯款 - ' + customers[0].name, dir: 'CREDIT', amount: 380000, bal: 2880000, reconciled: true },
    { date: new Date(2026, 0, 10), desc: '薪資轉帳 1月', dir: 'DEBIT', amount: 450000, bal: 2430000, reconciled: true },
    { date: new Date(2026, 0, 18), desc: '供應商付款 - ' + suppliers[0].name, dir: 'DEBIT', amount: 620000, bal: 1810000, reconciled: true },
    { date: new Date(2026, 1, 3), desc: '客戶匯款 - ' + customers[1].name, dir: 'CREDIT', amount: 120000, bal: 1930000, reconciled: true },
    { date: new Date(2026, 1, 10), desc: '薪資轉帳 2月', dir: 'DEBIT', amount: 450000, bal: 1480000, reconciled: true },
    { date: new Date(2026, 1, 15), desc: '房租 2月', dir: 'DEBIT', amount: 85000, bal: 1395000, reconciled: true },
    { date: new Date(2026, 1, 20), desc: '供應商付款', dir: 'DEBIT', amount: 280000, bal: 1115000, reconciled: true },
    { date: new Date(2026, 1, 25), desc: '客戶支票兌現 - ' + customers[2].name, dir: 'CREDIT', amount: 185000, bal: 1300000, reconciled: true },
    { date: new Date(2026, 2, 1), desc: '客戶匯款 - ' + customers[0].name, dir: 'CREDIT', amount: 290000, bal: 1590000, reconciled: true },
    { date: new Date(2026, 2, 5), desc: '保險費用', dir: 'DEBIT', amount: 32000, bal: 1558000, reconciled: true },
    { date: new Date(2026, 2, 10), desc: '薪資轉帳 3月', dir: 'DEBIT', amount: 450000, bal: 1108000, reconciled: true },
    { date: new Date(2026, 2, 15), desc: '展覽訂金', dir: 'DEBIT', amount: 85000, bal: 1023000, reconciled: false },
    { date: new Date(2026, 2, 20), desc: '設備維修', dir: 'DEBIT', amount: 35000, bal: 988000, reconciled: false },
    { date: new Date(2026, 3, 1), desc: '客戶現金入帳', dir: 'CREDIT', amount: 200000, bal: 1188000, reconciled: false },
    { date: new Date(2026, 3, 2), desc: 'B2C 電商平台撥款', dir: 'CREDIT', amount: 156000, bal: 1344000, reconciled: false },
  ]
  let txCount = 0
  for (let i = 0; i < txData.length; i++) {
    const d = txData[i]
    const txId = `seed-btx-${String(i + 1).padStart(3, '0')}`
    const exists = await prisma.bankTransaction.findUnique({ where: { id: txId } })
    if (!exists) {
      await prisma.bankTransaction.create({
        data: {
          id: txId,
          bankAccountId: mainBank.id,
          txDate: d.date,
          description: d.desc,
          direction: d.dir,
          amount: d.amount,
          balance: d.bal,
          isReconciled: d.reconciled,
          reconciledAt: d.reconciled ? d.date : null,
          createdById: fId,
        },
      })
      txCount++
    }
  }
  console.log(`  ✅ ${txCount} 筆銀行交易`)

  // ══════════════════════════════════════════════════════════════════════
  // 9. 傳票 JournalEntry + JournalEntryLine
  // ══════════════════════════════════════════════════════════════════════
  console.log('📒 建立傳票...')
  const periods = await prisma.fiscalPeriod.findMany({ where: { year: 2026 }, orderBy: { month: 'asc' } })
  const periodMap = Object.fromEntries(periods.map(p => [p.month!, p.id]))

  const journalData = [
    // 1月 銷貨收入 + AR
    {
      no: 'JE-SEED-001', date: new Date(2026, 0, 5), desc: '1月銷貨收入（客戶A）', type: 'AUTO', status: 'POSTED', month: 1,
      lines: [
        { code: '1130', debit: 399000, credit: 0, desc: '應收帳款 — ' + customers[0].name },
        { code: '4110', debit: 0, credit: 380000, desc: '銷貨收入' },
        { code: '2160', debit: 0, credit: 19000, desc: '銷項稅額 5%' },
      ],
    },
    // 1月 收款 → 沖銷AR
    {
      no: 'JE-SEED-002', date: new Date(2026, 0, 22), desc: '1月收款沖銷（客戶A）', type: 'AUTO', status: 'POSTED', month: 1,
      lines: [
        { code: '1102', debit: 380000, credit: 0, desc: '銀行存款入帳' },
        { code: '1130', debit: 0, credit: 380000, desc: '沖銷應收帳款' },
      ],
    },
    // 1月 進貨 + AP
    {
      no: 'JE-SEED-003', date: new Date(2026, 0, 10), desc: '1月進貨（供應商A）', type: 'AUTO', status: 'POSTED', month: 1,
      lines: [
        { code: '1150', debit: 590476, credit: 0, desc: '存貨 — 成人紙尿布' },
        { code: '1180', debit: 29524, credit: 0, desc: '進項稅額 5%' },
        { code: '2130', debit: 0, credit: 620000, desc: '應付帳款' },
      ],
    },
    // 1月 付款 → 沖銷AP
    {
      no: 'JE-SEED-004', date: new Date(2026, 0, 18), desc: '1月付款沖銷（供應商A）', type: 'AUTO', status: 'POSTED', month: 1,
      lines: [
        { code: '2130', debit: 620000, credit: 0, desc: '沖銷應付帳款' },
        { code: '1102', debit: 0, credit: 620000, desc: '銀行存款付出' },
      ],
    },
    // 1月 薪資
    {
      no: 'JE-SEED-005', date: new Date(2026, 0, 31), desc: '1月薪資費用', type: 'MANUAL', status: 'POSTED', month: 1,
      lines: [
        { code: '6110', debit: 280000, credit: 0, desc: '業務人員薪資' },
        { code: '6210', debit: 170000, credit: 0, desc: '管理人員薪資' },
        { code: '1102', debit: 0, credit: 450000, desc: '銀行轉帳' },
      ],
    },
    // 2月 銷貨
    {
      no: 'JE-SEED-006', date: new Date(2026, 1, 5), desc: '2月銷貨收入', type: 'AUTO', status: 'POSTED', month: 2,
      lines: [
        { code: '1130', debit: 456750, credit: 0, desc: '應收帳款' },
        { code: '4110', debit: 0, credit: 435000, desc: '銷貨收入' },
        { code: '2160', debit: 0, credit: 21750, desc: '銷項稅額' },
      ],
    },
    // 2月 COGS
    {
      no: 'JE-SEED-007', date: new Date(2026, 1, 5), desc: '2月銷貨成本', type: 'AUTO', status: 'POSTED', month: 2,
      lines: [
        { code: '5100', debit: 290000, credit: 0, desc: '銷貨成本' },
        { code: '1150', debit: 0, credit: 290000, desc: '存貨減少' },
      ],
    },
    // 2月 薪資
    {
      no: 'JE-SEED-008', date: new Date(2026, 1, 28), desc: '2月薪資費用', type: 'MANUAL', status: 'POSTED', month: 2,
      lines: [
        { code: '6110', debit: 280000, credit: 0, desc: '業務人員薪資' },
        { code: '6210', debit: 170000, credit: 0, desc: '管理人員薪資' },
        { code: '1102', debit: 0, credit: 450000, desc: '銀行轉帳' },
      ],
    },
    // 2月 租金
    {
      no: 'JE-SEED-009', date: new Date(2026, 1, 15), desc: '2月辦公室租金', type: 'MANUAL', status: 'POSTED', month: 2,
      lines: [
        { code: '6220', debit: 85000, credit: 0, desc: '租金費用' },
        { code: '1102', debit: 0, credit: 85000, desc: '銀行轉帳' },
      ],
    },
    // 3月 銷貨
    {
      no: 'JE-SEED-010', date: new Date(2026, 2, 3), desc: '3月銷貨收入', type: 'AUTO', status: 'POSTED', month: 3,
      lines: [
        { code: '1130', debit: 608650, credit: 0, desc: '應收帳款' },
        { code: '4110', debit: 0, credit: 427000, desc: 'B2B 銷貨收入' },
        { code: '4120', debit: 0, credit: 153000, desc: 'B2C 銷貨收入' },
        { code: '2160', debit: 0, credit: 28650, desc: '銷項稅額' },
      ],
    },
    // 3月 COGS
    {
      no: 'JE-SEED-011', date: new Date(2026, 2, 3), desc: '3月銷貨成本', type: 'AUTO', status: 'POSTED', month: 3,
      lines: [
        { code: '5100', debit: 380000, credit: 0, desc: '銷貨成本' },
        { code: '1150', debit: 0, credit: 380000, desc: '存貨減少' },
      ],
    },
    // 3月 薪資
    {
      no: 'JE-SEED-012', date: new Date(2026, 2, 31), desc: '3月薪資費用', type: 'MANUAL', status: 'POSTED', month: 3,
      lines: [
        { code: '6110', debit: 280000, credit: 0, desc: '業務人員薪資' },
        { code: '6210', debit: 170000, credit: 0, desc: '管理人員薪資' },
        { code: '1102', debit: 0, credit: 450000, desc: '銀行轉帳' },
      ],
    },
    // 4月 (Draft，未過帳)
    {
      no: 'JE-SEED-013', date: new Date(2026, 3, 2), desc: '4月預估銷貨收入（草稿）', type: 'MANUAL', status: 'DRAFT', month: 4,
      lines: [
        { code: '1130', debit: 350000, credit: 0, desc: '預估應收帳款' },
        { code: '4110', debit: 0, credit: 350000, desc: '預估銷貨收入' },
      ],
    },
  ]

  let jeCount = 0
  for (const je of journalData) {
    const exists = await prisma.journalEntry.findUnique({ where: { entryNo: je.no } })
    if (exists) continue

    const totalDebit = je.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = je.lines.reduce((s, l) => s + l.credit, 0)

    await prisma.journalEntry.create({
      data: {
        entryNo: je.no,
        entryDate: je.date,
        description: je.desc,
        status: je.status,
        entryType: je.type,
        totalDebit,
        totalCredit,
        periodId: periodMap[je.month] ?? null,
        postedAt: je.status === 'POSTED' ? je.date : null,
        postedById: je.status === 'POSTED' ? fId : null,
        createdById: fId,
        lines: {
          create: je.lines.map((l, idx) => ({
            accountId: acctMap[l.code],
            debit: l.debit,
            credit: l.credit,
            description: l.desc,
            lineNo: idx + 1,
          })),
        },
      },
    })
    jeCount++
  }
  console.log(`  ✅ ${jeCount} 筆傳票（含 ${journalData.reduce((s, j) => s + j.lines.length, 0)} 個明細行）`)

  // ══════════════════════════════════════════════════════════════════════
  // 10. 零用金 PettyCashFund + PettyCashRecord
  // ══════════════════════════════════════════════════════════════════════
  console.log('💵 建立零用金...')
  const fund = await prisma.pettyCashFund.upsert({
    where: { id: 'seed-pcf-main' },
    update: {},
    create: {
      id: 'seed-pcf-main',
      name: '總公司零用金',
      holderName: financeUser.name ?? '財務',
      holderId: fId,
      department: '財務部',
      balance: 12500,
      limit: 50000,
    },
  })

  const pcRecords = [
    { no: 'PC-2026-001', date: new Date(2026, 0, 8), cat: '文具', desc: '影印紙 A4 x5包', amount: 750, vendor: '全國電子' },
    { no: 'PC-2026-002', date: new Date(2026, 0, 15), cat: '交通', desc: '計程車費 — 拜訪客戶', amount: 520, vendor: '' },
    { no: 'PC-2026-003', date: new Date(2026, 1, 3), cat: '餐飲', desc: '部門午餐會報', amount: 1800, vendor: '爭鮮' },
    { no: 'PC-2026-004', date: new Date(2026, 1, 20), cat: '郵資', desc: '寄送合約 — 掛號', amount: 280, vendor: '中華郵政' },
    { no: 'PC-2026-005', date: new Date(2026, 2, 5), cat: '維修', desc: '更換辦公室燈管', amount: 1200, vendor: '水電行' },
    { no: 'PC-2026-006', date: new Date(2026, 2, 12), cat: '文具', desc: '碳粉匣 x2', amount: 3200, vendor: '三井資訊' },
    { no: 'PC-2026-007', date: new Date(2026, 2, 25), cat: '雜項', desc: '飲水機清潔', amount: 800, vendor: '清潔公司' },
    { no: 'PC-2026-008', date: new Date(2026, 3, 1), cat: '交通', desc: '高鐵票 — 南部拜訪', amount: 2940, vendor: '台灣高鐵' },
  ]
  let pcCount = 0
  for (const d of pcRecords) {
    const exists = await prisma.pettyCashRecord.findUnique({ where: { recordNo: d.no } })
    if (!exists) {
      await prisma.pettyCashRecord.create({
        data: {
          fundId: fund.id,
          recordNo: d.no,
          date: d.date,
          category: d.cat,
          description: d.desc,
          amount: d.amount,
          vendor: d.vendor || null,
          hasReceipt: true,
          status: d.date < new Date(2026, 2, 1) ? 'CONFIRMED' : 'PENDING',
          submittedById: sId,
          reviewedById: d.date < new Date(2026, 2, 1) ? fId : null,
          reviewedAt: d.date < new Date(2026, 2, 1) ? new Date(d.date.getTime() + 2 * 86400000) : null,
        },
      })
      pcCount++
    }
  }
  console.log(`  ✅ ${pcCount} 筆零用金記錄`)

  // ══════════════════════════════════════════════════════════════════════
  // 11. 預算 Budget
  // ══════════════════════════════════════════════════════════════════════
  console.log('📊 建立預算...')
  const budgetData = [
    { dept: '業務部', cat: '薪資', budget: 3360000, actual: 840000 },
    { dept: '業務部', cat: '交通', budget: 360000, actual: 95000 },
    { dept: '業務部', cat: '交際', budget: 240000, actual: 52000 },
    { dept: '管理部', cat: '薪資', budget: 2040000, actual: 510000 },
    { dept: '管理部', cat: '租金', budget: 1020000, actual: 255000 },
    { dept: '管理部', cat: '水電', budget: 180000, actual: 41000 },
    { dept: '倉儲部', cat: '薪資', budget: 1440000, actual: 360000 },
    { dept: '倉儲部', cat: '耗材', budget: 120000, actual: 28000 },
    { dept: '採購部', cat: '薪資', budget: 960000, actual: 240000 },
    { dept: '財務部', cat: '薪資', budget: 960000, actual: 240000 },
  ]
  let budgetCount = 0
  for (const d of budgetData) {
    const exists = await prisma.budget.findFirst({
      where: { budgetYear: 2026, department: d.dept, category: d.cat },
    })
    if (!exists) {
      await prisma.budget.create({
        data: {
          budgetYear: 2026,
          department: d.dept,
          category: d.cat,
          description: `${d.dept}${d.cat}年度預算`,
          budgetAmount: d.budget,
          actualAmount: d.actual,
          createdById: fId,
        },
      })
      budgetCount++
    }
  }
  console.log(`  ✅ ${budgetCount} 筆預算`)

  // ══════════════════════════════════════════════════════════════════════
  // 12. 固定資產 FixedAsset
  // ══════════════════════════════════════════════════════════════════════
  console.log('🏗️ 建立固定資產...')
  const assetData = [
    { no: 'FA-2026-001', name: '辦公室冷氣 — 大金變頻', cat: 'EQUIPMENT', loc: '總公司 2F', cost: 85000, salvage: 5000, life: 8, date: new Date(2025, 5, 15) },
    { no: 'FA-2026-002', name: '堆高機 TOYOTA 2.5T', cat: 'VEHICLE', loc: '主倉庫', cost: 680000, salvage: 80000, life: 10, date: new Date(2024, 8, 1) },
    { no: 'FA-2026-003', name: 'Dell 伺服器 R750', cat: 'IT_EQUIPMENT', loc: '機房', cost: 320000, salvage: 20000, life: 5, date: new Date(2025, 0, 10) },
    { no: 'FA-2026-004', name: '辦公家具 — 會議桌椅組', cat: 'FURNITURE', loc: '總公司 3F 會議室', cost: 125000, salvage: 10000, life: 10, date: new Date(2025, 2, 1) },
    { no: 'FA-2026-005', name: '貨車 3.49T 中華菱利', cat: 'VEHICLE', loc: '車庫', cost: 920000, salvage: 120000, life: 8, date: new Date(2024, 3, 20) },
    { no: 'FA-2026-006', name: '自動包裝機', cat: 'MACHINERY', loc: '包裝區', cost: 450000, salvage: 30000, life: 7, date: new Date(2025, 6, 1) },
  ]
  let assetCount = 0
  for (const d of assetData) {
    const exists = await prisma.fixedAsset.findUnique({ where: { assetNo: d.no } })
    if (!exists) {
      await prisma.fixedAsset.create({
        data: {
          assetNo: d.no,
          name: d.name,
          category: d.cat,
          location: d.loc,
          purchaseDate: d.date,
          purchaseAmount: d.cost,
          salvageValue: d.salvage,
          usefulLifeYears: d.life,
          depreciationMethod: 'SL',
          status: 'ACTIVE',
          createdById: fId,
        },
      })
      assetCount++
    }
  }
  console.log(`  ✅ ${assetCount} 筆固定資產`)

  // ══════════════════════════════════════════════════════════════════════
  // 13. 支票 Cheque
  // ══════════════════════════════════════════════════════════════════════
  console.log('📝 建立支票...')

  const chequeFields = [
    { id: 'seed-chq-001', no: 'CHQ-R-001', type: 'RECEIVABLE', party: customers[2].name, partyId: customers[2].id, partyType: 'CUSTOMER', amount: 185000, issueDate: new Date(2026, 1, 10), dueDate: new Date(2026, 1, 25), status: 'CLEARED', bankName: '國泰世華' },
    { id: 'seed-chq-002', no: 'CHQ-R-002', type: 'RECEIVABLE', party: customers[5]?.name ?? customers[0].name, partyId: customers[5]?.id ?? customers[0].id, partyType: 'CUSTOMER', amount: 220000, issueDate: new Date(2026, 2, 1), dueDate: new Date(2026, 3, 1), status: 'DEPOSITED', bankName: '兆豐銀行' },
    { id: 'seed-chq-003', no: 'CHQ-P-001', type: 'PAYABLE', party: suppliers[0].name, partyId: suppliers[0].id, partyType: 'SUPPLIER', amount: 200000, issueDate: new Date(2026, 2, 5), dueDate: new Date(2026, 2, 10), status: 'CLEARED', bankName: '中國信託' },
    { id: 'seed-chq-004', no: 'CHQ-P-002', type: 'PAYABLE', party: suppliers[3]?.name ?? suppliers[0].name, partyId: suppliers[3]?.id ?? suppliers[0].id, partyType: 'SUPPLIER', amount: 150000, issueDate: new Date(2026, 3, 1), dueDate: new Date(2026, 4, 1), status: 'HOLDING', bankName: '台灣銀行' },
  ]
  let chqCount = 0
  for (const d of chequeFields) {
    const exists = await prisma.cheque.findUnique({ where: { id: d.id } })
    if (!exists) {
      await prisma.cheque.create({
        data: {
          id: d.id,
          chequeNo: d.no,
          chequeType: d.type,
          partyName: d.party,
          partyId: d.partyId,
          partyType: d.partyType,
          amount: d.amount,
          issueDate: d.issueDate,
          dueDate: d.dueDate,
          status: d.status,
          bankName: d.bankName,
          createdById: fId,
        },
      })
      chqCount++
    }
  }
  console.log(`  ✅ ${chqCount} 筆支票`)

  // ══════════════════════════════════════════════════════════════════════
  // 14. 營業稅申報 VatFiling
  // ══════════════════════════════════════════════════════════════════════
  console.log('📋 建立營業稅申報...')
  const vatData = [
    { no: 'VAT-2026-01', code: '2026-01/02', start: new Date(2026, 0, 1), end: new Date(2026, 1, 28), outBase: 815000, outTax: 40750, inBase: 590476, inTax: 29524, status: 'FILED' },
    { no: 'VAT-2026-02', code: '2026-03/04', start: new Date(2026, 2, 1), end: new Date(2026, 3, 30), outBase: 580000, outTax: 28650, inBase: 450000, inTax: 22500, status: 'DRAFT' },
  ]
  let vatCount = 0
  for (const d of vatData) {
    const exists = await prisma.vatFiling.findUnique({ where: { filingNo: d.no } })
    if (!exists) {
      await prisma.vatFiling.create({
        data: {
          filingNo: d.no,
          periodCode: d.code,
          startDate: d.start,
          endDate: d.end,
          outputTaxBase: d.outBase,
          outputTax: d.outTax,
          inputTaxBase: d.inBase,
          inputTax: d.inTax,
          netTax: d.outTax - d.inTax,
          status: d.status,
          filedAt: d.status === 'FILED' ? new Date(2026, 2, 15) : null,
          createdById: fId,
        },
      })
      vatCount++
    }
  }
  console.log(`  ✅ ${vatCount} 筆營業稅申報`)

  // ══════════════════════════════════════════════════════════════════════
  // 完成
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n✅ 財務測試資料建立完成！')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 現在可以到以下頁面查看資料：')
  console.log('   /finance                → 財務總覽（損益表、資產負債表、傳票、試算表）')
  console.log('   /payments               → 付款單')
  console.log('   /receipts               → 收款單')
  console.log('   /ar-aging               → 應收帳齡分析')
  console.log('   /ap-aging               → 應付帳齡分析')
  console.log('   /finance/general-ledger  → 總帳')
  console.log('   /finance/account-detail  → 科目明細')
  console.log('   /finance/cash-book       → 現金帳簿')
  console.log('   /finance/payment-summary → 付款合計')
  console.log('   /petty-cash             → 零用金')
  console.log('   /budget                 → 預算管理')
  console.log('   /fixed-assets           → 固定資產')
  console.log('   /bank-accounts          → 銀行帳戶')
  console.log('   /cheques                → 支票管理')
  console.log('   /vat-filings            → 營業稅申報')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
