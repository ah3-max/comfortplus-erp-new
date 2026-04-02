import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'audio/webm', 'audio/ogg']
const MAX_SIZE = 50 * 1024 * 1024 // 50MB for audio

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const record = await prisma.meetingRecord.findUnique({ where: { id }, select: { id: true } })
    if (!record) return NextResponse.json({ error: '找不到會議記錄' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳錄音檔' }, { status: 400 })

    if (!AUDIO_TYPES.includes(file.type) && !file.name.match(/\.(mp3|m4a|wav|webm|ogg)$/i)) {
      return NextResponse.json({ error: '僅接受 MP3、M4A、WAV、WebM 格式' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '錄音檔不可超過 50MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp3'
    const safeName = `meeting-${id}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'audio')
    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, safeName), buffer)

    const audioUrl = `/uploads/audio/${safeName}`

    const updated = await prisma.meetingRecord.update({
      where: { id },
      data: {
        audioFileUrl: audioUrl,
        transcriptStatus: 'PENDING',
      },
      select: { id: true, audioFileUrl: true, transcriptStatus: true },
    })

    return NextResponse.json(updated, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'meetingRecords.audio.upload')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const updated = await prisma.meetingRecord.update({
      where: { id },
      data: {
        audioFileUrl: null,
        audioDurationSec: null,
        transcriptText: null,
        transcriptStatus: 'PENDING',
        aiSummary: null,
        aiActionItems: undefined,
        aiProcessedAt: null,
      },
      select: { id: true },
    })
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'meetingRecords.audio.delete')
  }
}
