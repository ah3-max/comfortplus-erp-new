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

const roleConfig: Record<Role, { label: string; color: string }> = {
  SUPER_ADMIN:       { label: '超級管理員', color: 'bg-red-100 text-red-700' },
  GM:                { label: '總經理',     color: 'bg-purple-100 text-purple-700' },
  SALES_MANAGER:     { label: '業務主管',   color: 'bg-violet-100 text-violet-700' },
  SALES:             { label: '業務人員',   color: 'bg-blue-100 text-blue-700' },
  CARE_SUPERVISOR:   { label: '照顧督導',   color: 'bg-pink-100 text-pink-700' },
  ECOMMERCE:         { label: '電商營運',   color: 'bg-cyan-100 text-cyan-700' },
  CS:                { label: '客服人員',   color: 'bg-teal-100 text-teal-700' },
  WAREHOUSE_MANAGER: { label: '倉管主管',   color: 'bg-orange-100 text-orange-700' },
  WAREHOUSE:         { label: '倉儲物流',   color: 'bg-amber-100 text-amber-700' },
  PROCUREMENT:       { label: '採購人員',   color: 'bg-lime-100 text-lime-700' },
  FINANCE:           { label: '財務人員',   color: 'bg-slate-100 text-slate-600' },
}
const roles: Role[] = [
  'SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES', 'CARE_SUPERVISOR',
  'ECOMMERCE', 'CS', 'WAREHOUSE_MANAGER', 'WAREHOUSE',
  'PROCUREMENT', 'FINANCE',
]

// Module groups (same structure as sidebar)
const MODULE_GROUPS = [
  { label: '日常作業', modules: [
    { key: 'dashboard',   label: '總覽' },
    { key: 'dailyReport', label: '業務日報' },
    { key: 'crm',         label: '追蹤中心' },
    { key: 'calendar',    label: '行事曆' },
  ]},
  { label: '銷售業務', modules: [
    { key: 'customers',   label: '客戶管理' },
    { key: 'quotations',  label: '報價管理' },
    { key: 'orders',      label: '訂單管理' },
    { key: 'pipeline',    label: '銷售漏斗' },
    { key: 'tasks',       label: '業務工作' },
  ]},
  { label: '商品庫存', modules: [
    { key: 'products',    label: '商品管理' },
    { key: 'inventory',   label: '庫存管理' },
    { key: 'warehouses',  label: '倉庫管理' },
  ]},
  { label: '出貨物流', modules: [
    { key: 'shipments',   label: '出貨管理' },
    { key: 'logistics',   label: '物流商' },
  ]},
  { label: '採購生產', modules: [
    { key: 'purchases',   label: '採購管理' },
    { key: 'suppliers',   label: '供應商' },
    { key: 'production',  label: 'OEM生產' },
    { key: 'qc',          label: '品質檢驗' },
    { key: 'packaging',   label: '包材管理' },
    { key: 'seaFreight',  label: '海運追蹤' },
  ]},
  { label: '通路財務', modules: [
    { key: 'channels',    label: '線上通路' },
    { key: 'payments',    label: '收付款' },
  ]},
  { label: '服務', modules: [
    { key: 'care',        label: '照顧督導' },
  ]},
  { label: '系統', modules: [
    { key: 'reports',     label: '報表' },
    { key: 'users',       label: '用戶管理' },
    { key: 'settings',    label: '系統設定' },
  ]},
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
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'GM'

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
    if (!form.name || !form.role) { toast.error('請填寫必填欄位'); return }
    if (!editTarget && !form.password) { toast.error('新增用戶需設定密碼'); return }
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
      toast.error('無法停用超級管理員帳號')
      return
    }
    if (!confirm('確定停用此使用者帳號？此操作無法復原')) return
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
        <p className="text-muted-foreground">此頁面僅限管理員存取</p>
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
          用戶列表
        </button>
        <button onClick={() => setTab('permissions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === 'permissions' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <ShieldCheck className="h-3.5 w-3.5" />模組權限設定
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
                          title="編輯"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        {session?.user?.role === 'SUPER_ADMIN' && u.role !== 'SUPER_ADMIN' && u.isActive && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={deletingUserId === u.id}
                            className="rounded p-1 hover:bg-red-50 disabled:opacity-50"
                            title="停用帳號"
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
                各角色可看到的側邊欄模組
              </CardTitle>
              <p className="text-xs text-muted-foreground">打勾 = 該角色在側邊欄可以看到此模組。修改後請按「儲存權限」。</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="sticky left-0 bg-slate-50 z-10 px-4 py-2 text-left font-semibold text-slate-600 min-w-[140px]">
                        模組
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
                                title="全選/取消全選"
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
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="王小明" required />
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
              <Label>{editTarget ? '新密碼（留空不變更）' : '密碼'} {!editTarget && <span className="text-red-500">*</span>}</Label>
              <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)}
                placeholder={editTarget ? '留空不更改密碼' : '至少 8 個字元'} />
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
