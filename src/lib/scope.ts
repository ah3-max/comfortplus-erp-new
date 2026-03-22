/**
 * Data scope filtering utility.
 *
 * Generates Prisma `where` clauses based on the current user's role
 * so that each role only sees data within their responsibility.
 *
 * Scope rules:
 *   SUPER_ADMIN / GM         → ALL data (no filter)
 *   SALES_MANAGER            → ALL sales data (team-wide)
 *   SALES / CS               → Only OWN data (createdById / salesRepId)
 *   CARE_SUPERVISOR           → Only own-assigned data
 *   WAREHOUSE_MANAGER         → ALL warehouse-related data
 *   WAREHOUSE                 → ALL warehouse-related data
 *   PROCUREMENT               → ALL procurement data
 *   FINANCE                   → ALL data (finance needs full visibility)
 *   ECOMMERCE                 → ALL e-commerce + orders data
 */

// Roles that can see ALL data without filtering
const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

// Roles that can see all SALES-related data (team-wide)
const SALES_TEAM_ACCESS_ROLES = ['SALES_MANAGER']

// Roles restricted to their own data only
const OWN_DATA_ROLES = ['SALES', 'CS', 'CARE_SUPERVISOR']

interface ScopeContext {
  userId: string
  role: string
}

/**
 * Returns a Prisma `where` clause for SalesOrder queries.
 * - SALES/CS/CARE_SUPERVISOR: only orders they created
 * - Others: no filter
 */
export function orderScope(ctx: ScopeContext): Record<string, unknown> {
  if (OWN_DATA_ROLES.includes(ctx.role)) {
    return { createdById: ctx.userId }
  }
  return {}
}

/**
 * Returns a Prisma `where` clause for Customer queries.
 * - SALES/CS/CARE_SUPERVISOR: only customers assigned to them (salesRepId)
 * - Others: no filter
 */
export function customerScope(ctx: ScopeContext): Record<string, unknown> {
  if (OWN_DATA_ROLES.includes(ctx.role)) {
    return { salesRepId: ctx.userId }
  }
  return {}
}

/**
 * Returns a Prisma `where` clause for Quotation queries.
 * - SALES/CS/CARE_SUPERVISOR: only quotations they created
 * - Others: no filter
 */
export function quotationScope(ctx: ScopeContext): Record<string, unknown> {
  if (OWN_DATA_ROLES.includes(ctx.role)) {
    return { createdById: ctx.userId }
  }
  return {}
}

/**
 * Returns a Prisma `where` clause for Shipment queries.
 * - SALES/CS/CARE_SUPERVISOR: only shipments for their orders
 * - Others: no filter
 */
export function shipmentScope(ctx: ScopeContext): Record<string, unknown> {
  if (OWN_DATA_ROLES.includes(ctx.role)) {
    return { order: { createdById: ctx.userId } }
  }
  return {}
}

/**
 * Check if user has full (unfiltered) data access.
 */
export function hasFullAccess(role: string): boolean {
  return FULL_ACCESS_ROLES.includes(role) || SALES_TEAM_ACCESS_ROLES.includes(role)
}

/**
 * Check if this role should only see own data.
 */
export function isOwnDataOnly(role: string): boolean {
  return OWN_DATA_ROLES.includes(role)
}

/**
 * Build scope context from session.
 */
export function buildScopeContext(session: { user: { id: string; role: string } }): ScopeContext {
  return {
    userId: session.user.id,
    role: session.user.role,
  }
}

/**
 * Check if user can access a specific order.
 * Returns true if allowed, false if denied.
 */
export function canAccessOrder(ctx: ScopeContext, order: { createdById: string }): boolean {
  if (!OWN_DATA_ROLES.includes(ctx.role)) return true
  return order.createdById === ctx.userId
}

/**
 * Check if user can access a specific customer.
 */
export function canAccessCustomer(ctx: ScopeContext, customer: { salesRepId: string | null }): boolean {
  if (!OWN_DATA_ROLES.includes(ctx.role)) return true
  return customer.salesRepId === ctx.userId
}

/**
 * Check if user can access a specific quotation.
 */
export function canAccessQuotation(ctx: ScopeContext, quotation: { createdById: string }): boolean {
  if (!OWN_DATA_ROLES.includes(ctx.role)) return true
  return quotation.createdById === ctx.userId
}
