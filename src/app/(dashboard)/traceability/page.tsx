'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search, Factory, Ship, Package, ClipboardCheck, Truck, AlertTriangle,
  Loader2, MapPin, Calendar, Hash,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

// ── Types ───────────────────────────────────────────────────────────────────

interface Production {
  factoryName: string; country: string; startDate: string; endDate: string
  quantity: number; defectRate: number
}
interface Import {
  vessel: string; containerNo: string; portOfLoading: string; portOfDischarge: string
  etd: string; eta: string; actualArrival: string | null; customsStatus: string
}
interface Warehouse {
  lotNumber: string; warehouse: string; quantity: number
  manufactureDate: string; expiryDate: string; status: string
}
interface QC {
  qcNumber: string; result: 'PASS' | 'FAIL'; sampleSize: number; defectRate: number
  inspectedAt: string
}
interface Distribution {
  customerName: string; orderNo: string; shipmentNo: string
  shipDate: string; quantity: number
}
interface Incident {
  complaintNo: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string; createdAt: string
}
interface TraceData {
  batchNo: string
  production: Production | null
  import: Import | null
  warehouse: Warehouse | null
  qc: QC | null
  distribution: Distribution[]
  summary: { affectedCustomers: number; totalQty: number; totalShipments: number }
  incidents: Incident[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const severityColor: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

function Dt({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? '—'}</p>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function TraceabilityPage() {
  const { dict } = useI18n()
  const [batch, setBatch] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TraceData | null>(null)
  const [notFound, setNotFound] = useState(false)

  async function search() {
    if (!batch.trim()) return
    setLoading(true); setNotFound(false); setData(null)
    try {
      const res = await fetch(`/api/traceability/batch?batchNo=${encodeURIComponent(batch.trim())}`)
      if (!res.ok) { setNotFound(true); return }
      const json = await res.json()
      if (!json || !json.batchNo) { setNotFound(true); return }
      setData(json)
    } catch { setNotFound(true) }
    finally { setLoading(false) }
  }

  const steps = [
    { icon: Factory, label: dict.traceability.stepProduction, active: !!data?.production },
    { icon: Ship, label: dict.traceability.stepImport, active: !!data?.import },
    { icon: Package, label: dict.traceability.stepWarehouse, active: !!data?.warehouse },
    { icon: ClipboardCheck, label: dict.traceability.stepQC, active: !!data?.qc },
    { icon: Truck, label: dict.traceability.stepDistribution, active: (data?.distribution?.length ?? 0) > 0 },
    { icon: AlertTriangle, label: dict.traceability.stepIncident, active: (data?.incidents?.length ?? 0) > 0 },
  ]

  return (
    <div className="space-y-6">
      {/* ── Search ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 max-w-xl mx-auto">
            <Input
              placeholder={dict.traceability.searchPlaceholder}
              value={batch}
              onChange={e => setBatch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              className="h-12 text-lg"
            />
            <Button onClick={search} disabled={loading} className="h-12 px-6">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            </Button>
          </div>
          {notFound && (
            <p className="text-center text-destructive mt-4 font-medium">{dict.traceability.notFound}「{batch}」</p>
          )}
        </CardContent>
      </Card>

      {data && (
        <>
          {/* ── Timeline bar ─────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-1 px-2 overflow-x-auto">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-1">
                <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium
                  ${s.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </div>
                {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>

          {/* ── Production ───────────────────────────────────────── */}
          {data.production && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Factory className="h-4 w-4" /> {dict.traceability.sectionProduction}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Dt label={dict.traceability.colFactory} value={data.production.factoryName} />
                <Dt label={dict.traceability.colCountry} value={data.production.country} />
                <Dt label={dict.traceability.colProductionPeriod} value={`${data.production.startDate} ~ ${data.production.endDate}`} />
                <Dt label={dict.traceability.colQty} value={data.production.quantity.toLocaleString()} />
              </CardContent>
            </Card>
          )}

          {/* ── Import ───────────────────────────────────────────── */}
          {data.import && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Ship className="h-4 w-4" /> {dict.traceability.sectionImport}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Dt label={dict.traceability.colVesselName} value={data.import.vessel} />
                <Dt label={dict.traceability.colContainer} value={data.import.containerNo} />
                <Dt label={dict.traceability.colRoute} value={`${data.import.portOfLoading} → ${data.import.portOfDischarge}`} />
                <Dt label={dict.traceability.colEtdEta} value={`${data.import.etd} / ${data.import.eta}`} />
                <Dt label={dict.traceability.colActualArrival} value={data.import.actualArrival ?? '—'} />
                <Dt label={dict.traceability.colCustomsStatus} value={<Badge variant="outline">{data.import.customsStatus}</Badge>} />
              </CardContent>
            </Card>
          )}

          {/* ── Warehouse ────────────────────────────────────────── */}
          {data.warehouse && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> {dict.traceability.sectionWarehouse}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Dt label={dict.traceability.colBatchNo} value={data.warehouse.lotNumber} />
                <Dt label={dict.traceability.colWarehouse} value={data.warehouse.warehouse} />
                <Dt label={dict.traceability.colQty} value={data.warehouse.quantity.toLocaleString()} />
                <Dt label={dict.traceability.colMfgExpiry} value={`${data.warehouse.manufactureDate} / ${data.warehouse.expiryDate}`} />
                <Dt label={dict.traceability.colStatus} value={<Badge variant={data.warehouse.status === 'AVAILABLE' ? 'default' : 'secondary'}>{data.warehouse.status}</Badge>} />
              </CardContent>
            </Card>
          )}

          {/* ── QC ───────────────────────────────────────────────── */}
          {data.qc && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> {dict.traceability.sectionQC}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Dt label={dict.traceability.colQcNo} value={data.qc.qcNumber} />
                <Dt label={dict.traceability.colResult} value={
                  <Badge className={data.qc.result === 'PASS' ? 'bg-green-600' : 'bg-red-600'}>{data.qc.result}</Badge>
                } />
                <Dt label={dict.traceability.colSampleSize} value={data.qc.sampleSize} />
                <Dt label={dict.traceability.colDefectRate} value={`${data.qc.defectRate}%`} />
              </CardContent>
            </Card>
          )}

          {/* ── Summary ──────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: dict.traceability.summaryAffectedCustomers, value: data.summary.affectedCustomers, icon: Hash },
              { label: dict.traceability.summaryTotalQty, value: data.summary.totalQty.toLocaleString(), icon: Package },
              { label: dict.traceability.summaryTotalShipments, value: data.summary.totalShipments, icon: Truck },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 flex items-center gap-3">
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Distribution ─────────────────────────────────────── */}
          {data.distribution.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> {dict.traceability.sectionDistribution}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">{dict.traceability.colCustomer}</th>
                      <th className="py-2 pr-4">{dict.traceability.colOrderNo}</th>
                      <th className="py-2 pr-4">{dict.traceability.colShipmentNo}</th>
                      <th className="py-2 pr-4">{dict.traceability.colShipDate}</th>
                      <th className="py-2 text-right">{dict.traceability.colQty}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.distribution.map((d, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4">{d.customerName}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{d.orderNo}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{d.shipmentNo}</td>
                        <td className="py-2 pr-4">{d.shipDate}</td>
                        <td className="py-2 text-right">{d.quantity.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* ── Incidents ────────────────────────────────────────── */}
          {data.incidents.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> {dict.traceability.sectionIncidents}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.incidents.map((inc, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge className={severityColor[inc.severity] ?? ''}>{inc.severity}</Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{inc.complaintNo}</p>
                      <p className="text-xs text-muted-foreground">{inc.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{inc.createdAt}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
