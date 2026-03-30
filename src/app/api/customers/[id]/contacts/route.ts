import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// POST /api/customers/[id]/contacts — create contact
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: customerId } = await params
    const body = await req.json()

    // If this contact is primary, unset all others
    if (body.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId }, data: { isPrimary: false },
      })
    }

    const contact = await prisma.customerContact.create({
      data: {
        customerId,
        name:                body.name,
        role:                body.role                || null,
        title:               body.title               || null,
        department:          body.department          || null,
        mobile:              body.mobile              || null,
        phone:               body.phone               || null,
        phoneExt:            body.phoneExt            || null,
        email:               body.email               || null,
        lineId:              body.lineId              || null,
        isPrimary:           body.isPrimary           ?? false,
        preferredContactTime: body.preferredContactTime || null,
        notes:               body.notes               || null,
        gender:              body.gender              || null,
        birthday:            body.birthday            ? new Date(body.birthday) : null,
        birthdayNote:        body.birthdayNote        || null,
        hasChildren:         body.hasChildren != null && body.hasChildren !== '' ? body.hasChildren === 'true' || body.hasChildren === true : null,
        childrenInfo:        body.childrenInfo        || null,
        preferences:         body.preferences         || null,
        taboos:              body.taboos              || null,
        favoriteThings:      body.favoriteThings      || null,
        personalNotes:       body.personalNotes       || null,
        lifeEvents:          body.lifeEvents          || null,
      },
    })
    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'customers.contacts.create')
  }
}

// PUT /api/customers/[id]/contacts?contactId=xxx — update contact
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: customerId } = await params
    const { searchParams } = new URL(req.url)
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

    const body = await req.json()

    if (body.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId, id: { not: contactId } }, data: { isPrimary: false },
      })
    }

    const contact = await prisma.customerContact.update({
      where: { id: contactId },
      data: {
        name:                body.name,
        role:                body.role                || null,
        title:               body.title               || null,
        department:          body.department          || null,
        mobile:              body.mobile              || null,
        phone:               body.phone               || null,
        phoneExt:            body.phoneExt            || null,
        email:               body.email               || null,
        lineId:              body.lineId              || null,
        isPrimary:           body.isPrimary           ?? false,
        preferredContactTime: body.preferredContactTime || null,
        notes:               body.notes               || null,
        // personal care fields
        gender:              body.gender              || null,
        birthday:            body.birthday            ? new Date(body.birthday) : null,
        birthdayNote:        body.birthdayNote        || null,
        hasChildren:         body.hasChildren != null && body.hasChildren !== '' ? body.hasChildren === 'true' || body.hasChildren === true : null,
        childrenInfo:        body.childrenInfo        || null,
        preferences:         body.preferences         || null,
        taboos:              body.taboos              || null,
        favoriteThings:      body.favoriteThings      || null,
        personalNotes:       body.personalNotes       || null,
        lifeEvents:          body.lifeEvents          || null,
      },
    })
    return NextResponse.json(contact)
  } catch (error) {
    return handleApiError(error, 'customers.contacts.update')
  }
}

// DELETE /api/customers/[id]/contacts?contactId=xxx — delete contact
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(_req.url)
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

    await prisma.customerContact.delete({ where: { id: contactId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'customers.contacts.delete')
  }
}
