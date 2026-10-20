import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { RefreshCw, Factory, Loader2, FlaskConical, AlertTriangle } from 'lucide-react'
import { inventoryApi, productionOrderApi, productionEntryApi, pipeConfigApi } from '@/services/api'
import { siloExtractionsApi } from '@/services/businessApi'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'
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

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function ProductionAnalysisPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1

  const [loading, setLoading]           = useState(true)
  const [coreBal, setCoreBal]           = useState<number>(0)
  const [coatingBal, setCoatingBal]     = useState<number>(0)
  const [orders, setOrders]             = useState<OrderRow[]>([])
  const [totalFinalTesting, setTotalFinalTesting] = useState<number>(0)
  const [extractions, setExtractions]   = useState<SiloExtraction[]>([])
  const [updatedAt, setUpdatedAt]       = useState<string>('')
  const [dateFrom, setDateFrom]         = useState<string>(todayStr())
  const [dateTo, setDateTo]             = useState<string>(todayStr())
  const [cementFilter, setCementFilter] = useState<'attention' | 'all'>('attention')

  async function load(from = dateFrom, to = dateTo) {
    setLoading(true)
    try {
      const [invRes, plannedRes, inProgressRes, stagesRes, extData] = await Promise.all([
        inventoryApi.getAllByOutlet(oid, undefined, 0, 1000),
        productionOrderApi.getAll({ status: 'PLANNED', size: 100 }),
        productionOrderApi.getAll({ status: 'IN_PROGRESS', size: 100 }),
        productionOrderApi.getAllStagesStock(),
        siloExtractionsApi.list(from, to),
      ])

      // Silo balances from inventory (paginated: res.data.data.content)
      const rawInv = invRes.data?.data
      const items: any[] = Array.isArray(rawInv) ? rawInv : (rawInv?.content ?? rawInv?.items ?? [])
      const core    = items.find((i: any) => i.product?.name === 'Silo CEMENT (CORE)'    || i.name === 'Silo CEMENT (CORE)')
      const coating = items.find((i: any) => i.product?.name === 'Silo CEMENT (COATING)' || i.name === 'Silo CEMENT (COATING)')
      const cBal = parseFloat(core?.quantityOnHand    ?? core?.quantity_on_hand    ?? 0)
      const oBal = parseFloat(coating?.quantityOnHand ?? coating?.quantity_on_hand ?? 0)
      setCoreBal(cBal)
      setCoatingBal(oBal)

      // Current WIP at Final Testing stage per pipeConfigId (same source as inventory stages dashboard)
      const producedMap: Record<number, number> = {}
      const stagesRows: any[] = stagesRes.data?.data ?? []
      let wipTotal = 0
      stagesRows.forEach((r: any) => {
        const configId = r.pipeConfigId ?? r.pipe_config_id
        const ft = r.finalTesting ?? r.final_testing ?? 0
        if (configId && ft > 0) producedMap[configId] = ft
        wipTotal += ft
      })
      setTotalFinalTesting(wipTotal)

      // Combine PLANNED + IN_PROGRESS orders
      const activeOrders: any[] = [
        ...(plannedRes.data?.data?.content    ?? plannedRes.data?.data    ?? []),
        ...(inProgressRes.data?.data?.content ?? inProgressRes.data?.data ?? []),
      ]

      // Fetch each pipe config individually (GetByID includes materials; GetAll does not)
      const uniqueConfigIds = [...new Set(activeOrders.map((o: any) => o.pipeConfigId ?? o.pipeConfig?.id).filter(Boolean))]
      const configDetails = await Promise.all(uniqueConfigIds.map(id => pipeConfigApi.getById(id)))
      const formulaMap: Record<number, { core: number; coating: number }> = {}
      configDetails.forEach((r: any) => {
        const c = r.data?.data
        if (!c) return
        const materials: any[] = c.materials ?? []
        const spinningM = materials.find((m: any) => m.materialProduct?.name === 'Silo CEMENT (CORE)')
        const coatingM  = materials.find((m: any) => m.materialProduct?.name === 'Silo CEMENT (COATING)')
        formulaMap[c.id] = {
          core:    parseFloat(spinningM?.quantityPerPipe ?? 0),
          coating: parseFloat(coatingM?.quantityPerPipe  ?? 0),
        }
      })

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

  const totalPlanned = orders.reduce((s, o) => s + o.plannedQty, 0)

  // Expected pipes = min(core / corePerPipe, coating / coatingPerPipe) per order — summed
  const totalExpectedCore = orders.reduce((s, o) => {
    if (o.corePerPipe <= 0) return s
    return s + Math.floor(coreBal / o.corePerPipe)
  }, 0)

  const totalExpectedCoating = orders.reduce((s, o) => {
    if (o.coatingPerPipe <= 0) return s
    return s + Math.floor(coatingBal / o.coatingPerPipe)
  }, 0)

  // Cement analysis — lifted up so it's available for banner + risk column
  const orderAnalysis = orders.map(o => {
    const rem             = Math.max(0, o.plannedQty - o.produced)
    const coreNeeded      = rem * o.corePerPipe
    const coatingNeeded   = rem * o.coatingPerPipe
    const coreConsumed    = o.produced * o.corePerPipe
    const coatingConsumed = o.produced * o.coatingPerPipe
    const coreGap         = coreBal    - coreNeeded
    const coatingGap      = coatingBal - coatingNeeded
    const atRisk          = (o.corePerPipe > 0 && coreGap < 0) || (o.coatingPerPipe > 0 && coatingGap < 0)
    const coreCoverage    = coreNeeded    > 0 ? Math.min(100, (coreBal    / coreNeeded)    * 100) : 100
    const coatingCoverage = coatingNeeded > 0 ? Math.min(100, (coatingBal / coatingNeeded) * 100) : 100
    return { ...o, rem, coreNeeded, coatingNeeded, coreConsumed, coatingConsumed, coreGap, coatingGap, atRisk, coreCoverage, coatingCoverage }
  })
  const atRiskCount        = orderAnalysis.filter(o => o.atRisk).length
  const totalCoreNeeded    = orderAnalysis.reduce((s, o) => s + o.coreNeeded, 0)
  const totalCoatingNeeded = orderAnalysis.reduce((s, o) => s + o.coatingNeeded, 0)
  const coreSurplus        = coreBal - totalCoreNeeded
  const coatingSurplus     = coatingBal - totalCoatingNeeded
  const riskMap            = Object.fromEntries(orderAnalysis.map(o => [o.id, o.atRisk]))

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div
        className="px-6 py-5"
        style={{ background: 'linear-gradient(160deg, #1e4d8c 0%, #2e6fc4 60%, #3a7fd4 100%)' }}
      >
        <div className="flex items-center justify-between gap-6">

          {/* Left: title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
              <Factory size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Production Analysis</h1>
              <p className="text-xs text-white/75 mt-0.5">Cement availability vs pipe production</p>
            </div>
          </div>

          {/* Center: silo values */}
          <div className="flex items-center justify-center gap-0 flex-1">
            {/* CORE */}
            <div className="text-center px-12">
              <p className="text-[11px] text-white font-semibold tracking-wide uppercase">
                Silo CEMENT (CORE) <span className="font-normal opacity-70">· Spinning</span>
              </p>
              {loading ? (
                <div className="h-10 w-36 bg-white/20 rounded mt-2 animate-pulse mx-auto" />
              ) : (
                <>
                  <p className="text-[38px] font-light text-white leading-tight tabular-nums mt-1">
                    {fmt(coreBal)} <span className="text-sm font-normal">kg</span>
                  </p>
                  <p className="text-xs text-white/80 tabular-nums mt-0.5">{(coreBal / 1000).toFixed(2)} MT</p>
                </>
              )}
            </div>

            {/* Thin vertical divider */}
            <div className="w-px h-16 bg-white/30" />

            {/* COATING */}
            <div className="text-center px-12">
              <p className="text-[11px] text-white font-semibold tracking-wide uppercase">
                Silo CEMENT (COATING) <span className="font-normal opacity-70">· Coating</span>
              </p>
              {loading ? (
                <div className="h-10 w-36 bg-white/20 rounded mt-2 animate-pulse mx-auto" />
              ) : (
                <>
                  <p className="text-[38px] font-light text-white leading-tight tabular-nums mt-1">
                    {fmt(coatingBal)} <span className="text-sm font-normal">kg</span>
                  </p>
                  <p className="text-xs text-white/80 tabular-nums mt-0.5">{(coatingBal / 1000).toFixed(2)} MT</p>
                </>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-3 shrink-0">
            <DateRangePicker
              fromDate={dateFrom}
              toDate={dateTo}
              variant="dark"
              onChange={(from, to) => {
                setDateFrom(from)
                setDateTo(to)
                load(from, to)
              }}
            />
            <button
              onClick={() => load()}
              disabled={loading}
              className="p-2 rounded-xl bg-white/15 border border-white/25 text-white hover:bg-white/25 disabled:opacity-50 transition-colors backdrop-blur-sm"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          </div>

        </div>
      </div>

      {/* Alert banner — shown when any order has cement shortage */}
      {!loading && atRiskCount > 0 && (
        <div className="mx-6 mt-5 flex items-start gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {atRiskCount} of {orders.length} order{orders.length !== 1 ? 's' : ''} exceed current cement stock
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {coreSurplus < 0 && coatingSurplus < 0
                ? 'Both core and coating cement need replenishment to complete all active orders.'
                : coreSurplus < 0
                ? 'Core cement (Spinning) needs replenishment to complete all active orders.'
                : 'Coating cement needs replenishment to complete all active orders.'}
            </p>
          </div>
        </div>
      )}

      <div className="px-6 py-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Planned',             value: totalPlanned,         sub: 'pipes across all active orders' },
            { label: 'In Final Testing',           value: totalFinalTesting,    sub: 'pipes currently at this stage'  },
            { label: 'Expected Pipes (Spinning)',  value: totalExpectedCore,    sub: 'from Silo Core cement'          },
            { label: 'Expected Pipes (Coating)',   value: totalExpectedCoating, sub: 'from Silo Coating cement'       },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-6 text-center" style={{ background: '#F4F4F6', boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-900 mb-2">{c.label}</p>
              {loading ? (
                <div className="h-9 w-24 rounded animate-pulse mx-auto" style={{ background: '#E4E4E8' }} />
              ) : (
                <p className="text-3xl font-light tabular-nums text-gray-800">{fmt(c.value)}</p>
              )}
              <p className="text-xs text-gray-400 mt-1.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <p className="text-sm font-bold text-gray-800">Production Orders</p>
            <p className="text-xs text-gray-500 mt-0.5">Active orders with cement requirement and expected output</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#EFF6FF', borderBottom: '1px solid #dbeafe' }}>
                  {[
                    { label: 'Pipe Type',      align: 'text-left'  },
                    { label: 'Status',         align: 'text-left'  },
                    { label: 'Cement',         align: 'text-left'  },
                    { label: 'Planned',        align: 'text-right' },
                    { label: 'Produced',       align: 'text-right' },
                    { label: 'Yet to Produce', align: 'text-right' },
                  ].map(({ label, align }) => (
                    <th key={label} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap ${align}`}>{label}</th>
                  ))}
                  <th className="px-4 py-3 text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">Expected Pipes</div>
                    <div className="text-[10px] font-normal normal-case tracking-normal text-gray-400 mt-0.5">from Silo Core cement</div>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">Expected Pipes</div>
                    <div className="text-[10px] font-normal normal-case tracking-normal text-gray-400 mt-0.5">from Silo Coating cement</div>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">Spinning kg/pipe</div>
                    <div className="text-[10px] font-normal normal-case tracking-normal text-gray-400 mt-0.5">Cement required per pipe</div>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">Coating kg/pipe</div>
                    <div className="text-[10px] font-normal normal-case tracking-normal text-gray-400 mt-0.5">Cement required per pipe</div>
                  </th>
                </tr>
              </thead>
              <tbody style={{ borderTop: 'none' }}>
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500 text-sm">
                    <Loader2 size={16} className="animate-spin inline mr-2" />Loading…
                  </td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500 text-sm">No active production orders</td></tr>
                ) : orders.map(o => {
                  const expCore    = o.corePerPipe    > 0 ? Math.floor(coreBal    / o.corePerPipe)    : null
                  const expCoating = o.coatingPerPipe > 0 ? Math.floor(coatingBal / o.coatingPerPipe) : null
                  const isCoreLimiting = expCore != null && expCoating != null && expCore <= expCoating
                  const isAtRisk = riskMap[o.id]
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: '1px solid #f5f5f5' }}>
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap text-left">{o.pipeType}</td>
                      <td className="px-4 py-3 text-left">{pill(o.status)}</td>
                      <td className="px-4 py-3 text-left">
                        {isAtRisk
                          ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap">
                              <AlertTriangle size={9} />Cement Short
                            </span>
                          : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
                              ✓ Sufficient
                            </span>
                        }
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">{fmt(o.plannedQty)}</td>
                      <td className="px-4 py-3 tabular-nums text-right">
                        {o.produced > 0
                          ? <span className="text-emerald-600 font-bold">{fmt(o.produced)}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-right">
                        {(() => { const rem = o.plannedQty - o.produced; return rem > 0 ? <span className="text-orange-600 font-semibold">{fmt(rem)}</span> : <span className="text-gray-400">0</span> })()}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">
                        {expCore != null ? <>
                          <div className="font-medium">{fmt(expCore)}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{fmt(expCore * o.corePerPipe)} kg cement required</div>
                        </> : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">
                        {expCoating != null ? <>
                          <div className="font-medium">{fmt(expCoating)}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{fmt(expCoating * o.coatingPerPipe)} kg cement required</div>
                        </> : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">{o.corePerPipe    > 0 ? <>{fmt(o.corePerPipe)}    <span className="text-gray-400 text-xs">kg</span></> : '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 text-right">{o.coatingPerPipe > 0 ? <>{fmt(o.coatingPerPipe)} <span className="text-gray-400 text-xs">kg</span></> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-gray-500" style={{ borderTop: '1px solid #f5f5f5' }}>
            Expected = available cement ÷ kg per pipe. Reaching the Limit = whichever cement (Spinning or Coating) runs out first. Produced = current WIP count at Final Testing stage.
          </p>
        </div>

        {/* Progress bars chart */}
        {!loading && orders.length > 0 && (
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}>
            <p className="text-sm font-bold text-gray-800 mb-1">Production Progress</p>
            <p className="text-xs text-gray-500 mb-5">Produced vs. planned per pipe type</p>
            <div className="space-y-4">
              {orders.map(o => {
                const pct = o.plannedQty > 0 ? Math.min(100, Math.round((o.produced / o.plannedQty) * 100)) : 0
                const rem = Math.max(0, o.plannedQty - o.produced)
                return (
                  <div key={o.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-800">{o.pipeType}</span>
                      <span className="text-xs tabular-nums text-gray-700">
                        <span className="font-bold text-emerald-600">{fmt(o.produced)}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="font-semibold text-gray-800">{fmt(o.plannedQty)}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="font-semibold text-orange-500">{fmt(rem)} remaining</span>
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : pct >= 60 ? '#3b82f6' : '#f97316' }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 text-right">{pct}% complete</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Grouped bar chart */}
        {!loading && orders.length > 0 && (
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}>
            <p className="text-sm font-bold text-gray-800 mb-1">Capacity vs. Plan</p>
            <p className="text-xs text-gray-500 mb-5">Planned, produced and cement-limited capacity per pipe type</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={orders.map(o => ({
                  name: o.pipeType,
                  Planned:          o.plannedQty,
                  Produced:         o.produced,
                  'Yet to Produce': Math.max(0, o.plannedQty - o.produced),
                  'Exp. (Core)':    o.corePerPipe    > 0 ? Math.floor(coreBal    / o.corePerPipe)    : 0,
                  'Exp. (Coating)': o.coatingPerPipe > 0 ? Math.floor(coatingBal / o.coatingPerPipe) : 0,
                }))}
                margin={{ top: 4, right: 16, left: 8, bottom: 80 }}
                barCategoryGap="30%"
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => fmt(v)} width={55} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 24 }} />
                <Bar dataKey="Planned"          fill="#d1d5db" radius={[3,3,0,0]} />
                <Bar dataKey="Produced"         fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="Yet to Produce"   fill="#f97316" radius={[3,3,0,0]} />
                <Bar dataKey="Exp. (Core)"      fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="Exp. (Coating)"   fill="#93c5fd" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Cement Sufficiency */}
        {!loading && orders.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#f8f7ff', boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: '1px solid #ede9ff' }}>
                <div>
                  <p className="text-sm font-bold text-gray-900">Cement Sufficiency</p>
                  <p className="text-xs text-gray-400 mt-0.5">Will available stock complete all active orders?</p>
                </div>
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                  {([
                    { key: 'attention', label: `Needs Attention · ${atRiskCount}` },
                    { key: 'all',       label: `All Orders · ${orderAnalysis.length}` },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setCementFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        cementFilter === tab.key
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Two aggregate tiles */}
              <div className="grid grid-cols-2 gap-4 px-6 py-5" style={{ borderBottom: '1px solid #ede9ff' }}>
                {[
                  { label: 'Core Cement', sub: 'Spinning', avail: coreBal,    needed: totalCoreNeeded,    surplus: coreSurplus,    accent: '#4f46e5', bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', track: '#c7d2fe' },
                  { label: 'Coating Cement', sub: 'Coating', avail: coatingBal, needed: totalCoatingNeeded, surplus: coatingSurplus, accent: '#7c3aed', bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', track: '#ddd6fe' },
                ].map(t => {
                  const ok  = t.surplus >= 0
                  const pct = t.needed > 0 ? Math.min(100, (t.avail / t.needed) * 100) : 100
                  return (
                    <div key={t.label} className="rounded-xl p-5" style={{ background: t.bg }}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full" style={{ background: t.accent }} />
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: t.accent }}>{t.label}</p>
                        <span className="text-xs text-gray-400 font-normal">· {t.sub}</span>
                      </div>
                      <div className="flex items-end gap-6 mb-4">
                        <div>
                          <p className="text-2xl font-semibold tabular-nums text-gray-900">{fmt(t.avail)}<span className="text-sm font-normal text-gray-500 ml-1">kg</span></p>
                          <p className="text-[10px] text-gray-500 mt-0.5">available in silo</p>
                        </div>
                        <div className="text-gray-400 pb-4">→</div>
                        <div>
                          <p className="text-xl font-medium tabular-nums text-gray-700">{fmt(t.needed)}<span className="text-sm font-normal text-gray-400 ml-1">kg</span></p>
                          <p className="text-[10px] text-gray-500 mt-0.5">required to finish</p>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden mb-2.5" style={{ background: t.track }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ok ? '#10b981' : '#ef4444' }} />
                      </div>
                      <p className={`text-sm font-bold tabular-nums ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
                        {ok ? `+${fmt(t.surplus)} kg surplus` : `${fmt(Math.abs(t.surplus))} kg short`}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Per-order table */}
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#ede9ff', borderBottom: '1px solid #ddd6fe' }}>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Pipe Type</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Core Used</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Core Needed</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Coating Used</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Coating Needed</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderAnalysis
                    .filter(o => cementFilter === 'all' || o.atRisk)
                    .map(o => (
                    <tr key={o.id} className="transition-colors" style={{ borderTop: '1px solid #ede9ff' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f3ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td className="px-6 py-3.5 font-semibold text-gray-900">{o.pipeType}</td>
                      <td className="px-4 py-3.5 tabular-nums text-gray-600 text-right">{fmt(o.coreConsumed)} kg</td>
                      <td className={`px-4 py-3.5 tabular-nums text-right font-medium ${o.coreGap < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmt(o.coreNeeded)} kg</td>
                      <td className="px-4 py-3.5 tabular-nums text-gray-600 text-right">{fmt(o.coatingConsumed)} kg</td>
                      <td className={`px-4 py-3.5 tabular-nums text-right font-medium ${o.coatingGap < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmt(o.coatingNeeded)} kg</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${o.atRisk ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {o.atRisk ? '⚠ At Risk' : '✓ OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}

        {/* Silo extractions */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <FlaskConical size={15} className="text-gray-500" />
            <div>
              <p className="text-sm font-bold text-gray-800">Silo Extractions</p>
              <p className="text-xs text-gray-500 mt-0.5">Cement removed from silos outside of production</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                {['Date','Silo','Quantity (kg)','Notes'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
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
                  <tr key={`${e.id}-${v.silo}`} className="hover:bg-gray-50" style={{ borderTop: '1px solid #f5f5f5' }}>
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
