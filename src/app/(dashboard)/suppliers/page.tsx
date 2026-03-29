'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SupplierForm } from '@/components/purchases/supplier-form'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface Supplier {
  id: string; code: string; name: string; contactPerson: string | null
  phone: string | null; email: string | null; address: string | null
  taxId: string | null; paymentTerms: string | null
  leadTimeDays: number | null; supplyCategories: string | null
  supplyItems: string | null; notes: string | null; isActive: boolean
  _count: { purchaseOrders: number }
}

export default function SuppliersPage() {
  const router = useRouter()
  const { dict } = useI18n()
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen]     = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)       params.set('search', search)
    if (showInactive) params.set('showAll', 'true')
    const res = await fetch(`/api/suppliers?${params}`)
    setSuppliers(await res.json())
    setLoading(false)
  }, [search, showInactive])

  useEffect(() => {
    const t = setTimeout(fetchSuppliers, 300)
    return () => clearTimeout(t)
  }, [fetchSuppliers])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${dict.suppliersPage.deactivateConfirm.replace('{name}', name)}`)) return
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.suppliersPage.deactivated); fetchSuppliers() }
    else toast.error(dict.common.updateFailed)
  }

  const purchaseTypeLabels: Record<string, string> = {
    FINISHED_GOODS:     dict.purchases.purchaseTypes.FINISHED_GOODS,
    OEM:                dict.purchases.purchaseTypes.OEM,
    PACKAGING:          dict.purchases.purchaseTypes.PACKAGING,
    RAW_MATERIAL:       dict.purchases.purchaseTypes.RAW_MATERIAL,
    GIFT_PROMO:         dict.purchases.purchaseTypes.GIFT_PROMO,
    LOGISTICS_SUPPLIES: dict.purchases.purchaseTypes.LOGISTICS_SUPPLIES,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.suppliers.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.suppliers.subtitle.replace('{n}', String(suppliers.length))}{dict.common.supplier}</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />{dict.suppliers.newSupplier}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.suppliers.searchPlaceholder}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300" />
          {dict.suppliersPage.showInactive}{dict.common.inactive}{dict.common.supplier}
        </label>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">{dict.suppliers.code}</TableHead>
              <TableHead>{dict.suppliers.name}</TableHead>
              <TableHead>{dict.suppliers.contact}</TableHead>
              <TableHead>{dict.suppliers.category}</TableHead>
              <TableHead className="w-20 text-center">{dict.suppliersPage.leadTimeDays}</TableHead>
              <TableHead className="w-20 text-center">{dict.suppliersPage.purchaseCount}</TableHead>
              <TableHead className="w-24">{dict.suppliers.paymentTerms}</TableHead>
              <TableHead className="w-16">{dict.common.status}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                  {search ? dict.suppliers.noResults : dict.suppliers.noSuppliers}
                </TableCell>
              </TableRow>
            ) : suppliers.map(s => {
              const categories = s.supplyCategories ? JSON.parse(s.supplyCategories) as string[] : []
              return (
                <TableRow key={s.id} className="group cursor-pointer hover:bg-slate-50/80"
                  onClick={() => router.push(`/suppliers/${s.id}`)}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{s.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <Building2 className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="font-medium">{s.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.contactPerson ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{s.phone ?? s.email ?? '—'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {categories.length > 0
                        ? categories.map((c: string) => (
                          <Badge key={c} variant="outline" className="text-xs px-1.5 py-0">
                            {purchaseTypeLabels[c] ?? c}
                          </Badge>
                        ))
                        : <span className="text-sm text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {s.leadTimeDays != null ? `${s.leadTimeDays}${dict.suppliersPage.daysUnit}` : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium text-blue-600">{s._count.purchaseOrders}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.paymentTerms ?? '—'}</TableCell>
                  <TableCell>
                    {s.isActive
                      ? <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">{dict.common.active}</Badge>
                      : <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">{dict.common.inactive}</Badge>}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => { setEditTarget(s); setFormOpen(true) }}>
                          <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                        </DropdownMenuItem>
                        {s.isActive && (
                          <DropdownMenuItem onClick={() => handleDelete(s.id, s.name)} variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />{dict.common.inactive}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <SupplierForm open={formOpen} onClose={() => setFormOpen(false)}
        onSuccess={fetchSuppliers} supplier={editTarget} />
    </div>
  )
}
