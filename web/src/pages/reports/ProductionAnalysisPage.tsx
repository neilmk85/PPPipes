import { useEffect, useState } from 'react'
import { RefreshCw, Factory, Loader2, FlaskConical } from 'lucide-react'
import { inventoryApi, productionOrderApi, productionEntryApi, pipeConfigApi } from '@/services/api'
import { siloExtractionsApi } from '@/services/businessApi'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface OrderRow {
  id: number
  pipeType: string
  status: string
  plannedQty: number
  produced: number
  corePerPipe: number
  coatingPerPipe: number
}

interface SiloExtraction {
  id: number
  date: string
  silo1Value: string
  silo2Value: string
  silo3Value: string
  notes?: string
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('en-IN')
}

function pill(status: string) {
  if (status === 'IN_PROGRESS')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">In Progress</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">Planned</span>
}

export default function ProductionAnalysisPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1

  const [loading, setLoading]       = useState(true)
  const [coreBal, setCoreBal]       = useState<number>(0)
  const [coatingBal, setCoatingBal] = useState<number>(0)
  const [orders, setOrders]         = useState<OrderRow[]>([])
  const [extractions, setExtractions] = useState<SiloExtraction[]>([])
  const [updatedAt, setUpdatedAt]   = useState<string>('')
  const [dbg, setDbg]               = useState<string>('')

  async function load() {
    setLoading(true)
    try {
      const [invRes, plannedRes, inProgressRes, entriesRes, extData, configsRes] = await Promise.all([
        inventoryApi.getAllByOutlet(oid, undefined, 0, 200),
        productionOrderApi.getAll({ status: 'PLANNED', size: 100 }),
        productionOrderApi.getAll({ status: 'IN_PROGRESS', size: 100 }),
        productionEntryApi.getAll({ stageType: 'FINAL_TESTING', size: 1000 }),
        siloExtractionsApi.list(),
        pipeConfigApi.getAll({ size: 200 }),
      ])

      // Silo balances from inventory (paginated: res.data.data.content)
      const rawInv = invRes.data?.data
      const items: any[] = Array.isArray(rawInv) ? rawInv : (rawInv?.content ?? rawInv?.items ?? [])
      const firstNames = items.slice(0, 3).map((i: any) => i.product?.name ?? i.name ?? '?').join(', ')
      setDbg(`items:${items.length} keys:${rawInv ? Object.keys(rawInv).join(',') : 'null'} first:[${firstNames}]`)
      const core    = items.find((i: any) => i.product?.name === 'Silo CEMENT (CORE)'    || i.name === 'Silo CEMENT (CORE)')
      const coating = items.find((i: any) => i.product?.name === 'Silo CEMENT (COATING)' || i.name === 'Silo CEMENT (COATING)')
      const cBal = parseFloat(core?.quantityOnHand    ?? core?.quantity_on_hand    ?? 0)
      const oBal = parseFloat(coating?.quantityOnHand ?? coating?.quantity_on_hand ?? 0)
      setCoreBal(cBal)
      setCoatingBal(oBal)

      // Produced per pipeConfigId (FINAL_TESTING stage)
      const producedMap: Record<number, number> = {}
      const entries: any[] = entriesRes.data?.data?.content ?? entriesRes.data?.data ?? []
      entries.forEach((e: any) => {
        const key = e.pipeConfigId
        producedMap[key] = (producedMap[key] ?? 0) + (e.pipesCompleted ?? 0)
      })

      // Cement per pipe from pipe configs materials
      const configs: any[] = configsRes.data?.data?.content ?? configsRes.data?.data ?? []
      const formulaMap: Record<number, { core: number; coating: number }> = {}
      configs.forEach((c: any) => {
        const materials: any[] = c.materials ?? []
        const coreM    = materials.find((m: any) => m.materialName?.includes('CORE')    || m.product?.name?.includes('CORE'))
        const coatingM = materials.find((m: any) => m.materialName?.includes('COATING') || m.product?.name?.includes('COATING'))
        formulaMap[c.id] = {
          core:    parseFloat(coreM?.quantityPerPipe    ?? 0),
          coating: parseFloat(coatingM?.quantityPerPipe ?? 0),
        }
      })

      // Build order rows — combine PLANNED + IN_PROGRESS
      const activeOrders: any[] = [
        ...(plannedRes.data?.data?.content    ?? plannedRes.data?.data    ?? []),
        ...(inProgressRes.data?.data?.content ?? inProgressRes.data?.data ?? []),
      ]
      const rows: OrderRow[] = activeOrders.map((o: any) => {
        const configId = o.pipeConfigId ?? o.pipeConfig?.id
        const f = formulaMap[configId] ?? { core: 0, coating: 0 }
        return {
          id:            o.id,
          pipeType:      o.pipeConfig?.name ?? '—',
          status:        o.status,
          plannedQty:    o.plannedQty ?? 0,
          produced:      producedMap[configId] ?? 0,
          corePerPipe:   f.core,
          coatingPerPipe: f.coating,
        }
      })
      setOrders(rows)
      setExtractions(extData ?? [])
      setUpdatedAt(new Date().toLocaleTimeString('en-IN'))
    } catch (e: any) {
      toast.error('Failed to load production analysis data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalPlanned  = orders.reduce((s, o) => s + o.plannedQty, 0)
  const totalProduced = orders.reduce((s, o) => s + o.produced, 0)

  // Expected pipes = min(core / corePerPipe, coating / coatingPerPipe) per order — summed
  const totalExpectedCore = orders.reduce((s, o) => {
    if (o.corePerPipe <= 0) return s
    return s + Math.floor(coreBal / o.corePerPipe)
  }, 0)

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <Factory size={18} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Production Analysis</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Cement availability vs pipe production
                {updatedAt && <span className="ml-2 text-gray-400">· Updated {updatedAt}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>
        </div>
      </div>

      {dbg && <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-xs font-mono text-yellow-800 break-all">{dbg}</div>}

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Silo balance cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm border-t-4 border-t-violet-600">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Silo CEMENT (CORE)</p>
            {loading ? (
              <div className="h-9 w-36 bg-gray-100 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-black text-violet-600 tabular-nums">{fmt(coreBal)} <span className="text-sm font-medium text-gray-500">kg</span></p>
            )}
            <p className="text-xs text-gray-500 mt-1">Current inventory balance</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm border-t-4 border-t-blue-600">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Silo CEMENT (COATING)</p>
            {loading ? (
              <div className="h-9 w-36 bg-gray-100 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-black text-blue-600 tabular-nums">{fmt(coatingBal)} <span className="text-sm font-medium text-gray-500">kg</span></p>
            )}
            <p className="text-xs text-gray-500 mt-1">Current inventory balance</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Planned', value: totalPlanned, color: 'text-violet-600', sub: 'pipes across all orders' },
            { label: 'Produced (Final Testing)', value: totalProduced, color: 'text-emerald-600', sub: 'pipes completed' },
            { label: 'Expected from CORE', value: totalExpectedCore, color: 'text-blue-600', sub: 'pipes (cement limited)' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm text-center">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1">{c.label}</p>
              {loading ? (
                <div className="h-9 w-24 bg-gray-100 rounded animate-pulse mx-auto" />
              ) : (
                <p className={`text-3xl font-black tabular-nums ${c.color}`}>{fmt(c.value)}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <p className="text-sm font-bold text-gray-800">Production Orders</p>
            <p className="text-xs text-gray-500 mt-0.5">Active orders with cement requirement and expected output</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-200">
                  {['Pipe Type','Status','Planned','Produced','CORE kg/pipe','COATING kg/pipe','Expected (CORE)','Expected (COATING)','Limiting'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500 text-sm">
                    <Loader2 size={16} className="animate-spin inline mr-2" />Loading…
                  </td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500 text-sm">No active production orders</td></tr>
                ) : orders.map(o => {
                  const expCore    = o.corePerPipe    > 0 ? Math.floor(coreBal    / o.corePerPipe)    : null
                  const expCoating = o.coatingPerPipe > 0 ? Math.floor(coatingBal / o.coatingPerPipe) : null
                  const isCoreLimiting = expCore != null && expCoating != null && expCore <= expCoating
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{o.pipeType}</td>
                      <td className="px-4 py-3">{pill(o.status)}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">{fmt(o.plannedQty)}</td>
                      <td className="px-4 py-3 tabular-nums text-right">
                        {o.produced > 0
                          ? <span className="text-emerald-600 font-bold">{fmt(o.produced)}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">{o.corePerPipe    > 0 ? fmt(o.corePerPipe)    : '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">{o.coatingPerPipe > 0 ? fmt(o.coatingPerPipe) : '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">{expCore    != null ? fmt(expCore)    : '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">{expCoating != null ? fmt(expCoating) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {expCore != null && expCoating != null
                          ? <span className={`font-bold ${isCoreLimiting ? 'text-violet-600' : 'text-blue-600'}`}>
                              {isCoreLimiting ? 'CORE' : 'COATING'}
                            </span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100">
            Expected = available cement ÷ cement per pipe. Limiting = whichever silo runs out first. Produced = pipes that reached Final Testing stage.
          </p>
        </div>

        {/* Silo extractions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
            <FlaskConical size={15} className="text-gray-500" />
            <div>
              <p className="text-sm font-bold text-gray-800">Silo Extractions</p>
              <p className="text-xs text-gray-500 mt-0.5">Cement removed from silos outside of production</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Date','Silo','Quantity (kg)','Notes'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">Loading…</td></tr>
              ) : extractions.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">No extractions recorded</td></tr>
              ) : extractions.map(e => {
                const vals = [
                  e.silo1Value && parseFloat(e.silo1Value) > 0 ? { silo: 1, val: parseFloat(e.silo1Value) } : null,
                  e.silo2Value && parseFloat(e.silo2Value) > 0 ? { silo: 2, val: parseFloat(e.silo2Value) } : null,
                  e.silo3Value && parseFloat(e.silo3Value) > 0 ? { silo: 3, val: parseFloat(e.silo3Value) } : null,
                ].filter(Boolean) as { silo: number; val: number }[]
                return vals.map((v, i) => (
                  <tr key={`${e.id}-${v.silo}`} className="hover:bg-gray-50">
                    {i === 0 && <td className="px-4 py-3 text-gray-700" rowSpan={vals.length}>{e.date}</td>}
                    <td className="px-4 py-3 text-gray-700">Silo {v.silo}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-gray-900">{fmt(v.val * 1000)}</td>
                    {i === 0 && <td className="px-4 py-3 text-gray-600" rowSpan={vals.length}>{e.notes || '—'}</td>}
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
