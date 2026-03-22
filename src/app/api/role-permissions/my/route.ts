import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// Default modules per role (same as main route — keep in sync)
const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  GM: ['*'],
  SALES_MANAGER: [
    'dashboard', 'dailyReport', 'crm', 'calendar',
    'customers', 'quotations', 'orders', 'pipeline', 'tasks',
    'products', 'inventory', 'shipments', 'channels', 'payments', 'care', 'reports',
  ],
  SALES: [
    'dashboard', 'dailyReport', 'crm', 'calendar',
    'customers', 'quotations', 'orders', 'pipeline', 'tasks', 'products', 'shipments', 'care',
  ],
  CARE_SUPERVISOR: ['dashboard', 'calendar', 'customers', 'care', 'tasks', 'crm'],
  ECOMMERCE: ['dashboard', 'products', 'orders', 'channels', 'inventory', 'shipments', 'payments', 'reports'],
  CS: ['dashboard', 'customers', 'orders', 'shipments', 'care'],
  WAREHOUSE_MANAGER: [
    'dashboard', 'products', 'inventory', 'warehouses', 'shipments', 'logistics',
    'purchases', 'qc', 'packaging', 'seaFreight', 'reports',
  ],
  WAREHOUSE: ['dashboard', 'inventory', 'warehouses', 'shipments', 'logistics', 'packaging'],
  PROCUREMENT: [
    'dashboard', 'products', 'inventory', 'purchases', 'suppliers',
    'production', 'qc', 'packaging', 'seaFreight', 'payments', 'reports',
  ],
  FINANCE: ['dashboard', 'orders', 'payments', 'reports', 'purchases', 'inventory', 'channels'],
}

// GET /api/role-permissions/my — returns current user's allowed module list
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const role = user.role

  // Check if there are explicit permissions in the database
  const dbPerms = await prisma.rolePermission.findMany({
    where: { roleName: role, canView: true },
    select: { module: true },
  })

  let allowedModules: string[]

  if (dbPerms.length > 0) {
    // Use database permissions
    allowedModules = dbPerms.map(p => p.module)
  } else {
    // Use defaults
    const defaults = ROLE_DEFAULTS[role] ?? []
    if (defaults.includes('*')) {
      // All access
      allowedModules = ['*']
    } else {
      allowedModules = defaults
    }
  }

  return NextResponse.json({ role, allowedModules })
}
