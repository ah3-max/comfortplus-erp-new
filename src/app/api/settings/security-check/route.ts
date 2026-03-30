import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * GET /api/settings/security-check
 * SUPER_ADMIN only — checks for known security risks:
 *   1. Test accounts with default weak passwords still active
 *   2. CRON_SECRET missing or too short
 */

const TEST_ACCOUNTS: { email: string; password: string }[] = [
  { email: 'admin@comfortplus.com',       password: 'admin1234' },
  { email: 'gm@comfortplus.com',          password: 'gm12345678' },
  { email: 'manager@comfortplus.com',     password: 'manager1234' },
  { email: 'sales@comfortplus.com',       password: 'sales1234' },
  { email: 'warehouse@comfortplus.com',   password: 'warehouse1234' },
  { email: 'finance@comfortplus.com',     password: 'finance1234' },
  { email: 'procurement@comfortplus.com', password: 'procurement1234' },
]

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const warnings: string[] = []

  // Check CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    warnings.push('CRON_SECRET 未設定，定時任務無法安全執行')
  } else if (cronSecret.length < 32) {
    warnings.push(`CRON_SECRET 長度不足（${cronSecret.length} 字元，應 ≥32）`)
  }

  // Check test accounts with default passwords
  const weakAccounts: string[] = []
  const emails = TEST_ACCOUNTS.map(a => a.email)
  const users = await prisma.user.findMany({
    where: { email: { in: emails }, isActive: true },
    select: { email: true, password: true },
  })

  for (const user of users) {
    if (!user.password) continue
    const account = TEST_ACCOUNTS.find(a => a.email === user.email)
    if (!account) continue
    const isDefault = await bcrypt.compare(account.password, user.password)
    if (isDefault) weakAccounts.push(user.email)
  }

  if (weakAccounts.length > 0) {
    warnings.push(`${weakAccounts.length} 個測試帳號仍使用預設弱密碼：${weakAccounts.join('、')}`)
  }

  return NextResponse.json({
    ok: warnings.length === 0,
    warnings,
    checkedAt: new Date().toISOString(),
  })
}
