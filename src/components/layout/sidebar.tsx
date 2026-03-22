'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Truck,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  PieChart,
  UserCog,
  ShoppingBag,
  Building2,
  Warehouse,
  Navigation,
  ListTodo,
  HeartHandshake,
  CalendarDays,
  CalendarRange,
  Factory,
  Ship,
  Store,
  CreditCard,
  Target,
  ClipboardCheck,
  Layers,
  Crosshair,
  AlertOctagon,
  Shield,
  ShieldAlert,
  SearchCode,
  Calculator,
  Receipt,
  BookOpen,
  FileArchive,
  Landmark,
  Briefcase,
  Star,
  Zap,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'

type NavKey = 'dashboard' | 'dailyReport' | 'crm' | 'quickInput' | 'customers' | 'keyAccounts' | 'products' | 'quotations' | 'orders' |
  'shipments' | 'pickup' | 'logistics' | 'inventory' | 'warehouses' | 'purchases' | 'suppliers' |
  'production' | 'seaFreight' | 'channels' | 'payments' | 'kpi' | 'pipeline' | 'opportunities' |
  'qc' | 'packaging' |
  'tasks' | 'care' | 'calendar' | 'businessCalendar' | 'reports' | 'users' | 'settings' | 'incidents' |
  'alerts' | 'traceability' | 'arAging' | 'marginCalc' | 'knowledge' | 'retail' | 'auditLog' | 'documents' |
  'groupDaily' | 'groupSales' | 'groupInventory' | 'groupLogistics' | 'groupProduction' | 'groupFinance' | 'groupService' | 'groupSystem'

type NavItem = { href: string; key: Exclude<NavKey, 'groupDaily' | 'groupSales' | 'groupInventory' | 'groupLogistics' | 'groupProduction' | 'groupFinance' | 'groupService' | 'groupSystem'>; icon: LucideIcon }
type NavGroup = { labelKey: NavKey; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    labelKey: 'groupDaily',
    items: [
      { href: '/dashboard',    key: 'dashboard',   icon: LayoutDashboard },
      { href: '/daily-report', key: 'dailyReport', icon: ClipboardCheck },
      { href: '/quick-input',  key: 'quickInput',  icon: Zap },
      { href: '/crm',          key: 'crm',         icon: Crosshair },
      { href: '/alerts',       key: 'alerts',      icon: ShieldAlert },
      { href: '/calendar',          key: 'calendar',         icon: CalendarDays },
      { href: '/business-calendar', key: 'businessCalendar',  icon: CalendarRange },
    ],
  },
  {
    labelKey: 'groupSales',
    items: [
      { href: '/customers',    key: 'customers',   icon: Users },
      { href: '/key-accounts', key: 'keyAccounts', icon: Star },
      { href: '/incidents',    key: 'incidents',   icon: AlertOctagon },
      { href: '/quotations',   key: 'quotations',  icon: FileText },
      { href: '/orders',       key: 'orders',      icon: ShoppingCart },
      { href: '/margin-calc',  key: 'marginCalc',  icon: Calculator },
      { href: '/kpi',                 key: 'kpi',            icon: Zap },
      { href: '/pipeline',            key: 'pipeline',       icon: Target },
      { href: '/sales-opportunities', key: 'opportunities',  icon: Briefcase },
      { href: '/tasks',               key: 'tasks',          icon: ListTodo },
    ],
  },
  {
    labelKey: 'groupInventory',
    items: [
      { href: '/products',     key: 'products',    icon: Package },
      { href: '/inventory',    key: 'inventory',   icon: BarChart3 },
      { href: '/warehouses',   key: 'warehouses',  icon: Warehouse },
      { href: '/traceability', key: 'traceability', icon: SearchCode },
    ],
  },
  {
    labelKey: 'groupLogistics',
    items: [
      { href: '/shipments',    key: 'shipments',   icon: Truck },
      { href: '/pickup',       key: 'pickup',      icon: Package },
      { href: '/logistics',    key: 'logistics',   icon: Navigation },
    ],
  },
  {
    labelKey: 'groupProduction',
    items: [
      { href: '/purchases',    key: 'purchases',   icon: ShoppingBag },
      { href: '/suppliers',    key: 'suppliers',   icon: Building2 },
      { href: '/production',   key: 'production',  icon: Factory },
      { href: '/qc',           key: 'qc',          icon: ClipboardCheck },
      { href: '/packaging',    key: 'packaging',   icon: Layers },
      { href: '/sea-freight',  key: 'seaFreight',  icon: Ship },
    ],
  },
  {
    labelKey: 'groupFinance',
    items: [
      { href: '/channels',     key: 'channels',    icon: Store },
      { href: '/retail',       key: 'retail',      icon: Landmark },
      { href: '/payments',     key: 'payments',    icon: CreditCard },
      { href: '/ar-aging',     key: 'arAging',     icon: Receipt },
    ],
  },
  {
    labelKey: 'groupService',
    items: [
      { href: '/care',         key: 'care',        icon: HeartHandshake },
      { href: '/knowledge',    key: 'knowledge',   icon: BookOpen },
    ],
  },
  {
    labelKey: 'groupSystem',
    items: [
      { href: '/reports',      key: 'reports',     icon: PieChart },
      { href: '/documents',    key: 'documents',   icon: FileArchive },
      { href: '/audit-log',    key: 'auditLog',    icon: Shield },
      { href: '/users',        key: 'users',       icon: UserCog },
      { href: '/settings',     key: 'settings',    icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null)
  const { dict } = useI18n()

  // Load user's allowed modules
  useEffect(() => {
    fetch('/api/role-permissions/my')
      .then(r => r.json())
      .then(d => setAllowedModules(d.allowedModules ?? ['*']))
      .catch(() => setAllowedModules(['*']))
  }, [])

  // Filter nav groups based on permissions
  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      label: dict.nav[group.labelKey] as string,
      items: group.items.filter(item =>
        !allowedModules || allowedModules.includes('*') || allowedModules.includes(item.key)
      ),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-slate-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        {filteredGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-3' : ''}>
            {/* Section label */}
            {!collapsed && (
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.label}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-3 mb-1.5 mt-1.5 border-t border-slate-700" />
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, key, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                const label = dict.nav[key]
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    </aside>
  )
}
