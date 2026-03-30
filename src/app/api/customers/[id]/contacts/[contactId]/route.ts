import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// PUT /api/customers/[id]/contacts/[contactId] — update contact (including personal care fields)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: customerId, contactId } = await params
    const body = await req.json()

    if (body.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId, id: { not: contactId } },
        data: { isPrimary: false },
      })
    }

    const contact = await prisma.customerContact.update({
      where: { id: contactId },
      data: {
        name:                 body.name                 ?? undefined,
        role:                 body.role                 || null,
        title:                body.title                || null,
        department:           body.department           || null,
        mobile:               body.mobile               || null,
        phone:                body.phone                || null,
        phoneExt:             body.phoneExt             || null,
        email:                body.email                || null,
        lineId:               body.lineId               || null,
        isPrimary:            body.isPrimary            ?? undefined,
        preferredContactTime: body.preferredContactTime || null,
        notes:                body.notes                || null,
        // personal care fields
        gender:               body.gender               || null,
        birthday:             body.birthday             ? new Date(body.birthday) : null,
        birthdayNote:         body.birthdayNote         || null,
        hasChildren:          body.hasChildren != null && body.hasChildren !== '' ? body.hasChildren === 'true' || body.hasChildren === true : null,
        childrenInfo:         body.childrenInfo         || null,
        preferences:          body.preferences          || null,
        taboos:               body.taboos               || null,
        favoriteThings:       body.favoriteThings       || null,
        personalNotes:        body.personalNotes        || null,
        lifeEvents:           body.lifeEvents           || null,
      },
    })
    return NextResponse.json(contact)
  } catch (error) {
    return handleApiError(error, 'customers.contacts.update')
  }
}
