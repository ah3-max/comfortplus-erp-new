import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { erpAiChat, aiChatStream } from '@/lib/ai'
import type { AiMessage } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history, context: contextType, stream } = await req.json() as {
    message: string
    history?: AiMessage[]
    context?: 'dashboard' | 'orders' | 'customers' | 'inventory'
    stream?: boolean
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: '請輸入訊息' }, { status: 400 })
  }

  // Build context based on the page the user is on
  let context = ''
  try {
    if (contextType === 'dashboard' || contextType === 'orders') {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const [monthOrders, monthRevenue, pendingOrders] = await Promise.all([
        prisma.salesOrder.count({ where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } }),
        prisma.salesOrder.aggregate({ where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } }, _sum: { totalAmount: true } }),
        prisma.salesOrder.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } }),
      ])
      context += `本月訂單：${monthOrders} 筆，營收：${Number(monthRevenue._sum.totalAmount ?? 0).toLocaleString()} TWD，待處理：${pendingOrders} 筆。`
    }

    if (contextType === 'customers') {
      const [totalCustomers, activeCustomers] = await Promise.all([
        prisma.customer.count({ where: { isActive: true } }),
        prisma.customer.count({ where: { isActive: true, salesOrders: { some: {} } } }),
      ])
      context += `客戶總數：${totalCustomers}，有下單記錄：${activeCustomers}。`
    }

    if (contextType === 'inventory') {
      const [totalSku, outOfStock] = await Promise.all([
        prisma.inventory.count(),
        prisma.inventory.count({ where: { quantity: 0 } }),
      ])
      const lowStockRaw = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Inventory" WHERE quantity > 0 AND quantity <= "safetyStock"
      `
      const lowStock = Number(lowStockRaw[0]?.count ?? 0)
      context += `庫存 SKU：${totalSku}，低庫存：${lowStock}，缺貨：${outOfStock}。`
    }
  } catch {
    // Context enrichment is best-effort
  }

  // Streaming mode
  if (stream) {
    try {
      const messages: AiMessage[] = [
        { role: 'system', content: `你是 ComfortPlus ERP 的 AI 助手。使用繁體中文回答。${context ? `\n系統數據：${context}` : ''}` },
        ...(history ?? []),
        { role: 'user', content: message },
      ]
      const readableStream = await aiChatStream({ messages, temperature: 0.4 })
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 })
    }
  }

  // Non-streaming mode
  try {
    const result = await erpAiChat(message, context, history)
    return NextResponse.json({
      content: result.content,
      provider: result.provider,
      model: result.model,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
