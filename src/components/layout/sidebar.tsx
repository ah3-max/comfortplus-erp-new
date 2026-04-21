'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText, Truck,
  BarChart3, Settings, ChevronLeft, ChevronRight, ChevronDown, LogOut,
  PieChart, UserCog, ShoppingBag, Building2, Warehouse, Navigation,
  ListTodo, HeartHandshake, CalendarDays, Factory, Ship, Store,
  CreditCard, Target, ClipboardCheck, Layers, Crosshair, AlertOctagon,
  Shield, ShieldAlert, SearchCode, BadgeAlert, Calculator, Receipt,
  BookOpen, FileArchive, Landmark, Briefcase, Star, Zap, PackageCheck,
  PackageX, GitPullRequestArrow, ShipIcon, UserSquare2, ClipboardList,
  MapPinned, ReceiptText, BriefcaseBusiness, HandCoins, Megaphone,
  Network, Wallet, Scale, RotateCcw, CalendarCheck2, TrendingUp,
  Clock, DollarSign, CheckCircle2, Tag, Send, BellRing, Hash, DatabaseZap,
  Printer, AlertTriangle, BadgeDollarSign, FileCheck, Search,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'

/* ── Types ── */
export type NavItem = { href: string; key: string; icon: LucideIcon }
export type NavSubGroup = { subLabelKey: string; items: NavItem[] }
export type NavGroupEntry = NavItem | NavSubGroup
export type NavGroup = { labelKey: string; items: NavGroupEntry[] }

export function isSubGroup(entry: NavGroupEntry): entry is NavSubGroup {
  return 'subLabelKey' in entry
}

/* ── Nav Structure ── */
export const navGroups: NavGroup[] = [
  /* ─── 日常作業 ─── */
  {
    labelKey: 'groupDaily',
    items: [
      { href: '/dashboard',          key: 'dashboard',        icon: LayoutDashboard },
      { href: '/daily-reminder',     key: 'dailyReminder',    icon: BellRing },
      { href: '/crm',                key: 'crm',              icon: Crosshair },
      { href: '/institution-tours',  key: 'institutionTours', icon: MapPinned },
      { href: '/calendar',           key: 'calendar',         icon: CalendarDays },
    ],
  },

  /* ─── 銷售業務 ─── */
  {
    labelKey: 'groupSales',
    items: [
      {
        subLabelKey: 'subCustomers',
        items: [
          { href: '/customers',        key: 'customers',        icon: Users },
          { href: '/key-accounts',     key: 'keyAccounts',      icon: Star },
          { href: '/incidents',        key: 'incidents',        icon: AlertOctagon },
        ],
      },
      {
        subLabelKey: 'subOpportunity',
        items: [
          { href: '/pipeline',            key: 'pipeline',       icon: Target },
          { href: '/kpi',                 key: 'kpi',            icon: Zap },
          { href: '/tasks',               key: 'tasks',          icon: ListTodo },
          { href: '/sales-daily-report',  key: 'salesDailyReport', icon: Send },
          { href: '/meeting-records',     key: 'meetingRecords', icon: CalendarDays },
        ],
      },
      {
        subLabelKey: 'subTransaction',
        items: [
          { href: '/quotations',     key: 'quotations',    icon: FileText },
          { href: '/orders',         key: 'orders',        icon: ShoppingCart },
          { href: '/sales-invoices', key: 'salesInvoices', icon: Receipt },
          { href: '/e-invoices',     key: 'eInvoices',     icon: FileText },
          { href: '/sales-returns',  key: 'salesReturns',  icon: RotateCcw },
          { href: '/channel-orders', key: 'channelOrders', icon: ShoppingBag },
        ],
      },
    ],
  },

  /* ─── 商品庫存 ─── */
  {
    labelKey: 'groupInventory',
    items: [
      { href: '/products',              key: 'products',        icon: Package },
      { href: '/inventory',             key: 'inventory',       icon: BarChart3 },
      { href: '/inventory-safety',      key: 'inventorySafety', icon: AlertTriangle },
      { href: '/wms',                   key: 'wms',             icon: Warehouse },
      { href: '/inventory?tab=count',   key: 'stockCounts',     icon: ClipboardCheck },
      { href: '/internal-use',          key: 'internalUse',     icon: PackageX },
      { href: '/inbound',               key: 'inbound',         icon: PackageCheck },
    ],
  },

  /* ─── 出貨物流 ─── */
  {
    labelKey: 'groupLogistics',
    items: [
      { href: '/shipping-center', key: 'shippingCenter', icon: Package },
      { href: '/shipments',       key: 'shipments',      icon: Truck },
      { href: '/picking',         key: 'picking',        icon: ClipboardCheck },
      { href: '/dispatch',        key: 'dispatch',       icon: Truck },
      { href: '/logistics',       key: 'logistics',      icon: Navigation },
    ],
  },

  /* ─── 採購生產 ─── */
  {
    labelKey: 'groupProduction',
    items: [
      {
        subLabelKey: 'subPurchasing',
        items: [
          { href: '/purchases',         key: 'purchases',        icon: ShoppingBag },
          { href: '/purchase-requests', key: 'purchaseRequests', icon: FileText },
          { href: '/suppliers',         key: 'suppliers',        icon: Building2 },
          { href: '/purchase-returns',  key: 'purchaseReturns',  icon: RotateCcw },
          { href: '/sea-freight',       key: 'seaFreight',       icon: Ship },
        ],
      },
      {
        subLabelKey: 'subManufacturing',
        items: [
          { href: '/production',            key: 'production',           icon: Factory },
          { href: '/material-requisitions', key: 'materialRequisitions', icon: Layers },
          { href: '/production-receipts',   key: 'productionReceipts',   icon: PackageCheck },
          { href: '/qc',                    key: 'qc',                   icon: ClipboardCheck },
        ],
      },
    ],
  },

  /* ─── 財務會計 ─── */
  {
    labelKey: 'groupFinance',
    items: [
      {
        subLabelKey: 'subFinCore',
        items: [
          { href: '/finance',           key: 'finance',          icon: BarChart3 },
          { href: '/payments',          key: 'payments',         icon: CreditCard },
          { href: '/receipts',          key: 'receipts',         icon: CheckCircle2 },
          { href: '/expenses',          key: 'expenses',         icon: ReceiptText },
          { href: '/petty-cash',        key: 'pettyCash',        icon: Wallet },
        ],
      },
      {
        subLabelKey: 'subArAp',
        items: [
          { href: '/ar-aging',          key: 'arAging',          icon: Receipt },
          { href: '/ap-aging',          key: 'apAging',          icon: Receipt },
          { href: '/disbursements',     key: 'disbursements',    icon: CreditCard },
          { href: '/credit-management', key: 'creditManagement', icon: BadgeAlert },
          { href: '/finance/settlement', key: 'settlement',      icon: FileCheck },
        ],
      },
      {
        subLabelKey: 'subLedgers',
        items: [
          { href: '/finance/general-ledger', key: 'generalLedger', icon: BookOpen },
          { href: '/finance/account-detail', key: 'accountDetail', icon: BookOpen },
          { href: '/finance/cash-book',      key: 'cashBook',      icon: CreditCard },
          { href: '/finance/vat-ledger',     key: 'vatLedger',     icon: Receipt },
          { href: '/finance/input-tax',      key: 'inputTax',      icon: ReceiptText },
        ],
      },
      {
        subLabelKey: 'subOperations',
        items: [
          { href: '/finance/monthly-pl',              key: 'monthlyPL',             icon: BarChart3 },
          { href: '/finance/cash-flow-statement',     key: 'cashFlowStatement',     icon: BarChart3 },
          { href: '/finance/payment-summary',         key: 'paymentSummary',        icon: CreditCard },
          { href: '/finance/receipt-summary',         key: 'receiptSummary',        icon: Receipt },
          { href: '/finance/advance-payment-summary', key: 'advancePaymentSummary', icon: HandCoins },
          { href: '/finance/management-summary',      key: 'managementSummary',     icon: PieChart },
        ],
      },
      {
        subLabelKey: 'subFinSettings',
        items: [
          { href: '/bank-accounts',          key: 'bankAccounts',   icon: Landmark },
          { href: '/finance/bank/reconcile', key: 'bankReconcile',  icon: Scale },
          { href: '/cheques',                key: 'cheques',        icon: FileText },
          { href: '/vat-filings',            key: 'vatFilings',     icon: Receipt },
          { href: '/finance/vat',            key: 'vatSummary',     icon: Calculator },
          { href: '/period-close',           key: 'periodClose',    icon: CalendarCheck2 },
          { href: '/auto-journal',           key: 'autoJournal',    icon: Zap },
        ],
      },
    ],
  },

  /* ─── 通路 ─── */
  {
    labelKey: 'groupChannels',
    items: [
      { href: '/channels',          key: 'channels',        icon: Store },
      { href: '/price-tiers',       key: 'priceTiers',      icon: Layers },
      { href: '/discount-rules',    key: 'discountRules',   icon: HandCoins },
      { href: '/customer-pricing',  key: 'customerPricing', icon: BadgeDollarSign },
    ],
  },

  /* ─── 分析報表 ─── */
  {
    labelKey: 'groupAnalysis',
    items: [
      {
        subLabelKey: 'subSalesReports',
        items: [
          { href: '/reports',                 key: 'reports',                icon: PieChart },
          { href: '/sales-analysis',          key: 'salesAnalysis',          icon: TrendingUp },
          { href: '/gross-margin',            key: 'grossMargin',            icon: DollarSign },
          { href: '/salesperson-performance', key: 'salespersonPerformance', icon: Users },
          { href: '/competitor-prices',       key: 'competitorPrices',       icon: TrendingUp },
        ],
      },
      {
        subLabelKey: 'subOpsReports',
        items: [
          { href: '/purchase-analysis',    key: 'purchaseAnalysis',   icon: BarChart3 },
          { href: '/supplier-performance', key: 'supplierPerformance', icon: Star },
          { href: '/delivery-performance', key: 'deliveryPerformance', icon: BarChart3 },
          { href: '/inventory-movement',   key: 'inventoryMovement',  icon: BarChart3 },
          { href: '/dead-stock',           key: 'deadStock',          icon: PackageX },
        ],
      },
    ],
  },

  /* ─── 服務 ─── */
  {
    labelKey: 'groupService',
    items: [
      { href: '/after-sales', key: 'afterSales', icon: HeartHandshake },
      { href: '/care',        key: 'care',       icon: HeartHandshake },
      { href: '/knowledge',   key: 'knowledge',  icon: BookOpen },
    ],
  },

  /* ─── 組織行政 ─── */
  {
    labelKey: 'groupOrg',
    items: [
      { href: '/hr',             key: 'hr',            icon: UserSquare2 },
      { href: '/org-chart',      key: 'orgChart',      icon: Network },
      { href: '/announcements',  key: 'announcements', icon: Megaphone },
      { href: '/asset-loans',    key: 'assetLoans',    icon: BriefcaseBusiness },
      { href: '/region-mapping', key: 'regionMapping', icon: MapPinned },
    ],
  },

  /* ─── 系統 ─── */
  {
    labelKey: 'groupSystem',
    items: [
      { href: '/approvals',  key: 'approvals',  icon: GitPullRequestArrow },
      { href: '/documents',  key: 'documents',  icon: FileArchive },
      { href: '/warehouses', key: 'warehouses', icon: Warehouse },
      { href: '/audit-log',  key: 'auditLog',   icon: Shield },
      { href: '/users',      key: 'users',      icon: UserCog },
      { href: '/settings',   key: 'settings',   icon: Settings },
      { href: '/settings/expense-categories', key: 'expenseCategories', icon: BookOpen },
      { href: '/migration',  key: 'migration',  icon: DatabaseZap },
    ],
  },
]

/* ── Finance Role Nav (workflow-ordered) ── */
export const financeNavGroups: NavGroup[] = [
  /* 1. 今日工作台 */
  {
    labelKey: 'groupFinDaily',
    items: [
      { href: '/dashboard',   key: 'dashboard',     icon: LayoutDashboard },
      { href: '/finance',     key: 'finance',        icon: BarChart3 },
      { href: '/approvals',   key: 'approvals',      icon: GitPullRequestArrow },
      { href: '/announcements', key: 'announcements', icon: Megaphone },
    ],
  },

  /* 2. 應收管理 */
  {
    labelKey: 'groupFinAR',
    items: [
      {
        subLabelKey: 'subIncome',
        items: [
          { href: '/orders',         key: 'orders',         icon: ShoppingCart },
          { href: '/sales-invoices', key: 'salesInvoices',  icon: Receipt },
          { href: '/sales-returns',  key: 'salesReturns',   icon: RotateCcw },
          { href: '/e-invoices',     key: 'eInvoices',      icon: FileText },
        ],
      },
      {
        subLabelKey: 'subCollections',
        items: [
          { href: '/receipts',           key: 'receipts',          icon: CheckCircle2 },
          { href: '/ar-aging',           key: 'arAging',           icon: Receipt },
          { href: '/finance/settlement', key: 'settlement',        icon: FileCheck },
          { href: '/credit-management',  key: 'creditManagement',  icon: BadgeAlert },
        ],
      },
    ],
  },

  /* 3. 應付管理 */
  {
    labelKey: 'groupFinAP',
    items: [
      {
        subLabelKey: 'subDisbursements',
        items: [
          { href: '/payments',      key: 'payments',      icon: CreditCard },
          { href: '/ap-aging',      key: 'apAging',       icon: Receipt },
          { href: '/disbursements', key: 'disbursements', icon: HandCoins },
        ],
      },
      {
        subLabelKey: 'subExpense',
        items: [
          { href: '/expenses',    key: 'expenses',   icon: ReceiptText },
          { href: '/petty-cash',  key: 'pettyCash',  icon: Wallet },
        ],
      },
    ],
  },

  /* 4. 銀行與現金 */
  {
    labelKey: 'groupFinBank',
    items: [
      { href: '/bank-accounts',          key: 'bankAccounts',  icon: Landmark },
      { href: '/finance/bank/reconcile', key: 'bankReconcile', icon: Scale },
      { href: '/cheques',                key: 'cheques',       icon: FileText },
      { href: '/finance/cash-book',      key: 'cashBook',      icon: CreditCard },
    ],
  },

  /* 5. 總帳 */
  {
    labelKey: 'groupFinLedger',
    items: [
      {
        subLabelKey: 'subLedger',
        items: [
          { href: '/finance/general-ledger', key: 'generalLedger', icon: BookOpen },
          { href: '/finance/account-detail', key: 'accountDetail', icon: BookOpen },
          { href: '/finance/vat-ledger',     key: 'vatLedger',     icon: Receipt },
        ],
      },
      {
        subLabelKey: 'subTax',
        items: [
          { href: '/finance/input-tax', key: 'inputTax',   icon: ReceiptText },
          { href: '/finance/vat',       key: 'vatSummary', icon: Calculator },
          { href: '/vat-filings',       key: 'vatFilings', icon: Receipt },
        ],
      },
    ],
  },

  /* 6. 財務報表 */
  {
    labelKey: 'groupFinReports',
    items: [
      { href: '/finance/monthly-pl',              key: 'monthlyPL',             icon: BarChart3 },
      { href: '/finance/cash-flow-statement',     key: 'cashFlowStatement',     icon: BarChart3 },
      { href: '/finance/payment-summary',         key: 'paymentSummary',        icon: CreditCard },
      { href: '/finance/receipt-summary',         key: 'receiptSummary',        icon: Receipt },
      { href: '/finance/advance-payment-summary', key: 'advancePaymentSummary', icon: HandCoins },
      { href: '/finance/management-summary',      key: 'managementSummary',     icon: PieChart },
      { href: '/gross-margin',                    key: 'grossMargin',           icon: DollarSign },
      { href: '/sales-analysis',                  key: 'salesAnalysis',         icon: TrendingUp },
      { href: '/reports',                         key: 'reports',               icon: PieChart },
    ],
  },

  /* 7. 期末作業 */
  {
    labelKey: 'groupFinPeriod',
    items: [
      { href: '/auto-journal', key: 'autoJournal', icon: Zap },
      { href: '/period-close', key: 'periodClose', icon: CalendarCheck2 },
    ],
  },

  /* 8. 通路定價 */
  {
    labelKey: 'groupChannels',
    items: [
      { href: '/channels',          key: 'channels',        icon: Store },
      { href: '/price-tiers',       key: 'priceTiers',      icon: Layers },
      { href: '/discount-rules',    key: 'discountRules',   icon: HandCoins },
      { href: '/customer-pricing',  key: 'customerPricing', icon: BadgeDollarSign },
    ],
  },

  /* 9. 系統 */
  {
    labelKey: 'groupSystem',
    items: [
      { href: '/documents', key: 'documents', icon: FileArchive },
      { href: '/audit-log', key: 'auditLog',  icon: Shield },
    ],
  },
]

/* ── Helpers ── */
const LEGACY_GROUPS_KEY = 'sidebar-collapsed-groups'
const LEGACY_SUBS_KEY = 'sidebar-collapsed-subs'
const PIN_LIMIT = 7

function storageKey(prefix: string, role: string | null): string {
  return `${prefix}_${role ?? 'default'}`
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch { return fallback }
}

function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

/* ── Component ── */
export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({})
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({})
  const [pinned, setPinned] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [pinWarning, setPinWarning] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const { dict } = useI18n()

  const activeGroups = userRole === 'FINANCE' ? financeNavGroups : navGroups

  // Load permissions
  useEffect(() => {
    fetch('/api/role-permissions/my')
      .then(r => r.json())
      .then(d => {
        setAllowedModules(d.allowedModules ?? ['*'])
        setUserRole(d.role ?? null)
      })
      .catch(() => setAllowedModules(['*']))
  }, [])

  // Hydrate persisted state once role is known. First-visit fallback:
  // only expand the group containing the current page.
  useEffect(() => {
    if (hydrated) return
    if (allowedModules === null) return
    const role = userRole ?? 'default'
    const gKey = storageKey('sidebar_groups_open', role)
    const sKey = storageKey('sidebar_subs_open', role)
    const pKey = storageKey('sidebar_pinned', role)

    let groups = loadJson<Record<string, boolean> | null>(gKey, null)
    let subs = loadJson<Record<string, boolean> | null>(sKey, null)

    if (groups === null) {
      // Migrate from legacy key if present
      const legacy = loadJson<Record<string, boolean> | null>(LEGACY_GROUPS_KEY, null)
      if (legacy && Object.keys(legacy).length > 0) {
        groups = legacy
      } else {
        // First-visit fallback: expand only current-page group
        const fallback: Record<string, boolean> = {}
        for (const g of activeGroups) {
          const allItems = g.items.flatMap(e => isSubGroup(e) ? e.items : [e])
          if (allItems.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))) {
            fallback[g.labelKey] = true
            break
          }
        }
        groups = fallback
      }
      saveJson(gKey, groups)
    }
    if (subs === null) {
      const legacySubs = loadJson<Record<string, boolean> | null>(LEGACY_SUBS_KEY, null)
      subs = legacySubs ?? {}
    }

    setGroupOpen(groups)
    setSubOpen(subs)
    setPinned(loadJson<string[]>(pKey, []))
    setHydrated(true)
  }, [userRole, allowedModules, hydrated, pathname, activeGroups])

  // Auto-expand group containing current page when pathname changes
  useEffect(() => {
    if (!hydrated) return
    const role = userRole ?? 'default'
    for (const group of activeGroups) {
      const allItems = group.items.flatMap(e => isSubGroup(e) ? e.items : [e])
      if (allItems.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) {
        if (!groupOpen[group.labelKey]) {
          setGroupOpen(prev => {
            const next = { ...prev, [group.labelKey]: true }
            saveJson(storageKey('sidebar_groups_open', role), next)
            return next
          })
        }
        for (const entry of group.items) {
          if (isSubGroup(entry) && entry.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))) {
            if (subOpen[entry.subLabelKey] === false) {
              setSubOpen(prev => {
                const next = { ...prev, [entry.subLabelKey]: true }
                saveJson(storageKey('sidebar_subs_open', role), next)
                return next
              })
            }
          }
        }
        break
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hydrated])

  const toggleGroup = useCallback((key: string) => {
    const role = userRole ?? 'default'
    setGroupOpen(prev => {
      const next = { ...prev, [key]: !(prev[key] ?? false) }
      saveJson(storageKey('sidebar_groups_open', role), next)
      return next
    })
  }, [userRole])

  const toggleSub = useCallback((key: string) => {
    const role = userRole ?? 'default'
    setSubOpen(prev => {
      const current = prev[key] !== false // default open
      const next = { ...prev, [key]: !current }
      saveJson(storageKey('sidebar_subs_open', role), next)
      return next
    })
  }, [userRole])

  const togglePin = useCallback((itemKey: string) => {
    const role = userRole ?? 'default'
    setPinned(prev => {
      const exists = prev.includes(itemKey)
      let next: string[]
      if (exists) {
        next = prev.filter(k => k !== itemKey)
      } else {
        if (prev.length >= PIN_LIMIT) {
          setPinWarning(true)
          setTimeout(() => setPinWarning(false), 2000)
          return prev
        }
        next = [...prev, itemKey]
      }
      saveJson(storageKey('sidebar_pinned', role), next)
      return next
    })
  }, [userRole])

  const canAccess = useCallback((key: string) =>
    !allowedModules || allowedModules.includes('*') || allowedModules.includes(key),
  [allowedModules])

  const filteredGroups = useMemo(() => {
    return activeGroups
      .map(group => ({
        ...group,
        label: (dict.nav as Record<string, string>)[group.labelKey] ?? group.labelKey,
        items: group.items
          .map(entry => {
            if (isSubGroup(entry)) {
              const filtered = entry.items.filter(i => canAccess(i.key))
              return filtered.length > 0 ? { ...entry, items: filtered } : null
            }
            return canAccess(entry.key) ? entry : null
          })
          .filter(Boolean) as NavGroupEntry[],
      }))
      .filter(group => group.items.length > 0)
  }, [activeGroups, canAccess, dict])

  const navLabel = useCallback(
    (key: string) => (dict.nav as Record<string, string>)[key] ?? key,
    [dict]
  )

  const allVisibleItems = useMemo(() => {
    return filteredGroups.flatMap(group =>
      group.items.flatMap(entry =>
        isSubGroup(entry)
          ? entry.items.map(item => ({ item, groupLabel: group.label }))
          : [{ item: entry as NavItem, groupLabel: group.label }]
      )
    )
  }, [filteredGroups])

  const pinnedItems = useMemo(() => {
    const lookup = new Map(allVisibleItems.map(({ item }) => [item.key, item]))
    return pinned.map(k => lookup.get(k)).filter((x): x is NavItem => !!x)
  }, [pinned, allVisibleItems])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return allVisibleItems.filter(({ item }) =>
      (navLabel(item.key) + item.href).toLowerCase().includes(q)
    )
  }, [searchQuery, allVisibleItems, navLabel])

  // Keyboard shortcut: `/` or ⌘K / Ctrl+K to focus search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (collapsed) setCollapsed(false)
        setTimeout(() => searchRef.current?.focus(), 0)
        return
      }
      if (e.key === '/' && !inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        if (collapsed) setCollapsed(false)
        setTimeout(() => searchRef.current?.focus(), 0)
        return
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearchQuery('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [collapsed])

  function renderNavItem(item: NavItem, opts: { inPinned?: boolean } = {}) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/')
    const isPinned = pinned.includes(item.key)
    return (
      <div key={item.href + (opts.inPinned ? '-pin' : '')} className="group/nav relative">
        <Link
          href={item.href}
          title={collapsed ? navLabel(item.key) : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors',
            active
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white',
            !collapsed && 'pr-8'
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{navLabel(item.key)}</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(item.key) }}
            title={isPinned ? '取消釘選' : '釘選到頂部'}
            aria-label={isPinned ? '取消釘選' : '釘選到頂部'}
            className={cn(
              'absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity',
              'opacity-0 group-hover/nav:opacity-100 focus:opacity-100',
              isPinned ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-500 hover:text-yellow-400'
            )}
          >
            <Star className={cn('h-3.5 w-3.5', isPinned && 'fill-current')} />
          </button>
        )}
      </div>
    )
  }

  const isLoading = allowedModules === null
  const pinnedLabel = (dict.nav as Record<string, string>).pinnedSection ?? '釘選'
  const customizeLabel = (dict.nav as Record<string, string>).customizeMenu ?? '自訂選單'

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-slate-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-700 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500">
          <span className="text-sm font-bold">C+</span>
        </div>
        {!collapsed && (
          <span className="ml-3 text-sm font-semibold whitespace-nowrap overflow-hidden">
            {dict.login.appName}
          </span>
        )}
      </div>

      {/* Search bar */}
      {!collapsed && (
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={(dict.nav as Record<string, string>).navSearch ?? '搜尋功能...'}
              className="w-full rounded-md bg-slate-800 py-2 pl-9 pr-10 text-sm text-slate-200 placeholder-slate-500 outline-none ring-0 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm leading-none"
                aria-label="清除搜尋"
              >
                ✕
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
                /
              </kbd>
            )}
          </div>
          {pinWarning && (
            <p className="mt-1 px-1 text-[11px] text-amber-400">
              釘選最多 {PIN_LIMIT} 個，請先取消其他再加入
            </p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 px-1 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : searchResults ? (
          !collapsed && (
            <div className="space-y-0.5">
              {searchResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-slate-500">找不到符合的功能</p>
              ) : (
                searchResults.map(({ item, groupLabel }) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSearchQuery('')}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors',
                        active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1 truncate">{navLabel(item.key)}</span>
                      <span className="shrink-0 text-[11px] text-slate-600">{groupLabel}</span>
                    </Link>
                  )
                })
              )}
            </div>
          )
        ) : (
          <>
            {/* Pinned section */}
            {!collapsed && pinnedItems.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Star className="mr-1.5 h-3 w-3 fill-current text-yellow-400" />
                  <span>{pinnedLabel}</span>
                  <span className="ml-auto text-slate-600">{pinnedItems.length}/{PIN_LIMIT}</span>
                </div>
                <div className="space-y-0.5">
                  {pinnedItems.map(item => renderNavItem(item, { inPinned: true }))}
                </div>
                <div className="mx-3 my-2 border-t border-slate-800" />
              </div>
            )}

            {/* Grouped nav */}
            {filteredGroups.map((group, gi) => {
              const isOpen = groupOpen[group.labelKey] ?? false
              return (
                <div key={group.labelKey} className={gi > 0 ? 'mt-2' : ''}>
                  {!collapsed ? (
                    <button
                      onClick={() => toggleGroup(group.labelKey)}
                      className="flex w-full items-center justify-between px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <span>{group.label}</span>
                      <ChevronDown className={cn('h-3 w-3 transition-transform', !isOpen && '-rotate-90')} />
                    </button>
                  ) : (
                    gi > 0 && <div className="mx-3 mb-1.5 mt-1.5 border-t border-slate-700" />
                  )}

                  {(collapsed || isOpen) && (
                    <div className="space-y-0.5">
                      {group.items.map(entry => {
                        if (isSubGroup(entry)) {
                          const subIsOpen = subOpen[entry.subLabelKey] !== false
                          return (
                            <div key={entry.subLabelKey}>
                              {!collapsed && (
                                <button
                                  onClick={() => toggleSub(entry.subLabelKey)}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                  <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', !subIsOpen && '-rotate-90')} />
                                  <span>{navLabel(entry.subLabelKey)}</span>
                                  <span className="ml-auto text-[11px] text-slate-600">{entry.items.length}</span>
                                </button>
                              )}
                              {(collapsed || subIsOpen) && (
                                <div className={cn('space-y-0.5', !collapsed && 'pl-3')}>
                                  {entry.items.map(item => renderNavItem(item))}
                                </div>
                              )}
                            </div>
                          )
                        }
                        return renderNavItem(entry)
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </nav>

      {/* Customize menu entry (P2 placeholder) */}
      {!collapsed && !isLoading && (
        <div className="border-t border-slate-700 px-2 pt-2">
          <button
            type="button"
            onClick={() => alert(`${customizeLabel}：拖拉排序尚未實作。目前可用 hover ⭐ 釘選常用功能到頂部。`)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span>{customizeLabel}</span>
          </button>
        </div>
      )}

      {/* Logout */}
      <div className="border-t border-slate-700 p-2">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={collapsed ? dict.header.logout : undefined}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium text-slate-400 transition-colors hover:bg-red-600/20 hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>{dict.header.logout}</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? '展開側欄' : '收合側欄'}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  )
}
