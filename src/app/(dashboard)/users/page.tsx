'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Plus, Pencil, Loader2, ShieldCheck, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

// ═══════════════════════════════════════════════════════════════════════════
//  Types & Constants
// ═══════════════════════════════════════════════════════════════════════════

type Role =
  | 'SUPER_ADMIN' | 'GM' | 'SALES_MANAGER' | 'SALES' | 'CARE_SUPERVISOR'
  | 'ECOMMERCE' | 'CS' | 'WAREHOUSE_MANAGER' | 'WAREHOUSE'
  | 'PROCUREMENT' | 'FINANCE'

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN:       'bg-red-100 text-red-700',
  GM:                'bg-purple-100 text-purple-700',
  SALES_MANAGER:     'bg-violet-100 text-violet-700',
  SALES:             'bg-blue-100 text-blue-700',
  CARE_SUPERVISOR:   'bg-pink-100 text-pink-700',
  ECOMMERCE:         'bg-cyan-100 text-cyan-700',
  CS:                'bg-teal-100 text-teal-700',
  WAREHOUSE_MANAGER: 'bg-orange-100 text-orange-700',
  WAREHOUSE:         'bg-amber-100 text-amber-700',
  PROCUREMENT:       'bg-lime-100 text-lime-700',
  FINANCE:           'bg-slate-100 text-slate-600',
}
const roles: Role[] = [
  'SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES', 'CARE_SUPERVISOR',
  'ECOMMERCE', 'CS', 'WAREHOUSE_MANAGER', 'WAREHOUSE',
  'PROCUREMENT', 'FINANCE',
]

interface User {
  id: string; email: string; name: string
  role: Role; isActive: boolean; createdAt: string
}
interface FormData {
  email: string; name: string; password: string
  role: Role; isActive: boolean
}

const emptyForm = (): FormData => ({
  email: '', name: '', password: '', role: 'SALES' as Role, isActive: true,
})

type PageTab = 'users' | 'permissions'

// ═══════════════════════════════════════════════════════════════════════════
//  Main Page
// ═══════════════════════════════════════════════════════════════════════════

export default function UsersPage() {
  const { dict } = useI18n()
  const up = dict.usersPage
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'GM'

  const roleConfig: Record<Role, { label: string; color: string }> = {
    SUPER_ADMIN:       { label: dict.roles.SUPER_ADMIN,       color: ROLE_COLORS.SUPER_ADMIN },
    GM:                { label: dict.roles.GM,                color: ROLE_COLORS.GM },
    SALES_MANAGER:     { label: dict.roles.SALES_MANAGER,     color: ROLE_COLORS.SALES_MANAGER },
    SALES:             { label: dict.roles.SALES,             color: ROLE_COLORS.SALES },
    CARE_SUPERVISOR:   { label: dict.roles.CARE_SUPERVISOR,   color: ROLE_COLORS.CARE_SUPERVISOR },
    ECOMMERCE:         { label: dict.roles.ECOMMERCE,         color: ROLE_COLORS.ECOMMERCE },
    CS:                { label: dict.roles.CS,                color: ROLE_COLORS.CS },
    WAREHOUSE_MANAGER: { label: dict.roles.WAREHOUSE_MANAGER, color: ROLE_COLORS.WAREHOUSE_MANAGER },
    WAREHOUSE:         { label: dict.roles.WAREHOUSE,         color: ROLE_COLORS.WAREHOUSE },
    PROCUREMENT:       { label: dict.roles.PROCUREMENT,       color: ROLE_COLORS.PROCUREMENT },
    FINANCE:           { label: dict.roles.FINANCE,           color: ROLE_COLORS.FINANCE },
  }

  const MODULE_GROUPS = [
    { label: up.groupDaily, modules: [
      { key: 'dashboard',   label: dict.nav.dashboard },
      { key: 'dailyReport', label: dict.nav.dailyReport },
      { key: 'crm',         label: dict.nav.crm },
      { key: 'calendar',    label: dict.nav.calendar },
    ]},
    { label: up.groupSales, modules: [
      { key: 'customers',   label: dict.nav.customers },
      { key: 'quotations',  label: dict.nav.quotations },
      { key: 'orders',      label: dict.nav.orders },
      { key: 'pipeline',    label: dict.nav.pipeline },
      { key: 'tasks',       label: dict.nav.tasks },
    ]},
    { label: up.groupInventory, modules: [
      { key: 'products',    label: dict.nav.products },
      { key: 'inventory',   label: dict.nav.inventory },
      { key: 'warehouses',  label: dict.nav.warehouses },
    ]},
    { label: up.groupLogistics, modules: [
      { key: 'shipments',   label: dict.nav.shipments },
      { key: 'logistics',   label: dict.nav.logistics },
    ]},
    { label: up.groupProduction, modules: [
      { key: 'purchases',   label: dict.nav.purchases },
      { key: 'suppliers',   label: dict.nav.suppliers },
      { key: 'production',  label: dict.nav.production },
      { key: 'qc',          label: dict.nav.qc },
      { key: 'packaging',   label: dict.nav.packaging },
      { key: 'seaFreight',  label: dict.nav.seaFreight },
    ]},
    { label: up.groupFinance, modules: [
      { key: 'channels',    label: dict.nav.channels },
      { key: 'payments',    label: dict.nav.payments },
    ]},
    { label: up.groupService, modules: [
      { key: 'care',        label: dict.nav.care },
    ]},
    { label: up.groupSystem, modules: [
      { key: 'reports',     label: dict.nav.reports },
      { key: 'users',       label: dict.nav.users },
      { key: 'settings',    label: dict.nav.settings },
    ]},
  ]

  const [tab, setTab] = useState<PageTab>('users')

  // Users
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  // Permissions
  const [permMatrix, setPermMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [permRoles, setPermRoles] = useState<string[]>([])
  const [permLoading, setPermLoading] = useState(false)
  const [permDirty, setPermDirty] = useState(false)
  const [permSaving, setPermSaving] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [])

  const fetchPerms = useCallback(async () => {
    setPermLoading(true)
    try {
      const res = await fetch('/api/role-permissions')
      if (res.ok) {
        const data = await res.json()
        setPermMatrix(data.matrix)
        setPermRoles(data.roles)
      }
    } finally { setPermLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { if (tab === 'permissions') fetchPerms() }, [tab, fetchPerms])

  // ── User form handlers ──
  function openCreate() {
    setEditTarget(null); setForm(emptyForm()); setFormOpen(true)
  }
  function openEdit(user: User) {
    setEditTarget(user)
    setForm({ email: user.email, name: user.name, password: '', role: user.role, isActive: user.isActive })
    setFormOpen(true)
  }
  function set(field: keyof FormData, value: string | boolean) {
    setForm(p => ({ ...p, [field]: value }))
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.role) { toast.error(dict.common.requiredFields); return }
    if (!editTarget && !form.password) { toast.error(dict.usersPage.passwordRequired); return }
    setSaving(true)
    const url = editTarget ? `/api/users/${editTarget.id}` : '/api/users'
    const method = editTarget ? 'PUT' : 'POST'
    const body = editTarget
      ? { name: form.name, role: form.role, isActive: form.isActive, ...(form.password && { password: form.password }) }
      : form
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) { toast.success(editTarget ? dict.common.updateSuccess : dict.common.createSuccess); setFormOpen(false); fetchUsers() }
    else { const data = await res.json(); toast.error(data.error ?? dict.common.error) }
  }

  async function handleDeleteUser(u: User) {
    if (u.role === 'SUPER_ADMIN') {
      toast.error(dict.usersPage.cannotDisableSuperAdmin)
      return
    }
    if (!confirm(up.disableConfirm)) return
    setDeletingUserId(u.id)
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(dict.common.updateSuccess)
        fetchUsers()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? dict.common.error)
      }
    } catch {
      toast.error(dict.common.error)
    } finally {
      setDeletingUserId(null)
    }
  }

  // ── Permission handlers ──
  function togglePerm(role: string, mod: string) {
    setPermMatrix(prev => ({
      ...prev,
      [role]: { ...prev[role], [mod]: !prev[role]?.[mod] },
    }))
    setPermDirty(true)
  }

  function toggleRoleAll(role: string, checked: boolean) {
    setPermMatrix(prev => {
      const updated = { ...prev, [role]: { ...prev[role] } }
      MODULE_GROUPS.forEach(g => g.modules.forEach(m => { updated[role][m.key] = checked }))
      return updated
    })
    setPermDirty(true)
  }

  async function savePerms() {
    setPermSaving(true)
    try {
      const res = await fetch('/api/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrix: permMatrix }),
      })
      if (res.ok) { toast.success(dict.common.saveSuccess); setPermDirty(false) }
      else { const d = await res.json(); toast.error(d.error ?? dict.common.saveFailed) }
    } finally { setPermSaving(false) }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <ShieldCheck className="h-12 w-12 text-slate-300" />
        <p className="text-muted-foreground">{up.adminOnly}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{dict.users.title}</h1>
        {tab === 'users' && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{dict.users.newUser}</Button>
        )}
        {tab === 'permissions' && permDirty && (
          <Button onClick={savePerms} disabled={permSaving}>
            {permSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {dict.common.save}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'users' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          {up.tabUsers}
        </button>
        <button onClick={() => setTab('permissions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === 'permissions' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <ShieldCheck className="h-3.5 w-3.5" />{up.tabPermissions}
        </button>
      </div>

      {/* ═══ Tab: 用戶列表 ═══ */}
      {tab === 'users' && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.users.name}</TableHead>
                <TableHead>{dict.users.email}</TableHead>
                <TableHead className="w-28">{dict.users.role}</TableHead>
                <TableHead className="w-20">{dict.common.status}</TableHead>
                <TableHead className="w-28">{dict.common.createdAt}</TableHead>
                <TableHead className="w-24 text-center">{dict.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : users.map((u) => {
                const rc = roleConfig[u.role] ?? { label: u.role, color: 'bg-slate-100 text-slate-600' }
                return (
                  <TableRow key={u.id} className="group">
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rc.color}`}>{rc.label}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'default' : 'outline'}
                        className={u.isActive ? 'bg-green-100 text-green-700 border-green-200' : ''}>
                        {u.isActive ? dict.common.active : dict.common.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('zh-TW')}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded p-1 hover:bg-slate-100"
                          title={dict.common.edit}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        {session?.user?.role === 'SUPER_ADMIN' && u.role !== 'SUPER_ADMIN' && u.isActive && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={deletingUserId === u.id}
                            className="rounded p-1 hover:bg-red-50 disabled:opacity-50"
                            title={up.disableConfirm}
                          >
                            {deletingUserId === u.id
                              ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              : <Trash2 className="h-4 w-4 text-red-500" />}
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ═══ Tab: 模組權限設定 ═══ */}
      {tab === 'permissions' && (
        permLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                {up.permissionsTitle}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{up.permissionsHint}</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="sticky left-0 bg-slate-50 z-10 px-4 py-2 text-left font-semibold text-slate-600 min-w-[140px]">
                        {up.moduleColumn}
                      </th>
                      {permRoles.map(role => {
                        const rc = roleConfig[role as Role]
                        // Count how many are checked
                        const totalMods = MODULE_GROUPS.reduce((a, g) => a + g.modules.length, 0)
                        const checkedCount = MODULE_GROUPS.reduce((a, g) =>
                          a + g.modules.filter(m => permMatrix[role]?.[m.key]).length, 0)
                        const allChecked = checkedCount === totalMods
                        return (
                          <th key={role} className="px-1 py-2 text-center min-w-[64px]">
                            <div className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${rc?.color ?? ''}`}>
                              {rc?.label ?? role}
                            </div>
                            <div className="mt-1">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={() => toggleRoleAll(role, !allChecked)}
                                className="h-3 w-3 rounded border-slate-300 text-blue-600 cursor-pointer"
                                title={dict.common.selectAll}
                              />
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULE_GROUPS.map(group => (
                      <>
                        {/* Group header */}
                        <tr key={`g-${group.label}`} className="bg-slate-100/60">
                          <td colSpan={permRoles.length + 1}
                            className="sticky left-0 bg-slate-100/60 z-10 px-4 py-1.5 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">
                            {group.label}
                          </td>
                        </tr>
                        {/* Module rows */}
                        {group.modules.map(mod => (
                          <tr key={mod.key} className="border-b hover:bg-blue-50/30 transition-colors">
                            <td className="sticky left-0 bg-white z-10 px-4 py-2 font-medium text-slate-700">
                              {mod.label}
                            </td>
                            {permRoles.map(role => {
                              const checked = permMatrix[role]?.[mod.key] ?? false
                              // SUPER_ADMIN always has access — show as checked + disabled
                              const isSuperAdmin = role === 'SUPER_ADMIN'
                              return (
                                <td key={role} className="px-1 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSuperAdmin ? true : checked}
                                    disabled={isSuperAdmin}
                                    onChange={() => togglePerm(role, mod.key)}
                                    className={`h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer
                                      ${isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}
                                      ${checked ? '' : 'opacity-40'}`}
                                  />
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? dict.common.edit : dict.users.newUser}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{dict.users.name} <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.users.role} <span className="text-red-500">*</span></Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
                  {roles.map((r) => <option key={r} value={r}>{roleConfig[r].label}</option>)}
                </select>
              </div>
            </div>
            {!editTarget && (
              <div className="space-y-1.5">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                  placeholder="user@comfortplus.com" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{editTarget ? up.newPasswordLabel : up.passwordLabel} {!editTarget && <span className="text-red-500">*</span>}</Label>
              <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)}
                placeholder={editTarget ? up.passwordPlaceholder : up.newPasswordPlaceholder} />
            </div>
            {editTarget && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>{dict.common.status}</Label>
                  <button type="button" onClick={() => set('isActive', !form.isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTarget ? dict.common.save : dict.users.newUser}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
