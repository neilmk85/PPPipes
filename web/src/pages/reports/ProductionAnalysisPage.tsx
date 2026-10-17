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

  async function load() {
    setLoading(true)
    try {
      const [invRes, ordersRes, entriesRes, extRes, configsRes] = await Promise.all([
        inventoryApi.getAllByOutlet(oid, undefined, 0, 200),
        productionOrderApi.getAll({ status: 'PLANNED,IN_PROGRESS', size: 100 }),
        productionEntryApi.getAll({ size: 500 }),
        siloExtractionsApi.list(),
        pipeConfigApi.getAll({ size: 200 }),
      ])

      // Silo balances from inventory
      const items: any[] = invRes.data?.data ?? invRes.data ?? []
      const core    = items.find((i: any) => i.product?.name === 'Silo CEMENT (CORE)'    || i.name === 'Silo CEMENT (CORE)')
      const coating = items.find((i: any) => i.product?.name === 'Silo CEMENT (COATING)' || i.name === 'Silo CEMENT (COATING)')
      const cBal = parseFloat(core?.quantityOnHand    ?? core?.quantity_on_hand    ?? 0)
      const oBal = parseFloat(coating?.quantityOnHand ?? coating?.quantity_on_hand ?? 0)
      setCoreBal(cBal)
      setCoatingBal(oBal)

      // Produced per pipeConfigId (FINAL_TESTING stage)
      const producedMap: Record<number, number> = {}
      const entries: any[] = entriesRes.data?.data ?? entriesRes.data ?? []
      entries.forEach((e: any) => {
        if (e.stageType === 'FINAL_TESTING') {
          const key = e.pipeConfigId
          producedMap[key] = (producedMap[key] ?? 0) + (e.pipesCompleted ?? 0)
        }
      })

      // Cement per pipe from pipe configs materials
      const configs: any[] = configsRes.data?.data ?? configsRes.data ?? []
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

      // Build order rows
      const activeOrders: any[] = ordersRes.data?.data ?? ordersRes.data ?? []
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
      setExtractions(extRes ?? [])
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Factory size={20} className="text-violet-600" />
            Production Analysis
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Cement availability vs pipe production — live from inventory
            {updatedAt && <span className="ml-2 text-gray-300">· Updated {updatedAt}</span>}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      {/* Silo balance cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-violet-600">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Silo CEMENT (CORE)</p>
          {loading ? (
            <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-black text-violet-600 tabular-nums">{fmt(coreBal)} <span className="text-sm font-medium text-gray-400">kg</span></p>
          )}
          <p className="text-xs text-gray-400 mt-1">Current inventory balance</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-blue-600">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Silo CEMENT (COATING)</p>
          {loading ? (
            <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-black text-blue-600 tabular-nums">{fmt(coatingBal)} <span className="text-sm font-medium text-gray-400">kg</span></p>
          )}
          <p className="text-xs text-gray-400 mt-1">Current inventory balance</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Planned', value: totalPlanned, color: 'text-violet-600', sub: 'pipes across all orders' },
          { label: 'Produced (Final Testing)', value: totalProduced, color: 'text-emerald-600', sub: 'pipes completed' },
          { label: 'Expected from CORE', value: totalExpectedCore, color: 'text-blue-600', sub: 'pipes (cement limited)' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{c.label}</p>
            {loading ? (
              <div className="h-8 w-20 bg-gray-100 rounded animate-pulse mx-auto" />
            ) : (
              <p className={`text-3xl font-black tabular-nums ${c.color}`}>{fmt(c.value)}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Production Orders</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {['Pipe Type','Status','Planned','Produced','CORE kg/pipe','COATING kg/pipe','Expected (CORE)','Expected (COATING)','Limiting'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-xs">
                  <Loader2 size={16} className="animate-spin inline mr-2" />Loading…
                </td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-xs">No active production orders</td></tr>
              ) : orders.map(o => {
                const expCore    = o.corePerPipe    > 0 ? Math.floor(coreBal    / o.corePerPipe)    : null
                const expCoating = o.coatingPerPipe > 0 ? Math.floor(coatingBal / o.coatingPerPipe) : null
                const isCoreLimiting = expCore != null && expCoating != null && expCore <= expCoating
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{o.pipeType}</td>
                    <td className="px-4 py-3">{pill(o.status)}</td>
                    <td className="px-4 py-3 tabular-nums text-right">{fmt(o.plannedQty)}</td>
                    <td className="px-4 py-3 tabular-nums text-right">
                      {o.produced > 0
                        ? <span className="text-emerald-600 font-bold">{fmt(o.produced)}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-right">{o.corePerPipe    > 0 ? fmt(o.corePerPipe)    : '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-right">{o.coatingPerPipe > 0 ? fmt(o.coatingPerPipe) : '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-right">{expCore    != null ? fmt(expCore)    : '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-right">{expCoating != null ? fmt(expCoating) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {expCore != null && expCoating != null
                        ? <span className={`font-bold ${isCoreLimiting ? 'text-violet-600' : 'text-blue-600'}`}>
                            {isCoreLimiting ? 'CORE' : 'COATING'}
                          </span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-[10px] text-gray-400 border-t border-gray-100">
          Expected = available cement ÷ cement per pipe. Limiting = whichever silo runs out first. Produced = pipes that reached Final Testing stage.
        </p>
      </div>

      {/* Silo extractions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <FlaskConical size={14} className="text-gray-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Silo Extractions</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {['Date','Silo','Quantity (kg)','Notes'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">Loading…</td></tr>
            ) : extractions.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">No extractions recorded</td></tr>
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
                  {i === 0 && <td className="px-4 py-3 text-gray-400" rowSpan={vals.length}>{e.notes || '—'}</td>}
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
