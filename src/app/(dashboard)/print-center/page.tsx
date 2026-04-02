'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  FileText, Truck, Package, ClipboardList, Printer,
  ShoppingCart, Receipt,
} from 'lucide-react'
import { toast } from 'sonner'

interface PrintOption {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  idLabel: string
  apiPath: string
}

const printOptions: PrintOption[] = [
  {
    id: 'quotation',
    title: '報價單',
    description: '列印客戶報價單（含品項明細）',
    icon: FileText,
    color: 'text-blue-600',
    idLabel: '報價單 ID',
    apiPath: '/api/quotations/{id}/export',
  },
  {
    id: 'shipment',
    title: '出貨單 / 裝箱單',
    description: '列印出貨明細與裝箱資訊',
    icon: Truck,
    color: 'text-indigo-600',
    idLabel: '出貨單 ID',
    apiPath: '/api/shipments/{id}/print',
  },
  {
    id: 'picking',
    title: '揀貨單',
    description: '列印倉庫揀貨作業清單（含庫位）',
    icon: Package,
    color: 'text-amber-600',
    idLabel: '理貨單 ID',
    apiPath: '/api/picking-orders/{id}/print',
  },
  {
    id: 'dispatch',
    title: '派車單',
    description: '列印配送路線與貨品清單',
    icon: ClipboardList,
    color: 'text-green-600',
    idLabel: '派車單 ID',
    apiPath: '/api/dispatch-orders/{id}/print',
  },
]

export default function PrintCenterPage() {
  const [ids, setIds] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  function handlePrint(option: PrintOption) {
    const id = ids[option.id]?.trim()
    if (!id) {
      toast.error(`請輸入${option.idLabel}`)
      return
    }
    setLoading(prev => ({ ...prev, [option.id]: true }))
    const url = option.apiPath.replace('{id}', id)
    window.open(url, '_blank')
    setTimeout(() => setLoading(prev => ({ ...prev, [option.id]: false })), 1000)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Printer className="h-6 w-6 text-slate-600" />列印中心
        </h1>
        <p className="text-sm text-muted-foreground mt-1">統一列印入口：輸入單號即可列印各類文件</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {printOptions.map(opt => {
          const Icon = opt.icon
          return (
            <Card key={opt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${opt.color}`} />
                  {opt.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{opt.idLabel}</Label>
                  <Input
                    placeholder={`輸入 ${opt.idLabel}...`}
                    value={ids[opt.id] ?? ''}
                    onChange={e => setIds(prev => ({ ...prev, [opt.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handlePrint(opt)}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handlePrint(opt)}
                  disabled={loading[opt.id]}
                >
                  <Printer className="mr-2 h-4 w-4" />列印
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Separator />

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">快速連結</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: '所有出貨單', href: '/shipments', icon: Truck },
            { label: '所有理貨單', href: '/picking', icon: Package },
            { label: '所有派車單', href: '/dispatch', icon: ClipboardList },
            { label: '所有報價單', href: '/quotations', icon: FileText },
            { label: '銷售訂單', href: '/orders', icon: ShoppingCart },
            { label: '銷貨單', href: '/sales-invoices', icon: Receipt },
          ].map(link => {
            const Icon = link.icon
            return (
              <a key={link.href} href={link.href}
                className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                <Icon className="h-4 w-4 text-muted-foreground" />{link.label}
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
