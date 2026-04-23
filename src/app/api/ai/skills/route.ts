import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { aiChat } from '@/lib/ai'
import type { AiMessage } from '@/lib/ai'
import {
  skillGenerateQuote,
  skillTodayShipments,
  skillInventoryCheck,
  skillFindCustomer,
  skillKpiStatus,
} from '@/lib/ai-skills'
import { prisma } from '@/lib/prisma'

/**
 * AI Skills Endpoint
 *
 * Two modes:
 *   1. Direct skill execution: { skill: "generate-quote", params: {...} }
 *   2. Natural language: { message: "幫A客戶出一張報價單" } → AI detects intent → executes skill
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    skill?: string
    params?: Record<string, unknown>
    message?: string
  }

  // ── Mode 1: Direct skill execution ───────────────────────
  if (body.skill) {
    const result = await executeSkill(body.skill, body.params ?? {}, session.user.id)
    return NextResponse.json(result)
  }

  // ── Mode 2: Natural language intent detection ────────────
  if (body.message) {
    const result = await detectAndExecute(body.message, session.user.id)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: '請提供 skill 或 message' }, { status: 400 })
}

// ── Skill Executor ───────────────────────────────────────────────────────────

async function executeSkill(
  skill: string,
  params: Record<string, unknown>,
  userId: string,
) {
  switch (skill) {
    case 'generate-quote':
      return skillGenerateQuote({
        customerId: params.customerId as string,
        productIds: params.productIds as string[] | undefined,
        userId,
      })

    case 'today-shipments':
      return skillTodayShipments()

    case 'inventory-check':
      return skillInventoryCheck()

    case 'find-customer':
      return skillFindCustomer(params.search as string)

    case 'kpi-status':
      return skillKpiStatus()

    default:
      return { success: false, skill, title: '未知技能', message: `找不到技能「${skill}」` }
  }
}

// ── Intent Detection via LLM ─────────────────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `你是 ERP 指令解析器。根據使用者的自然語言，判斷要執行哪個技能。

可用技能：
1. generate-quote — 產出報價單（需要客戶名稱，自動套用簽約價 > 層級價 > 目錄價）
2. today-shipments — 查詢今日出貨
3. inventory-check — 庫存盤點摘要
4. find-customer — 搜尋客戶
5. kpi-status — 查詢 KPI 目標達成狀況

回覆格式（只回 JSON，不要其他文字）：
{"skill": "技能名稱", "params": {"參數名": "值"}, "confidence": 0.9}

如果無法判斷，回覆：
{"skill": "none", "params": {}, "confidence": 0}

範例：
使用者：「幫忙看一下今天要送哪些地方」→ {"skill": "today-shipments", "params": {}, "confidence": 0.95}
使用者：「幫XX護理之家出一張報價單」→ {"skill": "generate-quote", "params": {"customerSearch": "XX護理之家"}, "confidence": 0.9}
使用者：「庫存狀況如何」→ {"skill": "inventory-check", "params": {}, "confidence": 0.9}
使用者：「找一下陽明的客戶」→ {"skill": "find-customer", "params": {"search": "陽明"}, "confidence": 0.9}
使用者：「KPI達成率多少」→ {"skill": "kpi-status", "params": {}, "confidence": 0.95}
使用者：「業績目標完成了嗎」→ {"skill": "kpi-status", "params": {}, "confidence": 0.9}`

async function detectAndExecute(message: string, userId: string) {
  try {
    const messages: AiMessage[] = [
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      { role: 'user', content: message },
    ]

    const result = await aiChat({ messages, temperature: 0.1, maxTokens: 256 })

    // Parse the JSON response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, skill: 'none', title: '無法理解', message: '抱歉，我無法理解這個指令。請試試：「今天要送哪些地方」、「幫XX客戶出報價單」、「庫存狀況」' }
    }

    const intent = JSON.parse(jsonMatch[0]) as {
      skill: string
      params: Record<string, unknown>
      confidence: number
    }

    if (intent.skill === 'none' || intent.confidence < 0.5) {
      return { success: false, skill: 'none', title: '無法理解', message: '抱歉，我無法判斷你想執行什麼動作。\n\n可用指令：\n• 「幫XX客戶出報價單」\n• 「今天要送哪些地方」\n• 「庫存盤點」\n• 「找一下XX客戶」' }
    }

    // If skill needs a customer search, resolve it first
    if (intent.skill === 'generate-quote' && intent.params.customerSearch) {
      const customer = await prisma.customer.findFirst({
        where: {
          isActive: true,
          OR: [
            { name: { contains: intent.params.customerSearch as string, mode: 'insensitive' } },
            { code: { contains: intent.params.customerSearch as string, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true },
      })

      if (!customer) {
        return {
          success: false, skill: 'generate-quote', title: '找不到客戶',
          message: `找不到「${intent.params.customerSearch}」這個客戶。請確認客戶名稱。`,
          actions: [{ label: '搜尋客戶', href: `/customers?search=${intent.params.customerSearch}` }],
        }
      }

      intent.params.customerId = customer.id
      delete intent.params.customerSearch
    }

    if (intent.skill === 'find-customer' && !intent.params.search) {
      // Extract search term from original message
      intent.params.search = message.replace(/找|搜尋|查|客戶|一下|的/g, '').trim()
    }

    return executeSkill(intent.skill, intent.params, userId)
  } catch (e) {
    return {
      success: false, skill: 'error', title: '執行錯誤',
      message: `AI 服務錯誤：${(e as Error).message}\n\n請確認 Ollama 服務是否已啟動。`,
    }
  }
}
