import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ChevronRight, Package, BookOpen,
  Calendar, ChevronDown, X, Search,
} from 'lucide-react'
import { productionEntryApi } from '@/services/api'
import { ProductionEntry, PROD_STAGES } from '@/types'

// ── Date range picker ─────────────────────────────────────────────────────────

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }

function startOf(unit: 'week' | 'month' | 'quarter' | 'year', d = new Date()) {
  const r = new Date(d)
  if (unit === 'week') { const day = r.getDay() || 7; r.setDate(r.getDate() - day + 1) }
  else if (unit === 'month') r.setDate(1)
  else if (unit === 'quarter') r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}

type PresetKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today',        label: 'Today' },
  { key: 'yesterday',    label: 'Yesterday' },
  { key: 'this_week',    label: 'This Week' },
  { key: 'last_week',    label: 'Last Week' },
  { key: 'this_month',   label: 'This Month' },
  { key: 'last_month',   label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year',    label: 'This Year' },
]

function resolvePreset(key: PresetKey): { from: string; to: string } {
  const today = new Date(); const to = fmtDate(today)
  switch (key) {
    case 'today':        return { from: to, to }
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); const d = fmtDate(y); return { from: d, to: d } }
    case 'this_week':    return { from: fmtDate(startOf('week')), to }
    case 'last_week': { const end = new Date(startOf('week')); end.setDate(end.getDate() - 1); const start = new Date(end); start.setDate(start.getDate() - 6); return { from: fmtDate(start), to: fmtDate(end) } }
    case 'this_month':   return { from: fmtDate(startOf('month')), to }
    case 'last_month': { const end = new Date(startOf('month')); end.setDate(end.getDate() - 1); return { from: fmtDate(startOf('month', end)), to: fmtDate(end) } }
    case 'this_quarter': return { from: fmtDate(startOf('quarter')), to }
    case 'this_year':    return { from: fmtDate(startOf('year')), to }
  }
}

function DateRangePicker({ fromDate, toDate, onChange }: {
  fromDate: string; toDate: string; onChange: (f: string, t: string) => void
}) {
  const [open, setOpen]             = useState(false)
  const [preset, setPreset]         = useState<PresetKey | ''>('')
  const [customFrom, setCustomFrom] = useState(fromDate)
  const [customTo, setCustomTo]     = useState(toDate)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function selectPreset(key: PresetKey) {
    setPreset(key)
    const { from, to } = resolvePreset(key)
    setCustomFrom(from); setCustomTo(to)
    onChange(from, to); setOpen(false)
  }

  function applyCustom() { onChange(customFrom, customTo); setOpen(false) }
  function clear() { setPreset(''); setCustomFrom(''); setCustomTo(''); onChange('', '') }

  const hasDate = fromDate || toDate
  const activeLabel = preset
    ? PRESETS.find(p => p.key === preset)?.label
    : hasDate ? `${fromDate || '…'} → ${toDate || '…'}` : null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all ${
          hasDate
            ? 'bg-white/20 border-white/40 text-white backdrop-blur-sm'
            : 'bg-white/10 border-white/20 text-white/90 hover:bg-white/20 hover:border-white/40 backdrop-blur-sm'
        }`}
      >
        <Calendar size={14} />
        <span>{activeLabel ?? 'Filter by Date'}</span>
        {hasDate
          ? <X size={13} onClick={e => { e.stopPropagation(); clear() }} className="ml-1 opacity-70 hover:opacity-100" />
          : <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 w-72">
          <div className="p-2">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => selectPreset(p.key)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  preset === p.key ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.label}
                {preset === p.key && (
                  <span className="float-right text-xs text-violet-400 tabular-nums">{fromDate} → {toDate}</span>
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 mx-3" />
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Custom Range</p>
            <div className="grid grid-cols-2 gap-2">
              {([['From', customFrom, setCustomFrom], ['To', customTo, setCustomTo]] as const).map(([lbl, val, set]) => (
                <div key={lbl}>
                  <label className="text-xs text-gray-500 mb-0.5 block">{lbl}</label>
                  <input type="date" value={val}
                    onChange={e => { set(e.target.value); setPreset('') }}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              ))}
            </div>
            <button onClick={applyCustom} disabled={!customFrom && !customTo}
              className="w-full py-1.5 text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg disabled:opacity-40 hover:from-violet-700 hover:to-blue-700">
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProductionEntriesPage() {
  const navigate     = useNavigate()
  const [stageFilter, setStageFilter] = useState('')
  const [search, setSearch]           = useState('')
  const [from, setFrom]               = useState('')
  const [to, setTo]                   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['production-entries', stageFilter, from, to],
    queryFn: () => productionEntryApi.getAll({
      stageType: stageFilter || undefined,
      from: from || undefined,
      to:   to   || undefined,
      size: 100,
    }).then(r => r.data.data),
  })

  const allEntries: ProductionEntry[] = data?.content ?? []

  const entries = allEntries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (e.productionOrder?.poNumber ?? '').toLowerCase().includes(q) ||
      (e.pipeConfig?.name ?? '').toLowerCase().includes(q) ||
      (PROD_STAGES.find(s => s.key === e.stageType)?.label ?? '').toLowerCase().includes(q)
    )
  })

  const hasDateFilter = !!(from || to)
  const totalCompleted = entries.reduce((s, e) => s + (e.pipesCompleted ?? 0), 0)
  const totalRejected  = entries.reduce((s, e) => s + (e.pipesRejected  ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        {/* Background layer */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Content */}
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <BookOpen size={26} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Production</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Production Entries</h1>
              <p className="text-sm text-blue-200 mt-0.5">View all stage entries across production orders</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker
              fromDate={from}
              toDate={to}
              onChange={(f, t) => { setFrom(f); setTo(t) }}
            />
            <button
              onClick={() => navigate('/production/entry')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 border border-white/25 text-white text-sm font-semibold rounded-xl backdrop-blur-sm hover:bg-white/25 transition-all"
            >
              <Plus size={16} /> New Entry
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          {[
            { label: 'Total Entries',  value: entries.length, sub: hasDateFilter ? 'in date range' : 'loaded', warn: false },
            { label: 'Stages Active',  value: new Set(entries.map(e => e.stageType)).size, sub: 'unique stages', warn: false },
            { label: 'Pipes Completed', value: totalCompleted, sub: 'across entries', warn: false },
            { label: 'Pipes Rejected', value: totalRejected,  sub: 'across entries', warn: totalRejected > 0 },
          ].map(s => (
            <div key={s.label} className="px-6 py-3.5">
              <p className={`text-xl font-extrabold tabular-nums leading-none ${s.warn ? 'text-amber-300' : 'text-white'}`}>{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table card ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-gray-100">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <BookOpen size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Entry Log</h2>
              <p className="text-xs text-blue-100 mt-0.5">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap bg-gray-50/50">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search order, pipe type, stage…"
              className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={13} />
              </button>
            )}
          </div>
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700"
          >
            <option value="">All Stages</option>
            {PROD_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No entries found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="text-left px-6 py-3">Order</th>
                <th className="text-left px-6 py-3">Pipe Type</th>
                <th className="text-left px-6 py-3">Stage</th>
                <th className="text-center px-6 py-3">Processed</th>
                <th className="text-center px-6 py-3">Completed</th>
                <th className="text-center px-6 py-3">Rejected</th>
                <th className="text-left px-6 py-3">Date</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr
                  key={e.id}
                  className="border-t border-gray-100 hover:bg-violet-50/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/production/entries/${e.id}`)}
                >
                  <td className="px-6 py-2.5 font-mono text-violet-700 text-xs font-semibold">
                    {e.productionOrder?.poNumber ?? `#${e.productionOrderId}`}
                  </td>
                  <td className="px-6 py-2.5 text-gray-700">
                    {e.pipeConfig?.name ?? `Config #${e.pipeConfigId}`}
                  </td>
                  <td className="px-6 py-2.5">
                    <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-0.5 rounded-full">
                      {PROD_STAGES.find(s => s.key === e.stageType)?.label ?? e.stageType}
                    </span>
                  </td>
                  <td className="px-6 py-2.5 text-center text-gray-700">{e.pipesProcessed}</td>
                  <td className="px-6 py-2.5 text-center font-semibold text-green-700">{e.pipesCompleted}</td>
                  <td className="px-6 py-2.5 text-center">
                    {e.pipesRejected
                      ? <span className="text-red-500 font-semibold">{e.pipesRejected}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-2.5 text-gray-500 text-xs">
                    {new Date(e.entryDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-2 py-2.5">
                    {(e.consumptions?.length ?? 0) > 0
                      ? <Package size={13} className="text-violet-400" />
                      : <ChevronRight size={14} className="text-gray-300" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
