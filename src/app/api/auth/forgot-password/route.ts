import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'
import { checkLoginRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const limited = checkLoginRateLimit(`reset:${ip}`)
  if (limited) return limited

  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: '請輸入 Email' }, { status: 400 })
  }

  // Always return success to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, name: true, isActive: true },
  })

  if (user && user.isActive) {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET ?? 'fallback-secret-change-me'
    )
    const token = await new SignJWT({ sub: user.id, type: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret)

    const resetUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3001'}/reset-password?token=${token}`

    if (process.env.SMTP_HOST) {
      try {
        // @ts-ignore - nodemailer is an optional dependency
        const nodemailer = await import('nodemailer')
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        })
        await transporter.sendMail({
          from: `"${process.env.SMTP_FROM ?? 'ComfortPlus ERP'}" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: '【ComfortPlus ERP】密碼重設連結',
          html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto"><h2 style="color:#1e293b">密碼重設</h2><p>您好 ${user.name}，</p><p>請點擊下方連結重設密碼（連結 5 分鐘內有效）：</p><p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">重設密碼</a></p><p style="color:#64748b;font-size:12px">如非本人操作，請忽略此郵件。</p></div>`,
        })
      } catch (e) {
        logger.error('forgot-password', 'Failed to send reset email', e, { userId: user.id })
      }
    } else {
      // Dev mode: log the reset URL to server console
      logger.info('forgot-password', '[DEV] Password reset URL', { email: user.email, resetUrl })
    }
  }

  return NextResponse.json({ ok: true, message: '如帳號存在，重設連結已寄出' })
}
