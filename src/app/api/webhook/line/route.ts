/**
 * LINE Messaging API Webhook
 * POST /api/webhook/line
 *
 * 接收 LINE 平台事件：
 *   - follow   → 用戶加入官方帳號，記錄 LINE User ID
 *   - unfollow → 用戶封鎖/取消追蹤，清除 LINE User ID
 *   - message  → 用戶傳訊（目前僅 log，未來可接 AI 助手）
 *
 * 串接前必須在 LINE Developers Console 設定：
 *   Webhook URL: https://your-domain.com/api/webhook/line
 *   Use webhook: ON
 *   Auto-reply: OFF（避免重複回應）
 *
 * 環境變數：
 *   LINE_CHANNEL_SECRET          — 用於驗證請求簽名
 *   LINE_CHANNEL_ACCESS_TOKEN    — 用於推播回覆
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyLineSignature } from '@/lib/line-messaging'
import { logger } from '@/lib/logger'

// ── LINE Event Types ──────────────────────────────────────────────────────────

interface LineWebhookBody {
  destination: string
  events: LineEvent[]
}

interface LineEvent {
  type: 'follow' | 'unfollow' | 'message' | 'postback'
  source: {
    type: 'user' | 'group' | 'room'
    userId?: string
  }
  timestamp: number
  replyToken?: string
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. 讀取 raw body（簽名驗證需要原始字串）
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  // 2. 驗證簽名（防止偽造請求）
  if (!verifyLineSignature(rawBody, signature)) {
    logger.warn('line.webhook', 'Invalid LINE signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 3. 處理每個事件（非同步，不等待，LINE 要求 200ms 內回應）
  void handleEvents(body.events)

  // LINE 要求盡快回傳 200
  return NextResponse.json({ ok: true })
}

async function handleEvents(events: LineEvent[]): Promise<void> {
  for (const event of events) {
    const lineUserId = event.source.userId
    if (!lineUserId) continue

    try {
      switch (event.type) {
        case 'follow':
          // 用戶加入官方帳號 → 嘗試比對系統用戶並記錄 LINE User ID
          await handleFollow(lineUserId)
          break

        case 'unfollow':
          // 用戶封鎖 → 清除 LINE User ID（避免推播失敗）
          await handleUnfollow(lineUserId)
          break

        case 'message':
          // 未來可串接 AI 助手回覆
          logger.info('line.webhook', `Message from ${lineUserId}`)
          break

        default:
          break
      }
    } catch (e) {
      logger.error('line.webhook', `Event handling failed: ${event.type}`, e)
    }
  }
}

async function handleFollow(lineUserId: string): Promise<void> {
  // TODO: 實際串接時，這裡需要一個「綁定機制」
  // 方案 A（推薦）：用戶在系統內點「綁定 LINE」→ 產生一次性驗證碼
  //               → 傳給 LINE 官方帳號 → Webhook 收到後比對碼綁定
  // 方案 B（簡單）：用戶加入後傳送員工編號，系統自動比對綁定
  //
  // 目前僅記錄 log，待綁定機制實作後補上 DB 寫入
  logger.info('line.webhook', `New follower: ${lineUserId}`)
}

async function handleUnfollow(lineUserId: string): Promise<void> {
  // 清除用戶的 LINE User ID（取消追蹤後解除綁定）
  await prisma.user.updateMany({
    where: { lineUserId },
    data: { lineUserId: null },
  }).catch(() => {})
  logger.info('line.webhook', `Unfollowed: ${lineUserId}`)
}
