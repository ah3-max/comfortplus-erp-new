import { NextRequest } from 'next/server'
import { GET as statementsGET, POST as statementsPOST } from '@/app/api/statements/route'

// Deprecated: use /api/statements instead. These re-exports preserve backwards compatibility.
export const GET = (req: NextRequest) => statementsGET(req)
export const POST = (req: NextRequest) => statementsPOST(req)
