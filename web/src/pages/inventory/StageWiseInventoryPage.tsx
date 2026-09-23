import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/services/api'
import { Layers, Loader2, Calendar, ChevronDown, X } from 'lucide-react'

// ── Stage definitions (in production order) ──────────────────────────────────
const STAGES = [
  { key: 'FABRICATION',         label: 'Fabrication' },
  { key: 'FABRICATION_TESTING', label: 'Fab. Testing' },
  { key: 'MOULDING',            label: 'Moulding' },
  { key: 'SPINNING',            label: 'Spinning' },
  { key: 'DEMOULDING',          label: 'Demoulding' },
  { key: 'CURING_1',            label: 'Curing 1' },
  { key: 'WINDING',             label: 'Winding' },
  { key: 'COATING',             label: 'Coating' },
  { key: 'WINDING_2',           label: 'Winding 2' },
  { key: 'COATING_2',           label: 'Coating 2' },
  { key: 'CURING_2',            label: 'Curing 2' },
  { key: 'FINAL_TESTING',       label: 'Final Testing' },
]

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoDate(d: Date) { return d.toISOString().split('T')[0] }
function nAgo(n: number)  { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d) }
function startOf(unit: 'month' | 'quarter' | 'year') {
  const r = new Date()
  if      (unit === 'month')   r.setDate(1)
  else if (unit === 'quarter') r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1)
  else                         r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}

const PRESETS = [
  { label: 'Today',        from: () => isoDate(new Date()),         to: () => isoDate(new Date()) },
  { label: 'Last 7d',      from: () => nAgo(6),                     to: () => isoDate(new Date()) },
  { label: 'Last 30d',     from: () => nAgo(29),                    to: () => isoDate(new Date()) },
  { label: 'This Month',   from: () => isoDate(startOf('month')),   to: () => isoDate(new Date()) },
  { label: 'This Quarter', from: () => isoDate(startOf('quarter')), to: () => isoDate(new Date()) },
  { label: 'This Year',    from: () => isoDate(startOf('year')),    to: () => isoDate(new Date()) },
  { label: 'All Time',     from: () => '',                          to: () => '' },
]

function DateRangePicker({ fromDate, toDate, onChange }: {
  fromDate: string; toDate: string; onChange: (f: string, t: string) => void
}) {
  const [open, setOpen]       = useState(false)
  const [tmpFrom, setTmpFrom] = useState(fromDate)
  const [tmpTo,   setTmpTo]   = useState(toDate)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const activePreset = PRESETS.find(p => fromDate === p.from() && toDate === p.to())
  const label = activePreset ? activePreset.label : (fromDate || toDate)
    ? `${fromDate || '…'} → ${toDate || '…'}` : 'All Time'

  function apply()  { onChange(tmpFrom, tmpTo); setOpen(false) }
  function clear()  { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setTmpFrom(fromDate); setTmpTo(toDate); setOpen(o => !o) }}
        className="flex items-center gap-2 px-3.5 py-2 bg-white/15 border border-white/25 text-white text-xs font-semibold rounded-xl backdrop-blur-sm hover:bg-white/25 transition-all whitespace-nowrap"
      >
        <Calendar size={13} />
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Preset buttons */}
          <div className="p-3 grid grid-cols-3 gap-1.5 border-b border-gray-100">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { onChange(p.from(), p.to()); setOpen(false) }}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activePreset?.label === p.label
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-violet-50 hover:text-violet-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom range */}
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Custom Range</p>
            <div className="flex items-center gap-2">
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
              <span className="text-gray-400 text-xs">—</span>
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
            <div className="flex gap-2">
              <button onClick={clear}
                className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                Clear
              </button>
              <button onClick={apply}
                className="flex-1 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ApiRow {
  pipeConfigId:   number
  pipeConfig:     string
  diameterMm:     number
  pressureClass:  string
  stageType:      string
  pipesCompleted: number
}

interface PipeRow {
  pipeConfigId:  number
  pipeConfig:    string
  diameterMm:    number
  pressureClass: string
  stages:        Record<string, number>
  total:         number
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function StageWiseInventoryPage() {
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')

  const params = useMemo(() => ({
    ...(fromDate ? { fromDate } : {}),
    ...(toDate   ? { toDate }   : {}),
  }), [fromDate, toDate])

  const { data, isLoading } = useQuery({
    queryKey: ['stage-wise-inventory', params],
    queryFn: async () => {
      const res = await inventoryApi.getStageWise(params)
      return res.data.data as ApiRow[]
    },
  })

  // Pivot: group by pipeConfigId → one row per pipe type
  const pipeRows = useMemo<PipeRow[]>(() => {
    if (!data?.length) return []
    const map = new Map<number, PipeRow>()
    for (const row of data) {
      if (!map.has(row.pipeConfigId)) {
        map.set(row.pipeConfigId, {
          pipeConfigId: row.pipeConfigId,
          pipeConfig:   row.pipeConfig,
          diameterMm:   row.diameterMm,
          pressureClass: row.pressureClass,
          stages: {},
          total: 0,
        })
      }
      const pr = map.get(row.pipeConfigId)!
      pr.stages[row.stageType] = (pr.stages[row.stageType] ?? 0) + row.pipesCompleted
      pr.total += row.pipesCompleted
    }
    return [...map.values()].sort((a, b) => {
      const aHas = a.total > 0 ? 0 : 1
      const bHas = b.total > 0 ? 0 : 1
      if (aHas !== bHas) return aHas - bHas
      return a.diameterMm !== b.diameterMm ? a.diameterMm - b.diameterMm : a.pressureClass.localeCompare(b.pressureClass)
    })
  }, [data])

  // Column totals
  const colTotals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const pr of pipeRows) {
      for (const s of STAGES) t[s.key] = (t[s.key] ?? 0) + (pr.stages[s.key] ?? 0)
    }
    return t
  }, [pipeRows])

  const grandTotal = Object.values(colTotals).reduce((a, b) => a + b, 0)

  const activePreset = PRESETS.find(p => fromDate === p.from() && toDate === p.to())
  const isAllTime = !fromDate && !toDate

  return (
    <div className="min-h-full bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5" />

        <div className="relative flex items-center justify-between gap-4 px-8 py-6">
          {/* Title */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <Layers size={22} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Inventory</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Stage Wise Inventory</h1>
              <p className="text-sm text-blue-200 mt-0.5">
                Pipes completed at each production stage · by pipe type
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onChange={(f, t) => { setFromDate(f); setToDate(t) }}
            />
            {(!isAllTime) && (
              <button
                onClick={() => { setFromDate(''); setToDate('') }}
                className="p-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                title="Clear filter"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative flex items-center gap-6 px-8 pb-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-white">{pipeRows.length}</span>
            <span className="text-sm text-blue-200">Pipe Types</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-white">{STAGES.length}</span>
            <span className="text-sm text-blue-200">Stages</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-white">{grandTotal.toLocaleString()}</span>
            <span className="text-sm text-blue-200">Total Pipes Completed</span>
          </div>
          {activePreset && (
            <>
              <div className="w-px h-6 bg-white/20" />
              <span className="text-xs font-semibold text-amber-300 bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                {activePreset.label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading production data…
          </div>
        ) : (
          <table className="min-w-full text-sm border-collapse">
            {/* Column headers */}
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-gradient-to-br from-violet-700 to-blue-700 text-white px-5 py-4 text-left font-bold whitespace-nowrap border-r border-white/20 min-w-[200px]"
                >
                  <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-0.5">Pipe Type</div>
                  <div>Diameter · Pressure Class</div>
                </th>
                <th
                  colSpan={STAGES.length}
                  className="bg-gradient-to-r from-violet-600 to-blue-600 text-white px-4 py-2 text-center font-semibold text-xs uppercase tracking-widest border-b border-white/10"
                >
                  Production Stages — Pipes Completed
                </th>
                <th
                  rowSpan={2}
                  className="bg-gray-800 text-white px-4 py-4 text-center font-bold whitespace-nowrap min-w-[80px]"
                >
                  Total
                </th>
              </tr>
              <tr>
                {STAGES.map(s => (
                  <th
                    key={s.key}
                    className="bg-gradient-to-b from-violet-600 to-violet-700 text-white px-3 py-2.5 text-center font-semibold whitespace-nowrap text-xs"
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {pipeRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={STAGES.length + 2}
                    className="px-6 py-20 text-center"
                  >
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <Layers size={28} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-500">No production data yet</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Once your team starts recording production entries, stage counts will appear here.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pipeRows.map((pr, i) => (
                  <tr
                    key={pr.pipeConfigId}
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-violet-50/30 transition-colors`}
                  >
                    <td className="sticky left-0 z-10 px-5 py-3.5 bg-inherit border-r border-gray-100 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 text-sm">{pr.pipeConfig}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{pr.diameterMm}mm · {pr.pressureClass}</div>
                    </td>
                    {STAGES.map(s => {
                      const val = pr.stages[s.key] ?? 0
                      return (
                        <td key={s.key} className="px-3 py-3.5 text-center">
                          {val > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              {val}
                            </span>
                          ) : (
                            <span className="text-gray-200 text-xs select-none">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                        {pr.total.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Totals footer */}
            <tfoot>
              <tr className="bg-gray-900 text-white">
                <td className="sticky left-0 z-10 bg-gray-900 px-5 py-3.5 font-bold text-sm whitespace-nowrap border-r border-gray-700">
                  Total
                </td>
                {STAGES.map(s => (
                  <td key={s.key} className="px-3 py-3.5 text-center">
                    {(colTotals[s.key] ?? 0) > 0 ? (
                      <span className="text-sm font-bold text-white">{colTotals[s.key].toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3.5 text-center">
                  <span className="text-sm font-bold text-violet-300">{grandTotal.toLocaleString()}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
