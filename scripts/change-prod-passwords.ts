/**
 * 上線前密碼變更腳本
 *
 * 用法：
 *   ADMIN_PW=新密碼 GM_PW=新密碼 npx tsx scripts/change-prod-passwords.ts
 *
 * 或設定 .env 後執行：
 *   npx tsx scripts/change-prod-passwords.ts
 *
 * 若未提供某帳號的密碼，該帳號略過不更新。
 * 建議密碼長度 ≥ 16 字元，包含大小寫 + 數字 + 符號。
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

interface AccountDef {
  email: string
  envVar: string
  label: string
}

const ACCOUNTS: AccountDef[] = [
  { email: 'admin@comfortplus.com',       envVar: 'ADMIN_PW',       label: 'SUPER_ADMIN' },
  { email: 'gm@comfortplus.com',          envVar: 'GM_PW',          label: 'GM' },
  { email: 'manager@comfortplus.com',     envVar: 'MANAGER_PW',     label: 'SALES_MANAGER' },
  { email: 'sales@comfortplus.com',       envVar: 'SALES_PW',       label: 'SALES' },
  { email: 'warehouse@comfortplus.com',   envVar: 'WAREHOUSE_PW',   label: 'WAREHOUSE' },
  { email: 'finance@comfortplus.com',     envVar: 'FINANCE_PW',     label: 'FINANCE' },
  { email: 'procurement@comfortplus.com', envVar: 'PROCUREMENT_PW', label: 'PROCUREMENT' },
]

async function main() {
  console.log('🔐 ComfortPlus ERP — 密碼變更腳本\n')

  let updated = 0
  let skipped = 0

  for (const acct of ACCOUNTS) {
    const newPw = process.env[acct.envVar]

    if (!newPw) {
      console.log(`⏭  略過 ${acct.label} (${acct.email}) — 未設定 ${acct.envVar}`)
      skipped++
      continue
    }

    if (newPw.length < 12) {
      console.error(`❌ ${acct.label} 密碼太短（需 ≥ 12 字元），略過`)
      skipped++
      continue
    }

    const user = await prisma.user.findUnique({ where: { email: acct.email } })
    if (!user) {
      console.log(`⚠️  找不到帳號 ${acct.email}，略過`)
      skipped++
      continue
    }

    const hashed = await bcrypt.hash(newPw, 12)
    await prisma.user.update({
      where: { email: acct.email },
      data: { password: hashed },
    })

    console.log(`✅ 已更新 ${acct.label} (${acct.email})`)
    updated++
  }

  console.log(`\n完成：更新 ${updated} 個帳號，略過 ${skipped} 個`)

  if (updated === 0 && skipped === ACCOUNTS.length) {
    console.log('\n💡 使用方式：')
    console.log('   ADMIN_PW=StrongPass123! GM_PW=AnotherPass456@ npx tsx scripts/change-prod-passwords.ts')
    console.log('\n   或在 .env 加入：')
    ACCOUNTS.forEach(a => console.log(`   ${a.envVar}=your_password_here`))
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('執行失敗:', e)
  process.exit(1)
})
