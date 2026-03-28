import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// Default modules per role (keep in sync with /api/role-permissions/route.ts)
const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  GM: ['*'],
  SALES_MANAGER: [
    'dashboard', 'dailyReport', 'quickInput', 'crm', 'alerts', 'calendar', 'businessCalendar',
    'customers', 'keyAccounts', 'incidents', 'quotations', 'orders', 'salesInvoices', 'eInvoices',
    'marginCalc', 'kpi', 'pipeline', 'opportunities', 'tasks',
    'products', 'inventory', 'shipments', 'pickup',
    'channels', 'payments', 'arAging', 'budget', 'expenses', 'contracts',
    'afterSales', 'care', 'knowledge',
    'approvals', 'reports', 'documents', 'announcements',
  ],
  SALES: [
    'dashboard', 'dailyReport', 'quickInput', 'crm', 'calendar',
    'customers', 'keyAccounts', 'quotations', 'orders', 'salesInvoices',
    'kpi', 'pipeline', 'opportunities', 'tasks',
    'products', 'shipments', 'pickup',
    'afterSales', 'care', 'knowledge',
    'approvals', 'announcements',
  ],
  CARE_SUPERVISOR: [
    'dashboard', 'calendar', 'businessCalendar', 'crm', 'alerts',
    'customers', 'keyAccounts', 'incidents', 'tasks',
    'afterSales', 'care', 'knowledge',
    'approvals', 'announcements',
  ],
  ECOMMERCE: [
    'dashboard', 'dailyReport',
    'orders', 'salesInvoices', 'eInvoices', 'kpi',
    'products', 'inventory',
    'shipments',
    'channels', 'retail', 'payments', 'arAging',
    'afterSales',
    'reports', 'announcements',
  ],
  CS: [
    'dashboard', 'crm', 'calendar',
    'customers', 'orders', 'tasks',
    'afterSales', 'care', 'knowledge',
    'approvals', 'announcements',
  ],
  WAREHOUSE_MANAGER: [
    'dashboard', 'quickInput', 'alerts',
    'orders', 'salesInvoices',
    'products', 'inventory', 'warehouses', 'stockCounts', 'internalUse', 'traceability', 'wms',
    'shipments', 'picking', 'dispatch', 'pickup', 'logistics',
    'purchases', 'purchaseRequests', 'suppliers', 'qc', 'packaging', 'seaFreight',
    'importProjects', 'purchasePlans',
    'reports', 'documents', 'announcements',
  ],
  WAREHOUSE: [
    'dashboard', 'quickInput',
    'inventory', 'warehouses', 'stockCounts', 'wms',
    'shipments', 'picking', 'dispatch', 'pickup', 'logistics', 'packaging',
    'announcements',
  ],
  PROCUREMENT: [
    'dashboard', 'alerts',
    'products', 'inventory', 'warehouses',
    'purchases', 'purchaseRequests', 'rfq', 'suppliers', 'production',
    'materialRequisitions', 'productionReceipts', 'qc', 'packaging',
    'seaFreight', 'importProjects', 'purchasePlans',
    'payments', 'apAging', 'budget',
    'reports', 'documents', 'announcements',
  ],
  FINANCE: [
    'dashboard',
    'orders', 'salesInvoices', 'eInvoices',
    'products',
    'contracts', 'fixedAssets', 'budget', 'expenses', 'finance',
    'channels', 'retail', 'payments', 'arAging', 'apAging', 'priceTiers', 'discountRules',
    'approvals', 'reports', 'documents', 'auditLog', 'announcements',
  ],
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
