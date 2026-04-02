/**
 * LINE Messaging API — 個人化推播服務
 *
 * ⚠️  串接前置作業（由老闆/IT 完成）：
 *   1. 申請 LINE Official Account: https://account.line.biz/
 *   2. 進入 LINE Developers Console: https://developers.line.biz/
 *   3. 建立 Messaging API channel
 *   4. 取得 Channel Secret + Channel Access Token（長期）
 *   5. 填入 .env：LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN
 *   6. 設定 Webhook URL：https://your-domain.com/api/webhook/line
 *   7. 員工/客戶掃 QR 加入官方帳號後，系統自動記錄 LINE User ID
 *
 * 功能：
 *   - pushMessage()      → 推播給指定 LINE User ID
 *   - pushFlexOrder()    → 訂單狀態卡片（出貨/送達）
 *   - pushReminder()     → 工作提醒（巡迴/待辦）
 *   - verifySignature()  → 驗證 Webhook 簽名（安全）
 */

import crypto from 'crypto'

// ── Config ────────────────────────────────────────────────────────────────────

const LINE_API = 'https://api.line.me/v2/bot'
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? ''

function isConfigured(): boolean {
  return !!CHANNEL_ACCESS_TOKEN && !!CHANNEL_SECRET
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineTextMessage {
  type: 'text'
  text: string
}

export interface LineFlexMessage {
  type: 'flex'
  altText: string
  contents: object
}

export type LineMessage = LineTextMessage | LineFlexMessage

// ── Core Push ────────────────────────────────────────────────────────────────

/**
 * 推播訊息給指定 LINE User ID（單人）
 */
export async function pushMessage(
  lineUserId: string,
  messages: LineMessage[],
): Promise<boolean> {
  if (!isConfigured()) {
    console.warn('[LINE] LINE_CHANNEL_ACCESS_TOKEN 未設定，跳過推播')
    return false
  }

  try {
    const res = await fetch(`${LINE_API}/message/push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('[LINE] Push failed:', err)
      return false
    }
    return true
  } catch (e) {
    console.error('[LINE] Push error:', e)
    return false
  }
}

/**
 * 批次推播給多個 LINE User ID（最多 500 人）
 */
export async function multicastMessage(
  lineUserIds: string[],
  messages: LineMessage[],
): Promise<boolean> {
  if (!isConfigured() || lineUserIds.length === 0) return false

  try {
    const res = await fetch(`${LINE_API}/message/multicast`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: lineUserIds, messages }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('[LINE] Multicast failed:', err)
      return false
    }
    return true
  } catch (e) {
    console.error('[LINE] Multicast error:', e)
    return false
  }
}

// ── Flex Message Templates ────────────────────────────────────────────────────

/**
 * 訂單狀態推播卡片（出貨/送達/確認）
 *
 * 範例：酷鵬「您的訂單已送達」那種樣式
 */
export function buildOrderStatusFlex(params: {
  orderNo: string
  customerName: string
  status: '已確認' | '備貨中' | '已出貨' | '已送達' | '已取消'
  items?: string        // 例："成人紙尿褲 L × 3箱"
  shipDate?: string     // 例："2026-04-01"
  driverName?: string
  note?: string
  linkUrl?: string
}): LineFlexMessage {
  const statusColor: Record<string, string> = {
    已確認: '#2563EB',
    備貨中: '#D97706',
    已出貨: '#7C3AED',
    已送達: '#16A34A',
    已取消: '#DC2626',
  }

  const color = statusColor[params.status] ?? '#64748B'

  return {
    type: 'flex',
    altText: `【ComfortPlus】訂單 ${params.orderNo} ${params.status}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: color,
        contents: [
          {
            type: 'text',
            text: `訂單${params.status}`,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'xl',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '訂單編號', color: '#94A3B8', flex: 2, size: 'sm' },
              { type: 'text', text: params.orderNo, weight: 'bold', flex: 3, size: 'sm' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '客戶', color: '#94A3B8', flex: 2, size: 'sm' },
              { type: 'text', text: params.customerName, flex: 3, size: 'sm' },
            ],
          },
          ...(params.items ? [{
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '品項', color: '#94A3B8', flex: 2, size: 'sm' },
              { type: 'text', text: params.items, flex: 3, size: 'sm', wrap: true },
            ],
          }] : []),
          ...(params.shipDate ? [{
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '出貨日期', color: '#94A3B8', flex: 2, size: 'sm' },
              { type: 'text', text: params.shipDate, flex: 3, size: 'sm' },
            ],
          }] : []),
          ...(params.driverName ? [{
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '司機', color: '#94A3B8', flex: 2, size: 'sm' },
              { type: 'text', text: params.driverName, flex: 3, size: 'sm' },
            ],
          }] : []),
          ...(params.note ? [{
            type: 'text',
            text: params.note,
            color: '#64748B',
            size: 'xs',
            wrap: true,
            margin: 'md',
          }] : []),
        ],
      },
      ...(params.linkUrl ? {
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '查看訂單詳情',
                uri: `${process.env.NEXTAUTH_URL}${params.linkUrl}`,
              },
              style: 'primary',
              color,
            },
          ],
        },
      } : {}),
    },
  }
}

/**
 * 工作提醒推播卡片（巡迴/待辦/下班提醒）
 */
export function buildReminderFlex(params: {
  type: '機構巡迴' | '待辦提醒' | '下班前提醒' | '每日清單'
  title: string
  body: string
  items?: string[]      // 清單條目
  urgency?: 'normal' | 'high'
  linkUrl?: string
}): LineFlexMessage {
  const color = params.urgency === 'high' ? '#DC2626' : '#2563EB'
  const icon = {
    機構巡迴: '🏥',
    待辦提醒: '📋',
    下班前提醒: '🔔',
    每日清單: '📅',
  }[params.type]

  return {
    type: 'flex',
    altText: `【ComfortPlus】${icon} ${params.title}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: color,
        contents: [
          {
            type: 'text',
            text: `${icon} ${params.type}`,
            color: '#FFFFFF',
            size: 'sm',
          },
          {
            type: 'text',
            text: params.title,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'lg',
            wrap: true,
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: params.body,
            wrap: true,
            color: '#374151',
          },
          ...(params.items?.length ? [
            { type: 'separator', margin: 'md' },
            ...params.items.map(item => ({
              type: 'text',
              text: `• ${item}`,
              size: 'sm',
              color: '#64748B',
              wrap: true,
            })),
          ] : []),
        ],
      },
      ...(params.linkUrl ? {
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '前往系統確認',
                uri: `${process.env.NEXTAUTH_URL}${params.linkUrl}`,
              },
              style: 'primary',
              color,
            },
          ],
        },
      } : {}),
    },
  }
}

// ── Webhook Signature Verification ───────────────────────────────────────────

/**
 * 驗證 LINE Webhook 請求的簽名（防偽造）
 * 在 /api/webhook/line route 中使用
 */
export function verifyLineSignature(body: string, signature: string): boolean {
  if (!CHANNEL_SECRET) return false
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64')
  return hash === signature
}
