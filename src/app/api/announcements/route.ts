import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const published = searchParams.get('published')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))

    const where: Record<string, unknown> = {}

    if (published === 'true') {
      where.isPublished = true
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ]
    } else if (published === 'false') {
      where.isPublished = false
    }

    const [data, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.announcement.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'announcements.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM'].includes(role)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { title, content, category, priority, isPinned, isPublished, targetRoles, expiresAt } = body

    if (!title || !content) {
      return NextResponse.json({ error: '標題與內容為必填' }, { status: 400 })
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        category: category ?? 'GENERAL',
        priority: priority ?? 'NORMAL',
        isPinned: isPinned ?? false,
        isPublished: isPublished ?? false,
        publishedAt: isPublished ? new Date() : null,
        targetRoles: targetRoles ?? [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(announcement, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'announcements.POST')
  }
}
