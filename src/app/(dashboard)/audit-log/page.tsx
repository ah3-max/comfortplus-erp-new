'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Shield, Search, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

interface AuditLogEntry {
  id: string
  userId: string
  userName: string
  userRole: string
  timestamp: string
  ipAddress: string | null
  userAgent: string | null
  module: string
  action: string
  entityType: string
  entityId: string
  entityLabel: string | null
  changes: Record<string, { before: any; after: any }> | null
  reason: string | null
  user: { name: string; role: string }
}

const MODULES = [
  'customers', 'orders', 'quotations', 'sales-invoices', 'sales-returns',
  'inventory', 'inbound', 'wms', 'qc', 'production',
  'purchases', 'suppliers', 'payments', 'receipts', 'expenses', 'petty-cash',
  'hr', 'users', 'settings', 'incidents', 'approvals',
]
const ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE',
  'APPROVE', 'REJECT', 'SUBMIT',
  'PRICE_CHANGE', 'QC_RELEASE', 'INVENTORY_ADJUST',
  'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE',
]

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 border-green-300',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-300',
  DELETE: 'bg-red-100 text-red-800 border-red-300',
  APPROVE: 'bg-purple-100 text-purple-800 border-purple-300',
  PRICE_CHANGE: 'bg-amber-100 text-amber-800 border-amber-300',
  QC_RELEASE: 'bg-teal-100 text-teal-800 border-teal-300',
  INVENTORY_ADJUST: 'bg-indigo-100 text-indigo-800 border-indigo-300',
}

const MODULE_COLOR: Record<string, string> = {
  customers: 'bg-sky-100 text-sky-800',
  orders: 'bg-orange-100 text-orange-800',
  inventory: 'bg-emerald-100 text-emerald-800',
  qc: 'bg-violet-100 text-violet-800',
  incidents: 'bg-rose-100 text-rose-800',
  payments: 'bg-lime-100 text-lime-800',
  quotations: 'bg-cyan-100 text-cyan-800',
}

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800',
  GM: 'bg-purple-100 text-purple-800',
  SALES: 'bg-blue-100 text-blue-800',
  WAREHOUSE: 'bg-green-100 text-green-800',
  ACCOUNTING: 'bg-amber-100 text-amber-800',
  CS: 'bg-pink-100 text-pink-800',
}

const PAGE_SIZE = 50

// ═══════════════════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════════════════

export default function AuditLogPage() {
  const { t } = useI18n()

  // Filters
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [userName, setUserName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Data
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Expanded rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchLogs = async (newOffset = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (module) params.set('module', module)
      if (action) params.set('action', action)
      if (userName) params.set('userName', userName)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(newOffset))

      const res = await fetch(`/api/audit-log?${params}`)
      if (!res.ok) {
        if (res.status === 403) {
          setLogs([])
          setTotal(0)
          return
        }
        throw new Error('Failed to fetch')
      }
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setOffset(newOffset)
      setSearched(true)
    } catch {
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setExpanded(new Set())
    fetchLogs(0)
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-slate-600" />
        <div>
          <h1 className="text-2xl font-bold">{t('nav.auditLog')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('common.search')} &amp; {t('common.filter')}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            {/* Module */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Module</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={module}
                onChange={e => setModule(e.target.value)}
              >
                <option value="">{t('common.all')}</option>
                {MODULES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Action</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={action}
                onChange={e => setAction(e.target.value)}
              >
                <option value="">{t('common.all')}</option>
                {ACTIONS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* User name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">用戶名稱</label>
              <Input
                placeholder="搜尋用戶..."
                className="h-9 w-36"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* Date from */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('common.date')} (from)</label>
              <Input
                type="date"
                className="h-9 w-40"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date to */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('common.date')} (to)</label>
              <Input
                type="date"
                className="h-9 w-40"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>

            {/* Search button */}
            <Button onClick={handleSearch} disabled={loading} className="h-9">
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
              {t('common.search')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{t('nav.auditLog')}</span>
            {searched && (
              <span className="text-sm font-normal text-muted-foreground">
                {t('common.total')} {total} {t('common.items')}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !searched ? (
            <p className="py-12 text-center text-muted-foreground">
              {t('common.search')}
            </p>
          ) : logs.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">{t('common.noData')}</p>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                      <th className="w-8 pb-2" />
                      <th className="pb-2 pr-3">{t('common.date')}</th>
                      <th className="pb-2 pr-3">User</th>
                      <th className="pb-2 pr-3">Module</th>
                      <th className="pb-2 pr-3">Action</th>
                      <th className="pb-2 pr-3">Entity</th>
                      <th className="pb-2 pr-3">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const isExpanded = expanded.has(log.id)
                      const hasChanges = log.changes && Object.keys(log.changes).length > 0
                      return (
                        <>
                          <tr key={log.id} className="border-b hover:bg-muted/30">
                            {/* Expand toggle */}
                            <td className="py-2 pr-1">
                              {hasChanges ? (
                                <button
                                  onClick={() => toggleExpand(log.id)}
                                  className="rounded p-0.5 hover:bg-muted"
                                >
                                  {isExpanded
                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                </button>
                              ) : (
                                <span className="inline-block w-5" />
                              )}
                            </td>

                            {/* Timestamp */}
                            <td className="py-2 pr-3 whitespace-nowrap text-xs">
                              {fmtDate(log.timestamp)}
                            </td>

                            {/* User */}
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{log.userName}</span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_COLOR[log.userRole] ?? ''}`}>
                                  {log.userRole}
                                </Badge>
                              </div>
                            </td>

                            {/* Module */}
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className={`text-[10px] ${MODULE_COLOR[log.module] ?? ''}`}>
                                {log.module}
                              </Badge>
                            </td>

                            {/* Action */}
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className={`text-[10px] ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-800'}`}>
                                {log.action}
                              </Badge>
                            </td>

                            {/* Entity */}
                            <td className="py-2 pr-3">
                              <span className="text-xs text-muted-foreground">{log.entityType}</span>
                              {log.entityLabel && (
                                <span className="ml-1 font-medium">{log.entityLabel}</span>
                              )}
                            </td>

                            {/* IP */}
                            <td className="py-2 pr-3 text-xs text-muted-foreground">
                              {log.ipAddress ?? '-'}
                            </td>
                          </tr>

                          {/* Inline expanded changes row */}
                          {isExpanded && hasChanges && (
                            <tr key={`${log.id}-changes`} className="bg-muted/20 border-b">
                              <td />
                              <td colSpan={6} className="pb-3 pt-1 pr-3">
                                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                                  變更內容 — {log.entityLabel ?? log.entityId}
                                  {log.reason && <span className="ml-2 font-normal text-muted-foreground">({log.reason})</span>}
                                </p>
                                <div className="space-y-1">
                                  {Object.entries(log.changes!).map(([field, diff]) => (
                                    <div key={field} className="flex gap-2 text-xs">
                                      <span className="font-medium min-w-[120px] text-muted-foreground">{field}</span>
                                      <span className="text-red-600 line-through">{JSON.stringify(diff.before)}</span>
                                      <span className="text-slate-400 mx-1">→</span>
                                      <span className="text-green-600">{JSON.stringify(diff.after)}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} / {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0}
                      onClick={() => fetchLogs(offset - PAGE_SIZE)}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + PAGE_SIZE >= total}
                      onClick={() => fetchLogs(offset + PAGE_SIZE)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
