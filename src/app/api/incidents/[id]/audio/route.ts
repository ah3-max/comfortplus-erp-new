import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

// GET — list audio records for incident
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const records = await prisma.incidentAudioRecord.findMany({
    where:   { incidentId: id },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(records)
}

// POST — upload audio file, save, trigger AI analysis async
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const transcript = formData.get('transcript') as string | null  // manual transcript

  if (!file && !transcript) return NextResponse.json({ error: '請上傳錄音檔或提供逐字稿' }, { status: 400 })

  let fileUrl: string | null = null
  let durationSec: number | null = null

  if (file) {
    const ext      = path.extname(file.name).replace('.', '').toLowerCase() || 'mp3'
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'incidents', 'audio')
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()))
    fileUrl = `/uploads/incidents/audio/${safeName}`
    durationSec = file.size ? Math.round(file.size / 16000) : null  // rough estimate
  }

  const record = await prisma.incidentAudioRecord.create({
    data: {
      incidentId:      id,
      audioFileUrl:    fileUrl ?? '',
      audioDurationSec: durationSec,
      transcriptText:  transcript || null,
      transcriptStatus: transcript ? 'COMPLETED' : 'PENDING',
      uploadedById:    session.user.id,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })

  // If transcript is provided, trigger AI analysis immediately
  if (transcript) {
    processAIAnalysis(record.id, transcript).catch(console.error)
  }

  return NextResponse.json(record, { status: 201 })
}

// PUT — update transcript or trigger AI re-analysis
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('recordId')
  if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

  const body = await req.json()

  if (body.transcript) {
    await prisma.incidentAudioRecord.update({
      where: { id: recordId },
      data:  { transcriptText: body.transcript, transcriptStatus: 'COMPLETED' as never },
    })
    processAIAnalysis(recordId, body.transcript).catch(console.error)
  }

  const updated = await prisma.incidentAudioRecord.findUnique({
    where:   { id: recordId },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })
  return NextResponse.json(updated)
}

// ── AI Analysis (runs async after response) ──────────────────────────────────
async function processAIAnalysis(recordId: string, transcript: string) {
  await prisma.incidentAudioRecord.update({
    where: { id: recordId },
    data:  { transcriptStatus: 'PROCESSING' as never },
  })

  try {
    const anthropic = new Anthropic()

    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role:    'user',
        content: `以下是一份照護機構客訴/照護事件的溝通逐字稿。請用繁體中文提供：
1. 【摘要】：2-3句話的整體摘要
2. 【會議記錄】：重點討論事項的結構化紀錄
3. 【結論】：最終決定或共識
4. 【待辦事項】：JSON陣列格式，每項包含 title、owner（如有提及）、dueDate（如有提及，格式YYYY-MM-DD）

逐字稿：
---
${transcript}
---

請以JSON格式回覆：
{
  "summary": "...",
  "meetingMinutes": "...",
  "conclusion": "...",
  "actionItems": [{"title":"...","owner":"...","dueDate":"..."}]
}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    await prisma.incidentAudioRecord.update({
      where: { id: recordId },
      data: {
        aiSummary:        parsed.summary        ?? null,
        aiMeetingMinutes: parsed.meetingMinutes ?? null,
        aiConclusion:     parsed.conclusion     ?? null,
        aiActionItems:    parsed.actionItems    ?? null,
        transcriptStatus: 'COMPLETED' as never,
        processedAt:      new Date(),
      },
    })
  } catch (err) {
    console.error('AI analysis failed:', err)
    await prisma.incidentAudioRecord.update({
      where: { id: recordId },
      data:  { transcriptStatus: 'FAILED' as never },
    })
  }
}
