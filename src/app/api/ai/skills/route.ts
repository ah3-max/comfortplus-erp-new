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
  skillSummarizeCustomer,
  skillDraftCollectionEmail,
  skillCreateTask,
  skillTopCustomers,
  skillPipelineHealth,
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

    case 'summarize-customer':
      return skillSummarizeCustomer({
        customerIdOrSearch: (params.customerSearch ?? params.customerId ?? params.search ?? '') as string,
      })

    case 'draft-collection-email':
      return skillDraftCollectionEmail({
        customerIdOrSearch: (params.customerSearch ?? params.customerId ?? params.search ?? '') as string,
      })

    case 'create-task':
      return skillCreateTask({
        text: (params.text ?? params.message ?? '') as string,
        userId,
      })

    case 'top-customers':
      return skillTopCustomers({
        metric: params.metric as 'revenue' | 'orders' | 'overdue' | undefined,
        limit: params.limit as number | undefined,
      })

    case 'pipeline-health': {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
      const isManager = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(user?.role ?? '')
      return skillPipelineHealth({ userId, isManager })
    }

    default:
      return { success: false, skill, title: '未知技能', message: `找不到技能「${skill}」` }
  }
}

// ── Intent Detection via LLM ─────────────────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `你是 ERP 指令解析器。根據使用者的自然語言，判斷要執行哪個技能。

可用技能：
1. generate-quote — 產出報價單（需客戶名稱，自動套用簽約價 > 層級價 > 目錄價）
2. today-shipments — 今日出貨總覽
3. inventory-check — 庫存盤點摘要
4. find-customer — 搜尋客戶
5. kpi-status — KPI 目標達成狀況
6. summarize-customer — 給一個客戶的完整摘要 + 建議下一步（需客戶名稱）
7. draft-collection-email — 為特定客戶草擬催收信（需客戶名稱）
8. create-task — 用自然語言建立任務（含期限、客戶、優先級解析）
9. top-customers — 前 N 名客戶排行（metric: revenue | orders | overdue）
10. pipeline-health — Pipeline 健康診斷（找 stuck deals、逾期任務、久未聯絡客戶）

回覆格式（只回 JSON，不要其他文字，不要 markdown code fence）：
{"skill": "技能名稱", "params": {...}, "confidence": 0.9}

無法判斷時：
{"skill": "none", "params": {}, "confidence": 0}

範例：
「今天要送哪些地方」→ {"skill": "today-shipments", "params": {}, "confidence": 0.95}
「幫XX護理之家出報價單」→ {"skill": "generate-quote", "params": {"customerSearch": "XX護理之家"}, "confidence": 0.9}
「庫存狀況如何」→ {"skill": "inventory-check", "params": {}, "confidence": 0.9}
「找一下陽明」→ {"skill": "find-customer", "params": {"search": "陽明"}, "confidence": 0.9}
「KPI達成率」→ {"skill": "kpi-status", "params": {}, "confidence": 0.95}
「陽明之家最近狀況怎樣」→ {"skill": "summarize-customer", "params": {"customerSearch": "陽明之家"}, "confidence": 0.9}
「介紹一下 C0015 這個客戶」→ {"skill": "summarize-customer", "params": {"customerSearch": "C0015"}, "confidence": 0.95}
「幫我寫一封催收信給仁愛之家」→ {"skill": "draft-collection-email", "params": {"customerSearch": "仁愛之家"}, "confidence": 0.95}
「提醒我下週三下午回訪陽明」→ {"skill": "create-task", "params": {"text": "下週三下午回訪陽明"}, "confidence": 0.9}
「業績前 10 大客戶」→ {"skill": "top-customers", "params": {"metric": "revenue", "limit": 10}, "confidence": 0.95}
「誰欠最多錢」→ {"skill": "top-customers", "params": {"metric": "overdue", "limit": 5}, "confidence": 0.9}
「訂單數最多的客戶」→ {"skill": "top-customers", "params": {"metric": "orders", "limit": 5}, "confidence": 0.9}
「pipeline 有沒有卡住的」→ {"skill": "pipeline-health", "params": {}, "confidence": 0.9}
「最近哪些客戶該跟進了」→ {"skill": "pipeline-health", "params": {}, "confidence": 0.85}`

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
      return { success: false, skill: 'none', title: '無法理解', message: '抱歉，我不確定你想執行什麼動作。\n\n你可以試試：\n• 「幫XX客戶出報價單」\n• 「陽明之家最近狀況怎樣」\n• 「寫一封催收信給仁愛之家」\n• 「提醒我下週三回訪XX」\n• 「業績前 10 大客戶」\n• 「pipeline 有沒有卡住的」\n• 「今天要送哪些地方」\n• 「庫存盤點」\n• 「KPI 達成率」' }
    }

    // For generate-quote, need to pre-resolve customerSearch to customerId
    // (other customer-search skills resolve inside themselves)
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
