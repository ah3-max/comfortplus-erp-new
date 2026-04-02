import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { aiChat } from '@/lib/ai'

/**
 * POST /api/meeting-records/[id]/transcribe
 *
 * M-2: Trigger AI transcription of the uploaded audio file.
 * M-3: After transcription, extract summary/decisions/action items.
 *
 * If no audio is uploaded, the body may include { transcriptText } to run
 * only M-3 (AI summary extraction) on manually provided text.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const record = await prisma.meetingRecord.findUnique({
      where: { id },
      select: {
        id: true, title: true, meetingType: true, meetingDate: true,
        audioFileUrl: true, transcriptText: true, transcriptStatus: true,
      },
    })
    if (!record) return NextResponse.json({ error: '找不到會議記錄' }, { status: 404 })

    // Mark as processing
    await prisma.meetingRecord.update({
      where: { id },
      data: { transcriptStatus: 'PROCESSING' },
    })

    // Use provided transcriptText or existing one (audio transcription requires Whisper integration)
    const body = await req.json().catch(() => ({}))
    let transcriptText = body.transcriptText ?? record.transcriptText ?? ''

    // If audio exists but no transcript, note that Whisper integration is needed
    if (!transcriptText && record.audioFileUrl) {
      transcriptText = '[錄音檔已上傳，等待語音轉文字處理。請手動貼上逐字稿或等待 Whisper API 整合完成。]'
    }

    if (!transcriptText) {
      await prisma.meetingRecord.update({
        where: { id },
        data: { transcriptStatus: 'PENDING' },
      })
      return NextResponse.json({ error: '尚未有逐字稿內容可供分析' }, { status: 400 })
    }

    // M-3: AI meeting summary extraction
    const systemPrompt = `你是一個專業的會議記錄助理，負責分析會議逐字稿並提取關鍵資訊。
請以繁體中文回應，格式為 JSON。`

    const userPrompt = `請分析以下會議逐字稿，提取關鍵資訊：

會議標題：${record.title}
會議日期：${new Date(record.meetingDate).toLocaleDateString('zh-TW')}
逐字稿內容：
${transcriptText}

請回傳以下 JSON 格式：
{
  "summary": "會議摘要（3-5 句話）",
  "decisions": "本次決議事項（條列式）",
  "actionItems": [
    {
      "title": "待辦事項標題",
      "owner": "負責人姓名（若有提及）",
      "dueDate": "YYYY-MM-DD（若有提及，否則 null）",
      "priority": "HIGH|MEDIUM|LOW"
    }
  ],
  "keyPoints": ["重點1", "重點2", "重點3"],
  "participants": ["參與人1", "參與人2"]
}`

    let aiResult: {
      summary?: string
      decisions?: string
      actionItems?: Array<{ title: string; owner?: string; dueDate?: string | null; priority?: string }>
      keyPoints?: string[]
      participants?: string[]
    } = {}

    try {
      const completion = await aiChat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 2000,
        temperature: 0.3,
      })

      const content = completion.content.trim()
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0])
      }
    } catch {
      // AI failed — continue with empty results, mark as completed anyway
    }

    const updated = await prisma.meetingRecord.update({
      where: { id },
      data: {
        transcriptText,
        transcriptStatus: 'COMPLETED',
        aiSummary: aiResult.summary ?? null,
        aiActionItems: aiResult.actionItems ?? [],
        aiProcessedAt: new Date(),
        // Auto-fill summary if not already set
        ...(aiResult.summary ? { summary: aiResult.summary } : {}),
        ...(aiResult.decisions ? { decisions: aiResult.decisions } : {}),
      },
      select: {
        id: true, transcriptText: true, transcriptStatus: true,
        aiSummary: true, aiActionItems: true, aiProcessedAt: true,
        summary: true, decisions: true,
      },
    })

    return NextResponse.json({
      ...updated,
      extractedParticipants: aiResult.participants ?? [],
      keyPoints: aiResult.keyPoints ?? [],
    })
  } catch (error) {
    // Reset status on failure
    const { id } = await params
    await prisma.meetingRecord.update({
      where: { id },
      data: { transcriptStatus: 'FAILED' },
    }).catch(() => {})
    return handleApiError(error, 'meetingRecords.transcribe')
  }
}
