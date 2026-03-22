import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_BASE = path.join(process.cwd(), 'public', 'uploads')

type QuickInputType = 'visit-note' | 'complaint' | 'audio-upload' | 'photo-upload'

/**
 * Generate a unique filename: {timestamp}-{random}. preserving the original extension.
 */
function uniqueFilename(originalName: string): string {
  const ext = path.extname(originalName) || ''
  const ts = Date.now()
  const rand = crypto.randomBytes(6).toString('hex')
  return `${ts}-${rand}${ext}`
}

/**
 * Save a single File to the given subdirectory under /public/uploads/.
 * Returns the public URL path (e.g. /uploads/photos/1234-abc.jpg).
 */
async function saveFile(file: File, subdir: string): Promise<{ url: string; fileName: string; size: number; mimeType: string }> {
  const dir = path.join(UPLOAD_BASE, subdir)
  await mkdir(dir, { recursive: true })

  const fileName = uniqueFilename(file.name)
  const filePath = path.join(dir, fileName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return {
    url: `/uploads/${subdir}/${fileName}`,
    fileName: file.name,
    size: buffer.length,
    mimeType: file.type,
  }
}

/**
 * Save multiple files from FormData to a subdirectory.
 */
async function saveFiles(files: File[], subdir: string) {
  return Promise.all(files.map((f) => saveFile(f, subdir)))
}

/**
 * Extract File[] from FormData. The field may appear once or multiple times.
 */
function getFiles(formData: FormData, field: string): File[] {
  const entries = formData.getAll(field)
  return entries.filter((entry): entry is File => entry instanceof File && entry.size > 0)
}

// ---------------------------------------------------------------------------
// POST /api/quick-input
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const formData = await request.formData()

    const type = formData.get('type') as QuickInputType | null
    const customerId = formData.get('customerId') as string | null
    const customerName = formData.get('customerName') as string | null
    const content = formData.get('content') as string | null
    const logType = formData.get('logType') as string | null
    const incidentType = formData.get('incidentType') as string | null
    const severity = formData.get('severity') as string | null
    const incidentSource = formData.get('incidentSource') as string | null
    const files = getFiles(formData, 'files')

    if (!type) {
      return NextResponse.json({ error: 'Missing required field: type' }, { status: 400 })
    }

    // Resolve customer ID - if customerId is not provided but customerName is,
    // try to find or create a customer record.
    let resolvedCustomerId = customerId
    if (!resolvedCustomerId && customerName) {
      const existing = await prisma.customer.findFirst({
        where: { name: { contains: customerName } },
        select: { id: true },
      })
      if (existing) {
        resolvedCustomerId = existing.id
      } else {
        const newCustomer = await prisma.customer.create({
          data: {
            name: customerName,
            code: await generateSequenceNo('CUSTOMER'),
            type: 'OTHER',
          },
        })
        resolvedCustomerId = newCustomer.id
      }
    }

    // ----- Handle by type -----

    switch (type) {
      case 'visit-note': {
        if (!resolvedCustomerId) {
          return NextResponse.json({ error: 'customerId or customerName is required for visit notes' }, { status: 400 })
        }
        if (!content) {
          return NextResponse.json({ error: 'content is required for visit notes' }, { status: 400 })
        }

        // Save attached files
        const savedFiles = files.length > 0 ? await saveFiles(files, 'attachments') : []

        const followUpLog = await prisma.followUpLog.create({
          data: {
            customerId: resolvedCustomerId,
            createdById: userId,
            logDate: new Date(),
            logType: (logType as any) || 'CALL',
            content: content + (savedFiles.length > 0 ? `\n\n[附件: ${savedFiles.map(f => f.fileName).join(', ')}]` : ''),
          },
        })

        return NextResponse.json({
          success: true,
          type: 'visit-note',
          data: {
            id: followUpLog.id,
            attachments: savedFiles,
          },
        })
      }

      case 'complaint': {
        if (!resolvedCustomerId) {
          return NextResponse.json({ error: 'customerId or customerName is required for complaints' }, { status: 400 })
        }
        if (!content) {
          return NextResponse.json({ error: 'content is required for complaints' }, { status: 400 })
        }

        // Generate incident number
        const incidentNo = await generateSequenceNo('INCIDENT')

        // Save photo attachments
        const savedPhotos = files.length > 0 ? await saveFiles(files, 'photos') : []

        const incident = await prisma.careIncident.create({
          data: {
            incidentNo,
            customerId: resolvedCustomerId,
            incidentType: (incidentType as any) || 'COMPLAINT',
            incidentSource: (incidentSource as any) || 'SALES_REP',
            severity: (severity as any) || 'MEDIUM',
            incidentDate: new Date(),
            reportedById: userId,
            issueSummary: content,
            ...(savedPhotos.length > 0 && {
              attachments: {
                create: savedPhotos.map((photo) => ({
                  attachmentType: 'SITE_PHOTO' as const,
                  fileUrl: photo.url,
                  fileName: photo.fileName,
                  fileSizeBytes: photo.size,
                  mimeType: photo.mimeType,
                  uploadedById: userId,
                })),
              },
            }),
          },
          include: {
            attachments: true,
          },
        })

        return NextResponse.json({
          success: true,
          type: 'complaint',
          data: {
            id: incident.id,
            incidentNo: incident.incidentNo,
            attachments: savedPhotos,
          },
        })
      }

      case 'audio-upload': {
        const audioFiles = files.filter((f) =>
          f.type.startsWith('audio/') || f.name.endsWith('.webm') || f.name.endsWith('.m4a') || f.name.endsWith('.mp3') || f.name.endsWith('.wav')
        )

        if (audioFiles.length === 0) {
          return NextResponse.json({ error: 'No audio files provided' }, { status: 400 })
        }

        const savedAudio = await saveFiles(audioFiles, 'audio')

        // If linked to an incident (via customerId lookup of open incidents),
        // create IncidentAudioRecord entries. Otherwise return standalone URLs.
        const incidentId = formData.get('incidentId') as string | null

        if (incidentId) {
          const audioRecords = await Promise.all(
            savedAudio.map((audio) =>
              prisma.incidentAudioRecord.create({
                data: {
                  incidentId,
                  audioFileUrl: audio.url,
                  uploadedById: userId,
                },
              })
            )
          )

          return NextResponse.json({
            success: true,
            type: 'audio-upload',
            data: {
              audioRecords: audioRecords.map((r) => ({
                id: r.id,
                url: r.audioFileUrl,
              })),
            },
          })
        }

        // Standalone audio upload (not linked to an incident)
        return NextResponse.json({
          success: true,
          type: 'audio-upload',
          data: {
            files: savedAudio,
          },
        })
      }

      case 'photo-upload': {
        if (files.length === 0) {
          return NextResponse.json({ error: 'No files provided' }, { status: 400 })
        }

        const savedPhotos = await saveFiles(files, 'photos')

        return NextResponse.json({
          success: true,
          type: 'photo-upload',
          data: {
            files: savedPhotos,
          },
        })
      }

      default:
        return NextResponse.json(
          { error: `Invalid type: ${type}. Must be one of: visit-note, complaint, audio-upload, photo-upload` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[quick-input] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
