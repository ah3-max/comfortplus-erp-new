import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// All sidebar module codes
const ALL_MODULES = [
  'dashboard', 'dailyReport', 'crm', 'calendar',
  'customers', 'quotations', 'orders', 'kpi', 'pipeline', 'tasks',
  'products', 'inventory', 'warehouses',
  'shipments', 'pickup', 'logistics',
  'purchases', 'suppliers', 'production', 'qc', 'packaging', 'seaFreight',
  'channels', 'payments',
  'care',
  'reports', 'users', 'settings',
]

const ALL_ROLES = [
  'SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES', 'CARE_SUPERVISOR',
  'ECOMMERCE', 'CS', 'WAREHOUSE_MANAGER', 'WAREHOUSE', 'PROCUREMENT', 'FINANCE',
]

// Default: which modules each role can see by default
const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_MODULES,
  GM: ALL_MODULES,
  SALES_MANAGER: [
    'dashboard', 'dailyReport', 'crm', 'calendar',
    'customers', 'quotations', 'orders', 'kpi', 'pipeline', 'tasks',
    'products', 'inventory',
    'shipments', 'pickup',
    'channels', 'payments',
    'care', 'reports',
  ],
  SALES: [
    'dashboard', 'dailyReport', 'crm', 'calendar',
    'customers', 'quotations', 'orders', 'kpi', 'pipeline', 'tasks',
    'products',
    'shipments', 'pickup',
    'care',
  ],
  CARE_SUPERVISOR: [
    'dashboard', 'calendar', 'customers', 'care', 'tasks', 'crm',
  ],
  ECOMMERCE: [
    'dashboard', 'products', 'orders', 'channels', 'inventory', 'shipments', 'payments', 'reports',
  ],
  CS: [
    'dashboard', 'customers', 'orders', 'shipments', 'care',
  ],
  WAREHOUSE_MANAGER: [
    'dashboard', 'products', 'inventory', 'warehouses', 'shipments', 'logistics',
    'purchases', 'qc', 'packaging', 'seaFreight', 'reports',
  ],
  WAREHOUSE: [
    'dashboard', 'inventory', 'warehouses', 'shipments', 'pickup', 'logistics', 'packaging',
  ],
  PROCUREMENT: [
    'dashboard', 'products', 'inventory', 'purchases', 'suppliers',
    'production', 'qc', 'packaging', 'seaFreight', 'payments', 'reports',
  ],
  FINANCE: [
    'dashboard', 'orders', 'payments', 'reports',
    'purchases', 'inventory', 'channels',
  ],
}

// GET /api/role-permissions — returns full matrix { [role]: { [module]: boolean } }
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.rolePermission.findMany({
    select: { roleName: true, module: true, canView: true },
  })

  // Build matrix: if no record exists for a role+module, use default
  const matrix: Record<string, Record<string, boolean>> = {}
  for (const role of ALL_ROLES) {
    matrix[role] = {}
    const defaults = ROLE_DEFAULTS[role] ?? []
    for (const mod of ALL_MODULES) {
      const record = existing.find(r => r.roleName === role && r.module === mod)
      matrix[role][mod] = record ? record.canView : defaults.includes(mod)
    }
  }

  return NextResponse.json({ matrix, roles: ALL_ROLES, modules: ALL_MODULES })
}

// PUT /api/role-permissions — bulk upsert { [role]: { [module]: boolean } }
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check admin
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'GM') {
    return NextResponse.json({ error: '僅管理員可修改權限' }, { status: 403 })
  }

  const { matrix } = await req.json() as { matrix: Record<string, Record<string, boolean>> }

  // Upsert all entries
  const ops = []
  for (const [role, modules] of Object.entries(matrix)) {
    for (const [mod, canView] of Object.entries(modules)) {
      ops.push(
        prisma.rolePermission.upsert({
          where: { roleName_module: { roleName: role, module: mod } },
          create: { roleName: role, module: mod, canView },
          update: { canView },
        })
      )
    }
  }

  await prisma.$transaction(ops)

  return NextResponse.json({ ok: true })
}
