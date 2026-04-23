import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { aiVisionChat, getVisionConfig } from '@/lib/ai'
import { handleApiError } from '@/lib/api-error'

const RECEIPT_SYSTEM_PROMPT = `你是一個專業的收據/發票辨識系統。請從提供的內容中精確提取以下資訊，回傳 JSON 格式。

回傳格式（嚴格 JSON，不要加 markdown code block）：
{
  "vendor": "店家/供應商名稱",
  "taxId": "統一編號（8位數字，沒有則為 null）",
  "invoiceNumber": "發票號碼（如 AB-12345678，沒有則為 null）",
  "date": "YYYY-MM-DD",
  "items": [
    { "description": "品項描述", "amount": 金額數字, "category": "分類代碼" }
  ],
  "totalAmount": 總金額數字,
  "currency": "TWD",
  "notes": "其他備註（付款方式等）"
}

分類代碼對照：
- TRANSPORT: 交通費（計程車、高鐵、油資、停車費）
- MEAL: 餐費
- HOTEL: 住宿費
- OFFICE: 辦公用品
- ENTERTAINMENT: 交際費
- TRAINING: 教育訓練
- OTHER: 其他

規則：
1. 金額必須是數字，不要包含逗號或貨幣符號
2. 如果看不清楚的欄位，設為 null
3. 日期格式必須是 YYYY-MM-DD
4. 統編必須正好 8 位數字
5. 如果一張收據有多個品項，分別列出
6. 如果只有總金額沒有明細，items 只放一筆並用收據標題當描述
7. category 根據品項內容自動判斷`

const MAX_FILE_SIZE = 10 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function parseAiJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const visionCfg = await getVisionConfig()
    if (!visionCfg) {
      return NextResponse.json(
        { error: '視覺辨識尚未設定，請聯繫管理員至「設定 → AI」配置 Vision API' },
        { status: 422 },
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳收據檔案' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '檔案大小不可超過 10MB' }, { status: 400 })
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = IMAGE_TYPES.includes(file.type)

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: '僅支援 JPEG/PNG/WebP/GIF/PDF 格式' }, { status: 400 })
    }

    let result

    if (isPdf) {
      const { PDFParse } = await import('pdf-parse')
      const buffer = Buffer.from(await file.arrayBuffer())
      const parser = new PDFParse(buffer)
      const textResult = await parser.getText()

      if (!textResult.text || textResult.text.trim().length < 10) {
        return NextResponse.json(
          { error: 'PDF 無法提取文字（可能是純圖片掃描檔），請改用圖片格式上傳' },
          { status: 422 },
        )
      }

      result = await aiVisionChat({
        systemPrompt: RECEIPT_SYSTEM_PROMPT,
        userText: `以下是從 PDF 收據/發票提取的文字內容，請辨識並提取資訊：\n\n${textResult.text.slice(0, 8000)}`,
        temperature: 0.1,
        maxTokens: 2048,
      })
    } else {
      const buffer = Buffer.from(await file.arrayBuffer())
      const imageBase64 = buffer.toString('base64')
      const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

      result = await aiVisionChat({
        systemPrompt: RECEIPT_SYSTEM_PROMPT,
        userText: '請辨識這張收據/發票的內容，提取所有可見資訊。',
        imageBase64,
        mimeType,
        temperature: 0.1,
        maxTokens: 2048,
      })
    }

    let parsed: Record<string, unknown>
    try {
      parsed = parseAiJson(result.content)
    } catch {
      return NextResponse.json({
        error: 'AI 回傳格式解析失敗，請重試或手動輸入',
        rawContent: result.content,
      }, { status: 422 })
    }

    return NextResponse.json({
      data: parsed,
      provider: result.provider,
      model: result.model,
    })
  } catch (error) {
    return handleApiError(error, 'ai.receipt-scan')
  }
}
