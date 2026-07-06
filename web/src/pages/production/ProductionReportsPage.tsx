import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Package, Layers, Download, Calendar, TrendingUp, ChevronDown, Hammer, UserCheck, BarChart2 } from 'lucide-react'
import { subDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { productionReportApi, pipeConfigApi, productApi } from '@/services/api'
import { processContractorApi, type ProcessContractorAssignment } from '@/services/businessApi'
import { PROD_STAGES } from '@/types'

// ── date helpers ───────────────────────────────────────────────────────────────

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }

function startOf(unit: 'week' | 'month' | 'year') {
  const r = new Date()
  if (unit === 'week')  { r.setDate(r.getDate() - r.getDay()); }
  else if (unit === 'month') r.setDate(1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfLastMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); return d
}
function endOfLastMonth() {
  const d = new Date(); d.setDate(0); d.setHours(0,0,0,0); return d
}

const PRESETS = [
  { label: 'Today',        from: () => fmtDate(new Date()),               to: () => fmtDate(new Date()) },
  { label: 'Yesterday',    from: () => fmtDate(subDays(new Date(), 1)),   to: () => fmtDate(subDays(new Date(), 1)) },
  { label: 'Last 7 Days',  from: () => fmtDate(subDays(new Date(), 6)),   to: () => fmtDate(new Date()) },
  { label: 'Last 15 Days', from: () => fmtDate(subDays(new Date(), 14)),  to: () => fmtDate(new Date()) },
  { label: 'Last 30 Days', from: () => fmtDate(subDays(new Date(), 29)),  to: () => fmtDate(new Date()) },
  { label: 'This Week',    from: () => fmtDate(startOf('week')),          to: () => fmtDate(new Date()) },
  { label: 'This Month',   from: () => fmtDate(startOf('month')),         to: () => fmtDate(new Date()) },
  { label: 'Last Month',   from: () => fmtDate(startOfLastMonth()),       to: () => fmtDate(endOfLastMonth()) },
  { label: 'This Year',    from: () => fmtDate(startOf('year')),          to: () => fmtDate(new Date()) },
]

function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// ── Date filter dropdown ───────────────────────────────────────────────────────

function DateFilterDropdown({ from, to, onChange }: {
  from: string; to: string; onChange: (f: string, t: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo,   setTmpTo]   = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const activePreset = PRESETS.find(p => from === p.from() && to === p.to())
  const isCustom     = !activePreset && !!(from || to)

  function applyPreset(p: typeof PRESETS[number]) { onChange(p.from(), p.to()); setOpen(false) }
  function applyCustom() { if (tmpFrom && tmpTo) { onChange(tmpFrom, tmpTo); setOpen(false) } }
  function clearAll() { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }

  const label = activePreset ? activePreset.label
    : isCustom ? `${dmy(from)} – ${dmy(to)}` : 'All dates'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setTmpFrom(from); setTmpTo(to); setOpen(v => !v) }}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/40"
      >
        <Calendar size={15} />
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-60">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Quick Range</p>
          <div className="space-y-0.5 mb-3">
            {PRESETS.map(p => {
              const active = from === p.from() && to === p.to()
              return (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors font-medium ${
                    active ? 'bg-violet-50 text-violet-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Custom Range</p>
            <div className="space-y-2">
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700" />
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700" />
              <div className="flex gap-2">
                <button onClick={clearAll}
                  className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Clear
                </button>
                <button onClick={applyCustom} disabled={!tmpFrom || !tmpTo}
                  className="flex-1 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function LoadingTable() {
  return (
    <div className="space-y-2 mt-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  )
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number | string | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(n: number | string | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  PROD_STAGES.map(s => [s.key, s.label])
)

// ── Dummy data generators ──────────────────────────────────────────────────────

const STAGE_SEQUENCE = ['FABRICATION', 'MOULDING', 'SPINNING', 'FINAL_TESTING']
const MAT_STAGES     = ['FABRICATION', 'SPINNING', 'WINDING', 'COATING']

// Real raw material names used in pipe production
const RAW_MATERIALS: { name: string; uom: string; baseRate: number }[] = [
  { name: '1.6 MM Sheet 350',  uom: 'kg',  baseRate: 72  },
  { name: '1.6 MM Sheet 400',  uom: 'kg',  baseRate: 72  },
  { name: '1.6 MM Sheet 450',  uom: 'kg',  baseRate: 73  },
  { name: '1.6 MM Sheet 500',  uom: 'kg',  baseRate: 73  },
  { name: '1.6 MM Sheet 600',  uom: 'kg',  baseRate: 74  },
  { name: '1.6 MM Sheet 700',  uom: 'kg',  baseRate: 74  },
  { name: '1.6 MM Sheet 800',  uom: 'kg',  baseRate: 75  },
  { name: '1.6 MM Sheet 900',  uom: 'kg',  baseRate: 75  },
  { name: '1.6 MM Sheet 1000', uom: 'kg',  baseRate: 76  },
  { name: '1.6 MM Sheet 1100', uom: 'kg',  baseRate: 76  },
  { name: '1.6 MM Sheet 1200', uom: 'kg',  baseRate: 77  },
  { name: '1.6 MM Sheet 1300', uom: 'kg',  baseRate: 77  },
  { name: '1.6 MM Sheet 1400', uom: 'kg',  baseRate: 78  },
  { name: '1.6 MM Sheet 1500', uom: 'kg',  baseRate: 78  },
  { name: '1.6 MM Sheet 1600', uom: 'kg',  baseRate: 79  },
  { name: '1.6 MM Sheet 1700', uom: 'kg',  baseRate: 79  },
  { name: '1.6 MM Sheet 1800', uom: 'kg',  baseRate: 80  },
  { name: 'MS Flat 6 MM',      uom: 'kg',  baseRate: 65  },
  { name: 'MS Flat 8 MM',      uom: 'kg',  baseRate: 66  },
  { name: 'MS Flat 10 MM',     uom: 'kg',  baseRate: 67  },
  { name: '20 MM Metal',       uom: 'MT',  baseRate: 1400 },
  { name: '10 MM Metal',       uom: 'MT',  baseRate: 1350 },
  { name: 'Crushed Sand',      uom: 'MT',  baseRate: 620  },
  { name: 'Dust',              uom: 'MT',  baseRate: 480  },
  { name: 'Silo Cement',       uom: 'bag', baseRate: 380  },
  { name: 'Extra Cement',      uom: 'bag', baseRate: 390  },
  { name: 'Chemical',          uom: 'ltr', baseRate: 210  },
  { name: '4 MM Winding Wire', uom: 'kg',  baseRate: 95   },
  { name: 'Loose Cement',      uom: 'bag', baseRate: 370  },
  { name: 'Plaster Sand',      uom: 'MT',  baseRate: 540  },
]

function pipeName(cfg: any) {
  return cfg.name || `${cfg.diameterMm}mm ${cfg.pressureClass}`
}

function makeStageDummy(configs: any[]) {
  const rows: any[] = []
  configs.slice(0, 4).forEach((cfg, ci) => {
    const poNumber  = `PO-2025-${String(ci + 1).padStart(3, '0')}`
    const pipe      = pipeName(cfg)
    let prev        = 150 + ci * 30
    STAGE_SEQUENCE.forEach((stage, si) => {
      const rejected  = (ci + si) % 3 === 0 ? 0 : (ci + si) % 3 === 1 ? 1 : 2
      const completed = prev - rejected
      rows.push({ poNumber, pipeConfig: pipe, stageType: stage,
        pipesProcessed: prev, pipesCompleted: completed,
        pipesRejected: rejected, entryCount: 4 + ci })
      prev = completed
    })
  })
  return rows
}

function makeCostDummy(configs: any[]) {
  return configs.slice(0, 4).map((cfg, ci) => {
    const pipe      = pipeName(cfg)
    const planned   = 150 + ci * 30
    const completed = Math.round(planned * (0.85 + ci * 0.03))
    const matCost   = completed * (850 + ci * 200)
    const macCost   = completed * (160 + ci * 40)
    const ovhCost   = completed * (90  + ci * 20)
    const total     = matCost + macCost + ovhCost
    return {
      poNumber: `PO-2025-${String(ci + 1).padStart(3, '0')}`,
      pipeConfig: pipe,
      status: ci === 0 ? 'COMPLETED' : ci === 1 ? 'COMPLETED' : 'IN_PROGRESS',
      plannedQty: planned, finalCompleted: completed,
      materialCost: matCost, machineCost: macCost, overheadCost: ovhCost,
      totalCost: total, costPerPipe: total / completed,
    }
  })
}

function makeMaterialDummy(_products?: any[]) {
  return RAW_MATERIALS.map((mat, mi) => {
    const stage = MAT_STAGES[mi % MAT_STAGES.length]
    const qty   = Math.round(40 + mi * 15 + (mi % 3) * 22)
    return {
      materialName: mat.name,
      stageType:    stage,
      totalQty:     qty,
      uom:          mat.uom,
      totalCost:    qty * mat.baseRate,
      entryCount:   3 + (mi % 5),
    }
  })
}

// ── Tab 1: Stage Summary ──────────────────────────────────────────────────────

function StageSummaryTab({ from, to }: { from: string; to: string }) {
  const [showChart, setShowChart] = useState(false)
  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ['prod-report-stage', from, to],
    queryFn: () => productionReportApi.stageSummary({
      fromDate: from || undefined,
      toDate:   to   || undefined,
    }).then(r => r.data.data as any[]),
  })

  const { data: configs, isLoading: cfgLoading } = useQuery({
    queryKey: ['pipe-configs-report'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 20 }).then(r => r.data.data?.content ?? []),
  })

  const isLoading = apiLoading || cfgLoading
  const rows = useMemo(() => {
    if (apiData && apiData.length > 0) return apiData
    if (!configs || configs.length === 0) return []
    return makeStageDummy(configs)
  }, [apiData, configs])

  const byOrder = rows.reduce<Record<string, { poNumber: string; pipeConfig: string; stages: any[] }>>((acc, r) => {
    if (!acc[r.poNumber]) acc[r.poNumber] = { poNumber: r.poNumber, pipeConfig: r.pipeConfig, stages: [] }
    acc[r.poNumber].stages.push(r)
    return acc
  }, {})

  // Chart data: one bar per production order showing completed vs rejected across all stages
  const chartData = useMemo(() => {
    const map: Record<string, { order: string; completed: number; rejected: number }> = {}
    rows.forEach((r: any) => {
      if (!map[r.poNumber]) map[r.poNumber] = { order: r.poNumber, completed: 0, rejected: 0 }
      map[r.poNumber].completed += Number(r.pipesCompleted)
      map[r.poNumber].rejected  += Number(r.pipesRejected)
    })
    return Object.values(map)
  }, [rows])

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setShowChart(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
            <BarChart2 size={13} />{showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
        </div>
      )}
      {showChart && chartData.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Completed vs Rejected by Production Order</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="order" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <RTooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="rejected"  name="Rejected"  fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {isLoading ? <LoadingTable /> : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No data for selected range</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Order / Pipe</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-right">Processed</th>
                <th className="px-4 py-3 text-right">Completed</th>
                <th className="px-4 py-3 text-right">Rejected</th>
                <th className="px-4 py-3 text-right">Yield %</th>
                <th className="px-4 py-3 text-right">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.values(byOrder).map(order =>
                order.stages.map((s, i) => {
                  const yieldPct = s.pipesProcessed > 0
                    ? ((s.pipesCompleted / s.pipesProcessed) * 100).toFixed(1) : '—'
                  return (
                    <tr key={`${order.poNumber}-${s.stageType}`} className="hover:bg-violet-50/40">
                      {i === 0 && (
                        <td className="px-4 py-3 font-medium text-gray-900" rowSpan={order.stages.length}>
                          <p className="font-mono text-xs text-violet-700">{order.poNumber}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{order.pipeConfig}</p>
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-700">{STAGE_LABEL[s.stageType] ?? s.stageType}</td>
                      <td className="px-4 py-3 text-right">{s.pipesProcessed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">{s.pipesCompleted.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-600">{s.pipesRejected > 0 ? s.pipesRejected : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${Number(yieldPct) >= 95 ? 'text-green-600' : Number(yieldPct) >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {yieldPct}{yieldPct !== '—' ? '%' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{s.entryCount}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Cost Summary ───────────────────────────────────────────────────────

function CostSummaryTab({ from, to }: { from: string; to: string }) {
  const [showChart, setShowChart] = useState(false)
  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ['prod-report-cost', from, to],
    queryFn: () => productionReportApi.costSummary({
      fromDate: from || undefined,
      toDate:   to   || undefined,
    }).then(r => r.data.data as any[]),
  })

  const { data: configs, isLoading: cfgLoading } = useQuery({
    queryKey: ['pipe-configs-report'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 20 }).then(r => r.data.data?.content ?? []),
  })

  const isLoading = apiLoading || cfgLoading
  const rows = useMemo(() => {
    if (apiData && apiData.length > 0) return apiData
    if (!configs || configs.length === 0) return []
    return makeCostDummy(configs)
  }, [apiData, configs])

  const totalMaterial = rows.reduce((s: number, r: any) => s + Number(r.materialCost), 0)
  const totalOverhead = rows.reduce((s: number, r: any) => s + Number(r.overheadCost), 0)
  const totalAll      = rows.reduce((s: number, r: any) => s + Number(r.totalCost), 0)

  const STATUS_COLORS: Record<string, string> = {
    DRAFT:       'bg-gray-100 text-gray-600',
    PLANNED:     'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
    COMPLETED:   'bg-green-100 text-green-700',
    CANCELLED:   'bg-red-100 text-red-600',
  }

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setShowChart(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
            <BarChart2 size={13} />{showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
        </div>
      )}
      {showChart && rows.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Cost Breakdown by Pipe Config (₹)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows.map((r: any) => ({
              name: r.pipeConfig?.length > 20 ? r.pipeConfig.slice(0, 20) + '…' : r.pipeConfig,
              Material: Math.round(Number(r.materialCost)),
              Overhead: Math.round(Number(r.overheadCost)),
            }))} margin={{ top: 4, right: 16, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <RTooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Material" fill="#8b5cf6" radius={[3,3,0,0]} />
              <Bar dataKey="Overhead" fill="#c4b5fd" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {isLoading ? <LoadingTable /> : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No data for selected range</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Material Cost', value: totalMaterial },
              { label: 'Overhead',      value: totalOverhead },
              { label: 'Total Cost',    value: totalAll      },
            ].map(c => (
              <div key={c.label} className="bg-white border rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">₹{fmt(c.value)}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Pipe Config</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Planned</th>
                  <th className="px-4 py-3 text-right">Completed</th>
                  <th className="px-4 py-3 text-right">Material ₹</th>
                  <th className="px-4 py-3 text-right">Overhead ₹</th>
                  <th className="px-4 py-3 text-right">Total ₹</th>
                  <th className="px-4 py-3 text-right">₹/Pipe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r: any) => (
                  <tr key={r.poNumber} className="hover:bg-violet-50/40">
                    <td className="px-4 py-3 font-mono text-xs text-violet-700">{r.poNumber}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{r.pipeConfig}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{r.plannedQty}</td>
                    <td className="px-4 py-3 text-right text-green-700">{r.finalCompleted}</td>
                    <td className="px-4 py-3 text-right">₹{fmt(r.materialCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">—</td>
                    <td className="px-4 py-3 text-right font-medium">₹{fmt(r.totalCost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-violet-700">₹{fmt(r.costPerPipe)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-medium text-sm">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-gray-600">Totals</td>
                  <td className="px-4 py-3 text-right">₹{fmt(totalMaterial)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">—</td>
                  <td className="px-4 py-3 text-right">₹{fmt(totalAll)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab 3: Material Consumption ───────────────────────────────────────────────

function MaterialConsumptionTab({ from, to }: { from: string; to: string }) {
  const [showChart, setShowChart] = useState(false)
  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ['prod-report-material', from, to],
    queryFn: () => productionReportApi.materialConsumption({
      fromDate: from || undefined,
      toDate:   to   || undefined,
    }).then(r => r.data.data as any[]),
  })

  const { data: products, isLoading: prodLoading } = useQuery({
    queryKey: ['products-for-report'],
    queryFn: () => productApi.getAll({ page: 0, size: 50 }).then(r => r.data.data?.content ?? []),
  })

  const isLoading = apiLoading || prodLoading
  const rows = useMemo(() => {
    if (apiData && apiData.length > 0) return apiData
    return makeMaterialDummy()
  }, [apiData, products])

  const totalCost = rows.reduce((s: number, r: any) => s + Number(r.totalCost), 0)

  const top10 = useMemo(() =>
    [...rows].sort((a: any, b: any) => Number(b.totalCost) - Number(a.totalCost)).slice(0, 10)
  , [rows])

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setShowChart(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
            <BarChart2 size={13} />{showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
        </div>
      )}
      {showChart && top10.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Top 10 Materials by Cost (₹)</p>
          <ResponsiveContainer width="100%" height={Math.max(180, top10.length * 32)}>
            <BarChart layout="vertical"
              data={top10.map((r: any) => ({
                name: r.materialName?.length > 22 ? r.materialName.slice(0, 22) + '…' : r.materialName,
                cost: Math.round(Number(r.totalCost)),
              }))}
              margin={{ top: 4, right: 40, left: 140, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={135} />
              <RTooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Cost']} />
              <Bar dataKey="cost" name="Total Cost" fill="#10b981" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {isLoading ? <LoadingTable /> : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No data for selected range</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Material</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-right">Qty Consumed</th>
                <th className="px-4 py-3 text-left">UOM</th>
                <th className="px-4 py-3 text-right">Total Cost ₹</th>
                <th className="px-4 py-3 text-right">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-violet-50/40">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.materialName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{STAGE_LABEL[r.stageType] ?? r.stageType}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtQty(r.totalQty)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.uom}</td>
                  <td className="px-4 py-3 text-right">₹{fmt(r.totalCost)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.entryCount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-gray-600">Total</td>
                <td className="px-4 py-3 text-right">₹{fmt(totalCost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab 4: Contractor Costs ───────────────────────────────────────────────────

const BED_LABEL: Record<string, string> = {
  SMALL_BED:       'Small Bed',
  LARGE_BED:       'Large Bed',
  EXTRA_LARGE_BED: 'Extra Large Bed',
  UNKNOWN:         'Unknown',
}

type ProcessFilter = 'all' | 'FABRICATION' | 'SPINNING' | 'COATING'

interface ContractorCostsTabProps {
  from: string
  to: string
  processFilter: ProcessFilter
  contractorFilter: number | 'all'
  contractorOptions: { supplierId: number; name: string; process: string }[]
  assignmentByProcess: Record<string, ProcessContractorAssignment>
}

function ContractorCostsTab({ from, to, processFilter, contractorFilter, contractorOptions, assignmentByProcess }: ContractorCostsTabProps) {
  const params = { fromDate: from || undefined, toDate: to || undefined }

  const { data, isLoading }      = useQuery({
    queryKey: ['prod-report-contractor', from, to],
    queryFn: () => productionReportApi.contractorCosts(params).then(r => r.data.data as any[]),
  })
  const { data: spinData, isLoading: spinLoading } = useQuery({
    queryKey: ['prod-report-spinning', from, to],
    queryFn: () => productionReportApi.spinningCosts(params).then(r => r.data.data as any[]),
  })

  const rows     = data     ?? []
  const spinRows = spinData ?? []
  const fabRows  = rows.filter((r: any) => Number(r.fabPipesCompleted)  > 0)
  const coatRows = rows.filter((r: any) => Number(r.coatPipesCompleted) > 0)
  const totalFab  = fabRows.reduce((s: number,  r: any) => s + Number(r.fabCost),  0)
  const totalCoat = coatRows.reduce((s: number, r: any) => s + Number(r.coatCost), 0)
  const totalSpin = spinRows.reduce((s: number, r: any) => s + Number(r.spinCost), 0)

  // When contractor filter is set, resolve which processes that contractor covers
  function processMatchesContractor(proc: string) {
    if (contractorFilter === 'all') return true
    const a = assignmentByProcess[proc] as ProcessContractorAssignment | undefined
    return a?.supplierId === contractorFilter
  }

  const showFab  = (processFilter === 'all' || processFilter === 'FABRICATION') && processMatchesContractor('FABRICATION')
  const showSpin = (processFilter === 'all' || processFilter === 'SPINNING')    && processMatchesContractor('SPINNING')
  const showCoat = (processFilter === 'all' || processFilter === 'COATING')     && processMatchesContractor('COATING')

  const visibleTotal =
    (showFab  ? totalFab  : 0) +
    (showSpin ? totalSpin : 0) +
    (showCoat ? totalCoat : 0)

  if (isLoading || spinLoading) return <LoadingTable />
  if (rows.length === 0 && spinRows.length === 0) return <div className="text-center py-12 text-gray-400">No data for selected range</div>

  return (
    <div className="space-y-8">

      {/* ── Fabrication ──────────────────────────────────────────── */}
      {showFab && <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-5 rounded-full bg-blue-500" />
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Fabrication Contractor</h3>
          <span className="ml-auto text-xs text-gray-400 font-medium">Rate: ₹/kg of steel</span>
        </div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-xs text-blue-800 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">PO Number</th>
                <th className="px-4 py-3 text-left">Pipe Config</th>
                <th className="px-4 py-3 text-right">Dia (mm)</th>
                <th className="px-4 py-3 text-right">Pipes Fabricated</th>
                <th className="px-4 py-3 text-right">Kg / Pipe</th>
                <th className="px-4 py-3 text-right">Rate (₹/kg)</th>
                <th className="px-4 py-3 text-right font-bold">Amount ₹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fabRows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-xs">No fabrication entries</td></tr>
              ) : fabRows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-mono text-xs text-violet-700">{r.poNumber}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{r.pipeConfig}</td>
                  <td className="px-4 py-3 text-right">{r.diameterMm}</td>
                  <td className="px-4 py-3 text-right">{r.fabPipesCompleted}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(r.fabKgPerPipe)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">₹{fmt(r.fabRateKg)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">₹{fmt(r.fabCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-blue-50/60 font-semibold text-sm">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right text-gray-600">Total Fabrication Cost</td>
                <td className="px-4 py-3 text-right text-blue-700">₹{fmt(totalFab)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>}

      {/* ── Coating ───────────────────────────────────────────────── */}
      {showCoat && <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-5 rounded-full bg-blue-500" />
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Coating Contractor</h3>
          <span className="ml-auto text-xs text-gray-400 font-medium">Rate: ₹/pipe by diameter</span>
        </div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-xs text-blue-800 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">PO Number</th>
                <th className="px-4 py-3 text-left">Pipe Config</th>
                <th className="px-4 py-3 text-right">Dia (mm)</th>
                <th className="px-4 py-3 text-right">Pipes Coated</th>
                <th className="px-4 py-3 text-right">Rate (₹/pipe)</th>
                <th className="px-4 py-3 text-right font-bold">Amount ₹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coatRows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-xs">No coating entries</td></tr>
              ) : coatRows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-mono text-xs text-violet-700">{r.poNumber}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{r.pipeConfig}</td>
                  <td className="px-4 py-3 text-right">{r.diameterMm}</td>
                  <td className="px-4 py-3 text-right">{r.coatPipesCompleted}</td>
                  <td className="px-4 py-3 text-right text-gray-500">₹{fmt(r.coatRatePerPipe)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">₹{fmt(r.coatCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-blue-50/60 font-semibold text-sm">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-gray-600">Total Coating Cost</td>
                <td className="px-4 py-3 text-right text-blue-700">₹{fmt(totalCoat)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>}

      {/* ── Spinning ──────────────────────────────────────────────── */}
      {showSpin && <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-5 rounded-full bg-violet-500" />
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Spinning Contractor</h3>
          <span className="ml-auto text-xs text-gray-400 font-medium">Rate: ₹/pipe by diameter × bed size</span>
        </div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-violet-50 text-xs text-violet-800 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">PO Number</th>
                <th className="px-4 py-3 text-left">Pipe Config</th>
                <th className="px-4 py-3 text-right">Dia (mm)</th>
                <th className="px-4 py-3 text-left">Bed Size</th>
                <th className="px-4 py-3 text-right">Pipes Spun</th>
                <th className="px-4 py-3 text-right">Rate (₹/pipe)</th>
                <th className="px-4 py-3 text-right font-bold">Amount ₹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {spinRows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-xs">No spinning entries</td></tr>
              ) : spinRows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-violet-50/40">
                  <td className="px-4 py-3 font-mono text-xs text-violet-700">{r.poNumber}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{r.pipeConfig}</td>
                  <td className="px-4 py-3 text-right">{r.diameterMm}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.bedSize === 'SMALL_BED'       ? 'bg-amber-100 text-amber-700' :
                      r.bedSize === 'LARGE_BED'       ? 'bg-blue-100 text-blue-700' :
                      r.bedSize === 'EXTRA_LARGE_BED' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {BED_LABEL[r.bedSize] ?? r.bedSize}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{r.spinPipesCompleted}</td>
                  <td className="px-4 py-3 text-right text-gray-500">₹{fmt(r.ratePerPipe)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-violet-700">₹{fmt(r.spinCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-violet-50/60 font-semibold text-sm">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right text-gray-600">Total Spinning Cost</td>
                <td className="px-4 py-3 text-right text-violet-700">₹{fmt(totalSpin)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>}

      {/* ── Grand Total ───────────────────────────────────────────── */}
      <div className="flex justify-end">
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-2xl px-8 py-4 flex items-center gap-8">
          {showFab && <>
            <div className="text-center">
              <p className="text-xs text-blue-200 uppercase tracking-widest">Fabrication</p>
              <p className="text-lg font-bold tabular-nums">₹{fmt(totalFab)}</p>
            </div>
            {(showSpin || showCoat) && <div className="w-px h-8 bg-white/20" />}
          </>}
          {showSpin && <>
            <div className="text-center">
              <p className="text-xs text-white/80 uppercase tracking-widest">Spinning</p>
              <p className="text-lg font-bold tabular-nums">₹{fmt(totalSpin)}</p>
            </div>
            {showCoat && <div className="w-px h-8 bg-white/20" />}
          </>}
          {showCoat && <>
            <div className="text-center">
              <p className="text-xs text-blue-200 uppercase tracking-widest">Coating</p>
              <p className="text-lg font-bold tabular-nums">₹{fmt(totalCoat)}</p>
            </div>
          </>}
          {(showFab || showSpin || showCoat) && <div className="w-px h-8 bg-white/20" />}
          <div className="text-center">
            <p className="text-xs text-white/70 uppercase tracking-widest">
              {processFilter === 'all' && contractorFilter === 'all' ? 'Grand Total' : 'Total'}
            </p>
            <p className="text-2xl font-extrabold tabular-nums">₹{fmt(visibleTotal)}</p>
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'stage',      label: 'Stage Summary',     icon: Layers },
  { key: 'cost',       label: 'Cost Report',       icon: BarChart3 },
  { key: 'material',   label: 'Material Usage',    icon: Package },
  { key: 'contractor', label: 'Contractor Costs',  icon: Hammer },
] as const

type TabKey = typeof TABS[number]['key']

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  stage:      'Production throughput and yield rate by stage for each order',
  cost:       'Full cost breakdown per production order — material, machine and overhead',
  material:   'Total material quantities consumed and their cost by stage',
  contractor: 'Fabrication and coating contractor payments per production order',
}

export default function ProductionReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as TabKey | null
  const activeTab = (tabParam && TABS.some(t => t.key === tabParam)) ? tabParam : 'stage'

  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')
  const [processFilter,    setProcessFilter]    = useState<ProcessFilter>('all')
  const [contractorFilter, setContractorFilter] = useState<number | 'all'>('all')

  const { data: assignments = [] } = useQuery({
    queryKey: ['process-contractors'],
    queryFn:  processContractorApi.list,
  })

  const assignmentByProcess = Object.fromEntries(
    assignments.map((a: ProcessContractorAssignment) => [a.processType, a])
  )
  const contractorOptions = assignments.map((a: ProcessContractorAssignment) => ({
    supplierId: a.supplierId,
    name:       a.supplier?.name ?? `Vendor #${a.supplierId}`,
    process:    a.processType,
  }))

  function setActiveTab(key: TabKey) {
    setSearchParams(prev => { prev.set('tab', key); return prev }, { replace: true })
  }

  const activeTabMeta = TABS.find(t => t.key === activeTab)!

  return (
    <div className="p-6 space-y-6">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.28)]">
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Title row */}
        <div className="relative flex items-center px-8 pt-6 pb-4">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <TrendingUp size={26} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Production</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Production Reports</h1>
              <p className="text-sm text-blue-200 mt-0.5">Stage performance · Cost breakdown · Material usage</p>
            </div>
          </div>
        </div>

        {/* Tab pills + filters row */}
        <div className="relative px-8 pb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 bg-white/10 backdrop-blur-sm p-1 rounded-xl">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    active ? 'bg-white text-violet-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Process + Contractor dropdowns — only on contractor tab */}
            {activeTab === 'contractor' && <>
              <div className="relative">
                <select
                  value={processFilter}
                  onChange={e => { setProcessFilter(e.target.value as ProcessFilter); setContractorFilter('all') }}
                  className="appearance-none bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 pr-8 text-sm font-bold focus:outline-none hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <option value="all" className="text-gray-800 bg-white">All Processes</option>
                  <option value="FABRICATION" className="text-gray-800 bg-white">Fabrication</option>
                  <option value="SPINNING"    className="text-gray-800 bg-white">Spinning</option>
                  <option value="COATING"     className="text-gray-800 bg-white">Coating</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70" />
              </div>

              <div className="relative">
                <select
                  value={contractorFilter === 'all' ? 'all' : String(contractorFilter)}
                  onChange={e => {
                    const v = e.target.value
                    setContractorFilter(v === 'all' ? 'all' : Number(v))
                    if (v !== 'all') {
                      const found = contractorOptions.find(o => o.supplierId === Number(v))
                      if (found) setProcessFilter(found.process as ProcessFilter)
                    } else {
                      setProcessFilter('all')
                    }
                  }}
                  className="appearance-none bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 pr-8 text-sm font-bold focus:outline-none hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <option value="all" className="text-gray-800 bg-white">All Contractors</option>
                  {contractorOptions.map(o => (
                    <option key={o.supplierId} value={o.supplierId} className="text-gray-800 bg-white">
                      {o.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70" />
              </div>

              <div className="w-px h-5 bg-white/20" />
            </>}

            <DateFilterDropdown from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all active:scale-95">
              <Download size={15} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Active tab content card ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <div className="flex items-center gap-3.5 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <activeTabMeta.icon size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{activeTabMeta.label}</h2>
            <p className="text-xs text-blue-100 mt-0.5">{TAB_DESCRIPTIONS[activeTab]}</p>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'stage'      && <StageSummaryTab        from={from} to={to} />}
          {activeTab === 'cost'       && <CostSummaryTab         from={from} to={to} />}
          {activeTab === 'material'   && <MaterialConsumptionTab from={from} to={to} />}
          {activeTab === 'contractor' && <ContractorCostsTab
            from={from} to={to}
            processFilter={processFilter}
            contractorFilter={contractorFilter}
            contractorOptions={contractorOptions}
            assignmentByProcess={assignmentByProcess}
          />}
        </div>
      </div>

    </div>
  )
}
