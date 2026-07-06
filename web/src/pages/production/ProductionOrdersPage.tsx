import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, X, Factory, ChevronRight,
  CheckCircle2, Clock, PlayCircle, Package,
  ArrowUp, ArrowDown, ArrowUpDown, ClipboardList,
  Calendar, ChevronDown, Link2, Unlink,
  PauseCircle, Play,
} from 'lucide-react'
import { format } from 'date-fns'
import { productionOrderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string; order: number }> = {
  DRAFT:       { label: 'Draft',       bg: 'bg-gray-100',    text: 'text-gray-600',   dot: 'bg-gray-400',    order: 0 },
  PLANNED:     { label: 'Planned',     bg: 'bg-blue-50',     text: 'text-blue-700',   dot: 'bg-blue-500',    order: 1 },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-amber-50',    text: 'text-amber-700',  dot: 'bg-amber-500',   order: 2 },
  ON_HOLD:     { label: 'On Hold',     bg: 'bg-orange-50',   text: 'text-orange-700', dot: 'bg-orange-500',  order: 3 },
  COMPLETED:   { label: 'Completed',   bg: 'bg-green-50',    text: 'text-green-700',  dot: 'bg-green-500',   order: 4 },
  CANCELLED:   { label: 'Cancelled',   bg: 'bg-red-50',      text: 'text-red-600',    dot: 'bg-red-400',     order: 5 },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.DRAFT
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-gray-700">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ── Sort types ────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null
type SortKey = 'poNumber' | 'pipeName' | 'plannedQty' | 'status' | 'plannedStartDate' | 'plannedEndDate' | 'soNumber'

interface SortState {
  key: SortKey | null
  dir: SortDir
}

// Cycle: null → asc → desc → null
function nextDir(current: SortDir): SortDir {
  if (current === null) return 'asc'
  if (current === 'asc') return 'desc'
  return null
}

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc')  return <ArrowUp   size={12} className="text-violet-600" />
  if (dir === 'desc') return <ArrowDown size={12} className="text-violet-600" />
  return <ArrowUpDown size={12} className="text-slate-300 group-hover/th:text-slate-400" />
}

// ── Sortable header cell ──────────────────────────────────────────────────────

interface ThProps {
  label: string
  sortKey: SortKey
  sort: SortState
  onSort: (key: SortKey) => void
  align?: 'left' | 'center' | 'right'
}

function Th({ label, sortKey, sort, onSort, align = 'left' }: ThProps) {
  const active = sort.key === sortKey
  const alignClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
  return (
    <th
      className={`px-6 py-3 text-[11px] font-bold uppercase tracking-widest cursor-pointer select-none group/th
        ${active ? 'bg-violet-50/60 text-violet-700' : 'text-slate-500 hover:bg-slate-100/60'}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`inline-flex items-center gap-1.5 ${alignClass} w-full`}>
        <span>{label}</span>
        <SortIcon dir={active ? sort.dir : null} />
      </div>
    </th>
  )
}

// ── Comparator ────────────────────────────────────────────────────────────────

function getValue(o: any, key: SortKey): any {
  switch (key) {
    case 'poNumber':         return o.poNumber ?? ''
    case 'pipeName':         return o.pipeConfig?.name ?? ''
    case 'plannedQty':       return o.plannedQty ?? 0
    case 'status':           return STATUS_CFG[o.status]?.order ?? 99
    case 'plannedStartDate': return o.plannedStartDate ? new Date(o.plannedStartDate).getTime() : 0
    case 'plannedEndDate':   return o.plannedEndDate   ? new Date(o.plannedEndDate).getTime()   : 0
    case 'soNumber':         return o.salesOrder?.soNumber ?? ''
  }
}

function applySort(rows: any[], sort: SortState): any[] {
  if (!sort.key || !sort.dir) return rows
  const { key, dir } = sort
  return [...rows].sort((a, b) => {
    const av = getValue(a, key)
    const bv = getValue(b, key)
    if (av === bv) return 0
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return dir === 'asc' ? cmp : -cmp
  })
}

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

export default function ProductionOrdersPage() {
  const navigate = useNavigate()
  const { outletId } = useAuthStore()
  const queryClient = useQueryClient()

  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('ALL')
  const [source, setSource]     = useState<'ALL' | 'SO' | 'DIRECT'>('ALL')
  const [page, setPage]         = useState(0)
  const [sort, setSort]         = useState<SortState>({ key: null, dir: null })
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')

  // Hold modal state
  const [holdModal, setHoldModal]       = useState<{ orderId: number; poNumber: string; plannedQty: number } | null>(null)
  const [holdReason, setHoldReason]     = useState('')
  const [holdProgress, setHoldProgress] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  async function openHoldModal(e: React.MouseEvent, order: any) {
    e.stopPropagation()
    setHoldModal({ orderId: order.id, poNumber: order.poNumber, plannedQty: order.plannedQty })
    setHoldReason('')
    setHoldProgress(null)
    const prog = await productionOrderApi.getProgress(order.id).then(r => r.data.data).catch(() => null)
    setHoldProgress(prog)
  }

  async function confirmHold() {
    if (!holdModal || !holdReason.trim()) return
    setActionLoading(holdModal.orderId)
    const finalStage = holdProgress?.stages?.find((s: any) => s.stageType === 'FINAL_TESTING')
    const holdQtyProduced = finalStage?.pipesCompleted ?? 0
    await productionOrderApi.updateStatus(holdModal.orderId, 'ON_HOLD', holdReason.trim(), holdQtyProduced)
    queryClient.invalidateQueries({ queryKey: ['production-orders-list'] })
    setHoldModal(null)
    setActionLoading(null)
  }

  async function resumeOrder(e: React.MouseEvent, orderId: number) {
    e.stopPropagation()
    setActionLoading(orderId)
    await productionOrderApi.updateStatus(orderId, 'IN_PROGRESS')
    queryClient.invalidateQueries({ queryKey: ['production-orders-list'] })
    setActionLoading(null)
  }

  function handleSort(key: SortKey) {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' }
      const dir = nextDir(prev.dir)
      return dir === null ? { key: null, dir: null } : { key, dir }
    })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['production-orders-list', status, page, outletId],
    queryFn: () =>
      productionOrderApi.getAll({
        outletId: outletId ?? undefined,
        ...(status !== 'ALL' ? { status } : {}),
        page,
        size: 50,
      }).then(r => r.data),
  })

  const { data: summariesData } = useQuery({
    queryKey: ['production-orders-summaries'],
    queryFn: () => productionOrderApi.getSummaries().then(r => r.data.data ?? []),
  })
  const summaries: any[] = summariesData ?? []
  const activeSummaries  = summaries.filter((s: any) => s.status !== 'CANCELLED')
  const totalPlannedPipes    = activeSummaries.reduce((acc: number, s: any) => acc + (s.plannedQty ?? 0), 0)
  const totalFinishedPipes   = activeSummaries.reduce((acc: number, s: any) => acc + (s.finishedPipes ?? 0), 0)
  const totalRemainingPipes  = totalPlannedPipes - totalFinishedPipes

  const allOrders: any[] = data?.data?.content ?? data?.data ?? []

  const filtered = allOrders.filter((o: any) => {
    if (search) {
      const q = search.toLowerCase()
      const matchSearch = (
        o.poNumber?.toLowerCase().includes(q) ||
        o.pipeConfig?.name?.toLowerCase().includes(q) ||
        o.salesOrder?.soNumber?.toLowerCase().includes(q)
      )
      if (!matchSearch) return false
    }
    if (source === 'SO'     && !o.salesOrder) return false
    if (source === 'DIRECT' &&  o.salesOrder) return false
    if (fromDate || toDate) {
      const d = o.plannedStartDate ? o.plannedStartDate.split('T')[0] : ''
      if (fromDate && d < fromDate) return false
      if (toDate   && d > toDate)   return false
    }
    return true
  })

  const orders = useMemo(() => applySort(filtered, sort), [filtered, sort])

  const hasDateFilter = !!(fromDate || toDate)
  const countBase     = hasDateFilter ? filtered : allOrders
  const total         = hasDateFilter ? filtered.length : (data?.data?.totalElements ?? allOrders.length)
  const inProgress    = countBase.filter((o: any) => o.status === 'IN_PROGRESS').length
  const onHold        = countBase.filter((o: any) => o.status === 'ON_HOLD').length
  const planned       = countBase.filter((o: any) => o.status === 'PLANNED').length
  const completed     = countBase.filter((o: any) => o.status === 'COMPLETED').length
  const fromSOCount   = countBase.filter((o: any) => !!o.salesOrder).length
  const directCount   = countBase.filter((o: any) => !o.salesOrder).length

  const thProps = { sort, onSort: handleSort }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        {/* Background layer — overflow-hidden here so blobs/gradient stay clipped to rounded corners */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Content — no overflow-hidden so the dropdown can escape */}
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <ClipboardList size={26} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Production</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Production Orders</h1>
              <p className="text-sm text-blue-200 mt-0.5">Track and manage pipe production batches</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onChange={(f, t) => { setFromDate(f); setToDate(t); setPage(0) }}
            />
            <button
              onClick={() => navigate('/production/orders/new')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 border border-white/25 text-white text-sm font-semibold rounded-xl backdrop-blur-sm hover:bg-white/25 transition-all"
            >
              <Plus size={16} /> New Order
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-9 divide-x divide-white/10">
          {[
            { label: 'Total Orders',     value: total,         sub: hasDateFilter ? 'in date range' : 'all time' },
            { label: 'Planned',          value: planned,       sub: 'awaiting start'    },
            { label: 'In Progress',      value: inProgress,    sub: 'currently active', warn: inProgress > 0 },
            { label: 'On Hold',          value: onHold,        sub: 'paused orders',    accent: onHold > 0 ? 'text-orange-300' : undefined },
            { label: 'Completed',        value: completed,     sub: 'finished'          },
            { label: 'From Sales Order', value: fromSOCount,   sub: 'linked to SO',     accent: 'text-violet-300' },
            { label: 'Direct',           value: directCount,   sub: 'standalone',       accent: 'text-blue-200'  },
          ].map(s => (
            <div key={s.label} className="px-4 py-3.5">
              <p className={`text-xl font-extrabold tabular-nums leading-none ${(s as any).warn ? 'text-amber-300' : (s as any).accent ?? 'text-white'}`}>{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}

          {/* Pipes Completed */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-green-300 uppercase tracking-widest mb-1">Pipes Completed</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold tabular-nums text-green-300 leading-none">{totalFinishedPipes.toLocaleString()}</span>
              <span className="text-xs font-semibold text-white/50">pipes</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-base font-bold tabular-nums text-green-200 leading-none">{activeSummaries.reduce((acc: number, s: any) => acc + (s.finishedPipes ?? 0) * (s.lengthM ?? 5.25), 0).toFixed(1)}</span>
              <span className="text-xs font-semibold text-white/50">meters</span>
            </div>
          </div>

          {/* Pipes Remaining */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-widest mb-1">Pipes Remaining</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-extrabold tabular-nums leading-none ${totalRemainingPipes > 0 ? 'text-amber-200' : 'text-green-300'}`}>{totalRemainingPipes.toLocaleString()}</span>
              <span className="text-xs font-semibold text-white/50">pipes</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-base font-bold tabular-nums leading-none ${totalRemainingPipes > 0 ? 'text-amber-100' : 'text-green-200'}`}>{activeSummaries.reduce((acc: number, s: any) => acc + Math.max(0, (s.plannedQty ?? 0) - (s.finishedPipes ?? 0)) * (s.lengthM ?? 5.25), 0).toFixed(1)}</span>
              <span className="text-xs font-semibold text-white/50">meters</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-gray-100">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Factory size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">All Production Orders</h2>
              <p className="text-xs text-blue-100 mt-0.5">{total} order{total !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-100">Total Orders</p>
            <p className="text-sm font-bold text-white tabular-nums">{total}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap bg-gray-50/50">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search PO number, pipe name, SO…"
              className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['ALL', 'DRAFT', 'PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map(s => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(0) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  status === s
                    ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-400'
                }`}
              >
                {s === 'ALL' ? 'All' : (STATUS_CFG[s]?.label ?? s)}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          <div className="flex gap-1.5">
            {([
              { key: 'ALL',    label: 'All Sources', icon: undefined },
              { key: 'SO',     label: 'From SO',    icon: Link2  },
              { key: 'DIRECT', label: 'Direct',     icon: Unlink },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setSource(key); setPage(0) }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  source === key
                    ? key === 'SO'
                      ? 'bg-violet-100 text-violet-700 border border-violet-300'
                      : key === 'DIRECT'
                        ? 'bg-gray-100 text-gray-700 border border-gray-300'
                        : 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-400'
                }`}
              >
                {Icon && <Icon size={11} />}
                {label}
              </button>
            ))}
          </div>
          {sort.key && (
            <button
              onClick={() => setSort({ key: null, dir: null })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <X size={11} /> Clear sort
            </button>
          )}
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-200">
              <Th label="PO Number"     sortKey="poNumber"         align="left"   {...thProps} />
              <Th label="Pipe Config"   sortKey="pipeName"         align="left"   {...thProps} />
              <Th label="Planned Qty"   sortKey="plannedQty"       align="center" {...thProps} />
              <Th label="Status"        sortKey="status"           align="center" {...thProps} />
              <Th label="Planned Start" sortKey="plannedStartDate" align="center" {...thProps} />
              <Th label="Planned End"   sortKey="plannedEndDate"   align="center" {...thProps} />
              <Th label="Sales Order"   sortKey="soNumber"         align="left"   {...thProps} />
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-6 py-4"><div className="h-3 bg-gray-100 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <Factory size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-400">No production orders found</p>
                  <button
                    onClick={() => navigate('/production/orders/new')}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-semibold rounded-xl hover:from-violet-700 hover:to-blue-700"
                  >
                    <Plus size={13} /> New Order
                  </button>
                </td>
              </tr>
            ) : (
              orders.map((o: any) => {
                const fromSO = !!o.salesOrder
                const isOnHold = o.status === 'ON_HOLD'
                const isInProgress = o.status === 'IN_PROGRESS'
                return (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/production/orders/${o.id}`)}
                  className={`cursor-pointer transition-colors group border-l-4 ${
                    isOnHold
                      ? 'border-l-orange-400 bg-orange-50/20 hover:bg-orange-50/40'
                      : fromSO
                        ? 'border-l-violet-400 hover:bg-violet-50/40'
                        : 'border-l-gray-200 hover:bg-gray-50/60'
                  }`}
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{o.poNumber}</span>
                      {fromSO ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-semibold">
                          <Link2 size={9} />SO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-semibold">
                          <Unlink size={9} />Direct
                        </span>
                      )}
                    </div>
                    {isOnHold && (
                      <div className="mt-1 space-y-0.5">
                        {o.holdReason && (
                          <p className="text-[11px] text-orange-600 leading-tight max-w-[200px] truncate" title={o.holdReason}>
                            Reason: {o.holdReason}
                          </p>
                        )}
                        {o.holdQtyProduced != null && (
                          <p className="text-[11px] text-orange-500">
                            {o.holdQtyProduced} / {o.plannedQty} pipes completed
                          </p>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-3.5">
                    <p className="font-medium text-gray-800">{o.pipeConfig?.name ?? `Config #${o.pipeConfigId}`}</p>
                  </td>

                  <td className="px-6 py-3.5 text-center">
                    <span className="font-semibold text-gray-800 tabular-nums">{o.plannedQty?.toLocaleString() ?? '—'}</span>
                  </td>

                  <td className="px-6 py-3.5 text-center">
                    <StatusBadge status={o.status} />
                  </td>

                  <td className="px-6 py-3.5 text-center text-xs text-gray-500">
                    {o.plannedStartDate ? format(new Date(o.plannedStartDate), 'dd MMM yyyy') : '—'}
                  </td>

                  <td className="px-6 py-3.5 text-center">
                    {o.plannedEndDate ? (
                      <span className="text-xs font-semibold text-gray-700">
                        {format(new Date(o.plannedEndDate), 'dd MMM yyyy')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  <td className="px-6 py-3.5">
                    {o.salesOrder ? (
                      <span className="text-xs font-semibold text-gray-700">{o.salesOrder.soNumber}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {isInProgress && (
                        <button
                          disabled={actionLoading === o.id}
                          onClick={e => openHoldModal(e, o)}
                          title="Put on hold"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-40"
                        >
                          <PauseCircle size={12} /> Hold
                        </button>
                      )}
                      {isOnHold && (
                        <button
                          disabled={actionLoading === o.id}
                          onClick={e => resumeOrder(e, o.id)}
                          title="Resume production"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-40"
                        >
                          <Play size={11} /> Resume
                        </button>
                      )}
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-slate-600 transition-colors" />
                    </div>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>

          {orders.length > 1 && (
            <tfoot>
              <tr className="bg-violet-50 border-t-2 border-violet-200">
                <td colSpan={2} className="px-6 py-3 text-xs font-bold text-violet-700 uppercase tracking-widest">
                  {orders.length} orders shown
                </td>
                <td className="px-6 py-3 text-center text-sm font-bold text-gray-900 tabular-nums">
                  {orders.reduce((s: number, o: any) => s + (o.plannedQty ?? 0), 0).toLocaleString()}
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>

        {/* Pagination */}
        {total > 50 && (
          <div className="px-6 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
            <p className="text-xs text-gray-500">
              Showing {page * 50 + 1}–{Math.min((page + 1) * 50, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >Prev</button>
              <button
                disabled={(page + 1) * 50 >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Hold Modal */}
      {holdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                <PauseCircle size={18} className="text-orange-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Put Order on Hold</h3>
                <p className="text-xs text-gray-500 mt-0.5">{holdModal.poNumber}</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Progress snapshot */}
              <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
                <p className="text-xs font-semibold text-orange-700 mb-1">Production progress at time of hold</p>
                {holdProgress === null ? (
                  <p className="text-xs text-orange-400">Loading…</p>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-orange-700 tabular-nums">
                      {holdProgress?.stages?.find((s: any) => s.stageType === 'FINAL_TESTING')?.pipesCompleted ?? 0}
                    </span>
                    <span className="text-xs text-orange-500">/ {holdModal.plannedQty} pipes passed final testing</span>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Reason for hold <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={holdReason}
                  onChange={e => setHoldReason(e.target.value)}
                  placeholder="e.g. Client requested delay, material shortage, machine maintenance…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setHoldModal(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!holdReason.trim() || actionLoading === holdModal.orderId}
                onClick={confirmHold}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                {actionLoading === holdModal.orderId ? 'Saving…' : 'Confirm Hold'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
