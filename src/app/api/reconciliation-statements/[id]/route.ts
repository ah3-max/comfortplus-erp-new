import { NextRequest } from 'next/server'
import { GET as stmtGET, PUT as stmtPUT, DELETE as stmtDELETE } from '@/app/api/statements/[id]/route'

type Ctx = { params: Promise<{ id: string }> }

// Deprecated: use /api/statements/[id] instead.
export const GET = (req: NextRequest, ctx: Ctx) => stmtGET(req, ctx)
export const PUT = (req: NextRequest, ctx: Ctx) => stmtPUT(req, ctx)
export const DELETE = (req: NextRequest, ctx: Ctx) => stmtDELETE(req, ctx)
