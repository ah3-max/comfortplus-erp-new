import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

/**
 * POST /api/settings/test-notify
 *
 * Tests a notification channel by sending a test message.
 * Body: { channel: 'line' | 'email', email?: string }
 *
 * Access: SUPER_ADMIN, GM only
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as string
  if (!['SUPER_ADMIN', 'GM'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { channel } = body as { channel: string; email?: string }

  if (channel === 'line') {
    const token = process.env.LINE_NOTIFY_TOKEN
    if (!token) {
      return NextResponse.json({ ok: false, error: 'LINE_NOTIFY_TOKEN 未設定' })
    }

    try {
      const params = new URLSearchParams()
      params.append('message', '\n[ComfortPlus ERP] LINE Notify 連線測試成功 ✅')

      const res = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      const data = await res.json()
      if (res.ok) {
        return NextResponse.json({ ok: true, message: 'LINE 測試訊息已發送' })
      } else {
        return NextResponse.json({ ok: false, error: `LINE API 回應：${data.message ?? res.status}` })
      }
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message })
    }
  }

  if (channel === 'email') {
    const host = process.env.SMTP_HOST
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const to = body.email || user

    if (!host || !user || !pass) {
      return NextResponse.json({ ok: false, error: 'SMTP 設定不完整（需 SMTP_HOST / SMTP_USER / SMTP_PASS）' })
    }
    if (!to) {
      return NextResponse.json({ ok: false, error: '請提供收件地址' }, { status: 400 })
    }

    try {
      // @ts-ignore
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false,
        auth: { user, pass },
      })

      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM ?? 'ComfortPlus ERP'}" <${user}>`,
        to,
        subject: '[ComfortPlus ERP] Email 通知測試',
        html: `<p>Email 通知連線測試成功 ✅</p><p style="color:#94a3b8;font-size:12px;">此郵件由 ComfortPlus ERP 自動發送</p>`,
      })

      return NextResponse.json({ ok: true, message: `測試郵件已發送至 ${to}` })
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message })
    }
  }

  return NextResponse.json({ error: '不支援的通知通道，請指定 line 或 email' }, { status: 400 })
}
