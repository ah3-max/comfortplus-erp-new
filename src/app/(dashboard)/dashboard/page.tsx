'use client'

import { useSession } from 'next-auth/react'
import { DashboardLoading } from '@/components/dashboard/shared'
import {
  GmDashboard,
  SalesDashboard,
  SalesManagerDashboard,
  WarehouseDashboard,
  FinanceDashboard,
  ProcurementDashboard,
} from '@/components/dashboard'

// ── Role → Dashboard mapping ─────────────────────────────────────────────────

const ROLE_DASHBOARD: Record<string, React.ComponentType> = {
  SUPER_ADMIN:       GmDashboard,
  GM:                GmDashboard,
  SALES_MANAGER:     SalesManagerDashboard,
  SALES:             SalesDashboard,
  CARE_SUPERVISOR:   SalesDashboard,       // 照顧督導用類似業務的個人台
  ECOMMERCE:         GmDashboard,          // Phase 2 再獨立，先用 GM 視角
  CS:                SalesDashboard,        // 客服用類似業務的個人台
  WAREHOUSE_MANAGER: WarehouseDashboard,
  WAREHOUSE:         WarehouseDashboard,
  PROCUREMENT:       ProcurementDashboard,
  FINANCE:           FinanceDashboard,
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') return <DashboardLoading />

  const role = (session?.user?.role as string) ?? 'SALES'
  const Dashboard = ROLE_DASHBOARD[role] ?? GmDashboard

  return <Dashboard />
}
