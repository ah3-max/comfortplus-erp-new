/**
 * auto-journal.ts
 * Creates JournalEntry + JournalEntryLine records for standard transaction types.
 * Idempotent: checks referenceType+referenceId before creating to prevent duplicates.
 */
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'

export type AutoJournalType =
  | 'SALES_CONFIRM'       // 銷貨確認：Dr 應收帳款 / Cr 銷貨收入 + Cr 銷項稅額
  | 'SALES_COGS'          // 銷貨成本：Dr 銷貨成本 / Cr 存貨
  | 'SALES_RETURN'        // 銷貨退回：Dr 銷貨退回 + Dr 存貨 / Cr 應收帳款
  | 'PURCHASE_RECEIVE'    // 採購進貨：Dr 存貨 + Dr 進項稅額 / Cr 應付帳款
  | 'PURCHASE_RETURN'     // 採購退貨：Dr 應付帳款 / Cr 存貨
  | 'PAYMENT_IN'          // 收款：Dr 銀行存款 / Cr 應收帳款
  | 'PAYMENT_OUT'         // 付款：Dr 應付帳款 / Cr 銀行存款

/**
 * Standard account code map (from seed).
 * These are looked up from AccountingAccount by code.
 */
const ACCOUNT_CODES = {
  AR:           '1130', // 應收帳款
  INVENTORY:    '1150', // 存貨
  INPUT_TAX:    '1180', // 進項稅額
  AP:           '2130', // 應付帳款
  OUTPUT_TAX:   '2160', // 銷項稅額
  REVENUE_B2B:  '4110', // B2B 銷貨收入
  REVENUE_B2C:  '4120', // B2C 銷貨收入
  REVENUE:      '4100', // 銷貨收入（通用）
  SALES_RETURN: '4200', // 銷貨退回
  COGS:         '5100', // 銷貨成本
  PURCHASE_COST:'5110', // 進貨成本
  BANK:         '1102', // 銀行存款（fallback: 1100 現金及約當現金）
}

const VAT_RATE = 0.05

interface AutoJournalParams {
  type: AutoJournalType
  referenceType: string
  referenceId: string
  entryDate: Date
  description: string
  amount: number           // 不含稅金額
  taxAmount?: number       // 稅額（若未提供，由 amount × 5% 計算）
  cogAmount?: number       // 銷貨成本（SALES_COGS / SALES_CONFIRM+COGS 使用）
  createdById: string
  customerType?: 'B2B' | 'B2C' | 'OTHER' // 決定收入科目
}

/** Look up account IDs by codes, cache in a local map */
async function getAccountIds(codes: string[]): Promise<Map<string, string>> {
  const accounts = await prisma.accountingAccount.findMany({
    where: { code: { in: codes }, isActive: true },
    select: { id: true, code: true },
  })
  const map = new Map<string, string>()
  for (const a of accounts) map.set(a.code, a.id)
  return map
}

/**
 * Create an auto journal entry.
 * Returns null if entry already exists (idempotent).
 */
export async function createAutoJournal(params: AutoJournalParams): Promise<string | null> {
  const { type, referenceType, referenceId, entryDate, description, amount, createdById } = params
  const taxAmount = params.taxAmount ?? Math.round(amount * VAT_RATE)
  const totalWithTax = amount + taxAmount
  const cogAmount = params.cogAmount ?? 0

  // Idempotency check
  const existing = await prisma.journalEntry.findFirst({
    where: { referenceType, referenceId, entryType: 'AUTO' },
    select: { id: true },
  })
  if (existing) return existing.id

  const ids = await getAccountIds(Object.values(ACCOUNT_CODES))

  const getId = (code: string) => ids.get(code)

  // Bank account fallback (1102 or 1100)
  const bankId = getId(ACCOUNT_CODES.BANK) ?? ids.get('1100')

  const revenueCode = params.customerType === 'B2C' ? ACCOUNT_CODES.REVENUE_B2C : ACCOUNT_CODES.REVENUE_B2B

  type LineInput = { accountId: string | undefined; debit: number; credit: number; description: string; lineNo: number }

  let lines: LineInput[] = []
  let totalDebit = 0
  let totalCredit = 0

  switch (type) {
    case 'SALES_CONFIRM':
      // Dr 應收帳款 (含稅) / Cr 銷貨收入 + Cr 銷項稅額
      lines = [
        { accountId: getId(ACCOUNT_CODES.AR),          debit: totalWithTax, credit: 0,         description: `${description}—應收`, lineNo: 1 },
        { accountId: getId(revenueCode),                debit: 0,             credit: amount,    description: `${description}—銷貨收入`, lineNo: 2 },
        { accountId: getId(ACCOUNT_CODES.OUTPUT_TAX),  debit: 0,             credit: taxAmount, description: `${description}—銷項稅`, lineNo: 3 },
      ]
      totalDebit = totalWithTax
      totalCredit = amount + taxAmount
      break

    case 'SALES_COGS':
      // Dr 銷貨成本 / Cr 存貨
      if (cogAmount <= 0) return null
      lines = [
        { accountId: getId(ACCOUNT_CODES.COGS),      debit: cogAmount, credit: 0,         description: `${description}—成本`, lineNo: 1 },
        { accountId: getId(ACCOUNT_CODES.INVENTORY), debit: 0,         credit: cogAmount, description: `${description}—存貨減少`, lineNo: 2 },
      ]
      totalDebit = cogAmount
      totalCredit = cogAmount
      break

    case 'SALES_RETURN':
      // Dr 銷貨退回 + Dr 存貨 (COG) / Cr 應收帳款 (含稅)
      lines = [
        { accountId: getId(ACCOUNT_CODES.SALES_RETURN), debit: amount,    credit: 0,            description: `${description}—退回`, lineNo: 1 },
        { accountId: getId(ACCOUNT_CODES.INPUT_TAX),    debit: taxAmount, credit: 0,             description: `${description}—稅額`, lineNo: 2 },
        { accountId: getId(ACCOUNT_CODES.AR),           debit: 0,         credit: totalWithTax,  description: `${description}—沖應收`, lineNo: 3 },
      ]
      if (cogAmount > 0) {
        lines.push({ accountId: getId(ACCOUNT_CODES.INVENTORY), debit: cogAmount, credit: 0,         description: `${description}—退貨入庫`, lineNo: 4 })
        lines.push({ accountId: getId(ACCOUNT_CODES.COGS),      debit: 0,         credit: cogAmount, description: `${description}—成本回沖`, lineNo: 5 })
        totalDebit = amount + taxAmount + cogAmount
        totalCredit = totalWithTax + cogAmount
      } else {
        totalDebit = amount + taxAmount
        totalCredit = totalWithTax
      }
      break

    case 'PURCHASE_RECEIVE':
      // Dr 存貨 + Dr 進項稅額 / Cr 應付帳款 (含稅)
      lines = [
        { accountId: getId(ACCOUNT_CODES.INVENTORY),   debit: amount,    credit: 0,            description: `${description}—進貨`, lineNo: 1 },
        { accountId: getId(ACCOUNT_CODES.INPUT_TAX),   debit: taxAmount, credit: 0,             description: `${description}—進項稅`, lineNo: 2 },
        { accountId: getId(ACCOUNT_CODES.AP),          debit: 0,         credit: totalWithTax,  description: `${description}—應付`, lineNo: 3 },
      ]
      totalDebit = amount + taxAmount
      totalCredit = totalWithTax
      break

    case 'PURCHASE_RETURN':
      // Dr 應付帳款 / Cr 存貨 + Cr 進項稅額
      lines = [
        { accountId: getId(ACCOUNT_CODES.AP),          debit: totalWithTax, credit: 0,         description: `${description}—沖應付`, lineNo: 1 },
        { accountId: getId(ACCOUNT_CODES.INVENTORY),   debit: 0,            credit: amount,    description: `${description}—退貨出庫`, lineNo: 2 },
        { accountId: getId(ACCOUNT_CODES.INPUT_TAX),   debit: 0,            credit: taxAmount, description: `${description}—進項稅額退回`, lineNo: 3 },
      ]
      totalDebit = totalWithTax
      totalCredit = amount + taxAmount
      break

    case 'PAYMENT_IN':
      // Dr 銀行存款 / Cr 應收帳款
      lines = [
        { accountId: bankId,                         debit: amount, credit: 0,      description: `${description}—收款`, lineNo: 1 },
        { accountId: getId(ACCOUNT_CODES.AR),        debit: 0,      credit: amount, description: `${description}—沖帳`, lineNo: 2 },
      ]
      totalDebit = amount
      totalCredit = amount
      break

    case 'PAYMENT_OUT':
      // Dr 應付帳款 / Cr 銀行存款
      lines = [
        { accountId: getId(ACCOUNT_CODES.AP), debit: amount, credit: 0,      description: `${description}—付款`, lineNo: 1 },
        { accountId: bankId,                  debit: 0,      credit: amount, description: `${description}—出帳`, lineNo: 2 },
      ]
      totalDebit = amount
      totalCredit = amount
      break
  }

  // Skip if any required account is missing
  if (lines.some(l => !l.accountId)) return null

  const entryNo = await generateSequenceNo('JOURNAL_ENTRY')

  const entry = await prisma.journalEntry.create({
    data: {
      entryNo,
      entryDate,
      description,
      status: 'POSTED',
      entryType: 'AUTO',
      referenceType,
      referenceId,
      totalDebit,
      totalCredit,
      postedAt: new Date(),
      postedById: createdById,
      createdById,
      lines: {
        create: lines
          .filter(l => l.debit > 0 || l.credit > 0)
          .map(l => ({
            accountId: l.accountId as string,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
            lineNo: l.lineNo,
          })),
      },
    },
    select: { id: true },
  })

  return entry.id
}

/**
 * Check if an auto journal already exists for a reference
 */
export async function hasAutoJournal(referenceType: string, referenceId: string): Promise<boolean> {
  const entry = await prisma.journalEntry.findFirst({
    where: { referenceType, referenceId, entryType: 'AUTO' },
    select: { id: true },
  })
  return !!entry
}
