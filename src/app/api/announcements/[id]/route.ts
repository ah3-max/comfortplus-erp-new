import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.announcement.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.action === 'PUBLISH') {
      const announcement = await prisma.announcement.update({
        where: { id },
        data: { isPublished: true, publishedAt: new Date() },
      })
      return NextResponse.json(announcement)
    }

    if (body.action === 'UNPUBLISH') {
      const announcement = await prisma.announcement.update({
        where: { id },
        data: { isPublished: false },
      })
      return NextResponse.json(announcement)
    }

    const { title, content, category, priority, isPinned, isPublished, targetRoles, expiresAt } = body
    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title
    if (content !== undefined) data.content = content
    if (category !== undefined) data.category = category
    if (priority !== undefined) data.priority = priority
    if (isPinned !== undefined) data.isPinned = isPinned
    if (isPublished !== undefined) {
      data.isPublished = isPublished
      if (isPublished && !existing.publishedAt) data.publishedAt = new Date()
    }
    if (targetRoles !== undefined) data.targetRoles = targetRoles
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null

    const announcement = await prisma.announcement.update({ where: { id }, data })
    return NextResponse.json(announcement)
  } catch (error) {
    return handleApiError(error, 'announcements.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM'].includes(role)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  try {
    const { id } = await params
    await prisma.announcement.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'announcements.DELETE')
  }
}
