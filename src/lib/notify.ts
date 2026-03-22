/**
 * Notification Service — 多通路通知
 *
 * 支援：
 *   1. 系統內通知 (Notification model) — 已有
 *   2. LINE Notify — 需設定 LINE_NOTIFY_TOKEN
 *   3. Email (SMTP) — 需設定 SMTP_* 環境變數
 *
 * 環境變數：
 *   LINE_NOTIFY_TOKEN    — LINE Notify access token
 *   SMTP_HOST            — e.g. smtp.gmail.com
 *   SMTP_PORT            — e.g. 587
 *   SMTP_USER            — email address
 *   SMTP_PASS            — app password
 *   SMTP_FROM            — sender display name
 */

import { prisma } from '@/lib/prisma'

// ── Types ────────────────────────────────────────────────────────────────────

interface NotifyOptions {
  /** User IDs to notify in-app */
  userIds?: string[]
  /** LINE Notify message */
  line?: boolean
  /** Email recipients */
  emails?: string[]
  /** Notification content */
  title: string
  message: string
  /** Link in ERP */
  linkUrl?: string
  /** Category for filtering */
  category?: string
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  /** Image URL to attach (LINE) */
  imageUrl?: string
}

// ── In-app notification ──────────────────────────────────────────────────────

async function notifyInApp(options: NotifyOptions) {
  if (!options.userIds?.length) return

  for (const userId of options.userIds) {
    await prisma.notification.create({
      data: {
        userId,
        title: options.title,
        message: options.message,
        linkUrl: options.linkUrl || null,
        category: options.category || 'SYSTEM',
        priority: options.priority || 'NORMAL',
      },
    })
  }
}

// ── LINE Notify ──────────────────────────────────────────────────────────────

async function notifyLine(options: NotifyOptions) {
  const token = process.env.LINE_NOTIFY_TOKEN
  if (!token) return

  const body = new URLSearchParams()
  body.append('message', `\n${options.title}\n${options.message}`)
  if (options.imageUrl) {
    body.append('imageThumbnail', options.imageUrl)
    body.append('imageFullsize', options.imageUrl)
  }

  try {
    await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
  } catch (e) {
    console.error('LINE Notify failed:', e)
  }
}

// ── Email (SMTP) ─────────────────────────────────────────────────────────────

async function notifyEmail(options: NotifyOptions) {
  // Email implementation requires nodemailer — skip if not configured
  const host = process.env.SMTP_HOST
  if (!host || !options.emails?.length) return

  // Lazy import nodemailer only when needed
  try {
    // @ts-ignore — nodemailer is optional, only loaded if SMTP configured
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    for (const email of options.emails) {
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM ?? 'ComfortPlus ERP'}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: options.title,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">${options.title}</h2>
            <p style="color: #475569; white-space: pre-wrap;">${options.message}</p>
            ${options.linkUrl ? `<p><a href="${process.env.NEXTAUTH_URL}${options.linkUrl}" style="color: #2563eb;">查看詳情 →</a></p>` : ''}
            ${options.imageUrl ? `<img src="${options.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-top: 12px;" />` : ''}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">此郵件由 ComfortPlus ERP 自動發送</p>
          </div>
        `,
      })
    }
  } catch (e) {
    console.error('Email notification failed:', e)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send notification through all configured channels.
 */
export async function notify(options: NotifyOptions): Promise<void> {
  const promises: Promise<void>[] = []

  // Always send in-app
  if (options.userIds?.length) {
    promises.push(notifyInApp(options))
  }

  // LINE if requested and configured
  if (options.line) {
    promises.push(notifyLine(options))
  }

  // Email if recipients provided
  if (options.emails?.length) {
    promises.push(notifyEmail(options))
  }

  await Promise.allSettled(promises)
}

/**
 * Notify all sales managers and GM.
 */
export async function notifyManagers(options: Omit<NotifyOptions, 'userIds'>): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { role: { in: ['SALES_MANAGER', 'GM', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  })

  await notify({
    ...options,
    userIds: managers.map(m => m.id),
  })
}

/**
 * Check which notification channels are configured.
 */
export function getNotifyChannels(): { inApp: boolean; line: boolean; email: boolean } {
  return {
    inApp: true,
    line: !!process.env.LINE_NOTIFY_TOKEN,
    email: !!process.env.SMTP_HOST,
  }
}
