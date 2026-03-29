import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()

  if (!token || !password || typeof token !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: '密碼至少需要 8 個字元' }, { status: 400 })
  }

  let userId: string
  try {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET ?? 'fallback-secret-change-me'
    )
    const { payload } = await jwtVerify(token, secret)
    if (payload.type !== 'password-reset' || typeof payload.sub !== 'string') {
      return NextResponse.json({ error: '連結無效' }, { status: 400 })
    }
    userId = payload.sub
  } catch {
    return NextResponse.json({ error: '連結已過期或無效，請重新申請' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  })

  return NextResponse.json({ ok: true, message: '密碼已成功重設，請重新登入' })
}
