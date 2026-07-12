import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Calendar, ChevronDown, X, Search,
  Truck, User, Phone, MapPin, FileBarChart2,
  IndianRupee, Package, TrendingUp, Building2,
  ChevronRight, ChevronUp, Pencil, Save, FileDown,
} from 'lucide-react'
import { loadingRecordApi } from '@/services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Convert ISO yyyy-MM-dd to dd/MM/yyyy for display */
function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

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
  const today = new Date(); const to = isoDate(today)
  switch (key) {
    case 'today':        return { from: to, to }
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); const d = isoDate(y); return { from: d, to: d } }
    case 'this_week':    return { from: isoDate(startOf('week')), to }
    case 'last_week': { const end = new Date(startOf('week')); end.setDate(end.getDate() - 1); const start = new Date(end); start.setDate(start.getDate() - 6); return { from: isoDate(start), to: isoDate(end) } }
    case 'this_month':   return { from: isoDate(startOf('month')), to }
    case 'last_month': { const end = new Date(startOf('month')); end.setDate(end.getDate() - 1); return { from: isoDate(startOf('month', end)), to: isoDate(end) } }
    case 'this_quarter': return { from: isoDate(startOf('quarter')), to }
    case 'this_year':    return { from: isoDate(startOf('year')), to }
  }
}

function DateRangePicker({ fromDate, toDate, onChange }: {
  fromDate: string; toDate: string; onChange: (f: string, t: string) => void
}) {
  const [open, setOpen]             = useState(false)
  const [preset, setPreset]         = useState<PresetKey | ''>('')
  const [customFrom, setCustomFrom] = useState(fromDate)
  const [customTo, setCustomTo]     = useState(toDate)
  const [pos, setPos]               = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const ref    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

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
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
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
        <div ref={ref} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 w-72">
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

// ── Currency formatter ────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
}

// ── Trip row type ─────────────────────────────────────────────────────────────

interface Trip {
  id: number
  date: string
  pipeName: string
  quantity: number
  vehicleNo: string
  driverName: string
  driverContact: string
  vendor: string
  siteAddress: string
  transportRate: string
  rateType: string       // 'per_pipe' | 'per_trip'
  notes: string
  totalAmount: number    // computed: qty×rate (per_pipe) or rate (per_trip)
}

/** Compute trip total based on rateType */
function computeTotal(quantity: number, rate: string, rateType: string): number {
  const r = parseFloat(rate || '0') || 0
  return rateType === 'per_trip' ? r : quantity * r
}

// ── Vendor summary row ────────────────────────────────────────────────────────

interface VendorSummary {
  vendor: string
  trips: number
  totalPipes: number
  totalAmount: number
  avgRate: number
  vehicles: Set<string>
  trips_list: Trip[]
}

// ── Customer summary row ──────────────────────────────────────────────────────

interface CustomerSummary {
  siteAddress: string
  trips: number
  totalPipes: number
  totalAmount: number
  vendors: Set<string>
  pipeTypes: Set<string>
  trips_list: Trip[]
}

// ── Vendor breakdown card ─────────────────────────────────────────────────────

function VendorCard({ vs, expanded, onToggle }: { vs: VendorSummary; expanded: boolean; onToggle: () => void }) {
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null)

  // Group trips by truck (always from full list, for the chip strip)
  const byTruck = useMemo(() => {
    const map = new Map<string, { truck: string; trips: number; pipes: number; amount: number }>()
    vs.trips_list.forEach(t => {
      const key = t.vehicleNo || '—'
      if (!map.has(key)) map.set(key, { truck: key, trips: 0, pipes: 0, amount: 0 })
      const tk = map.get(key)!
      tk.trips++
      tk.pipes += t.quantity
      tk.amount += t.totalAmount
    })
    return Array.from(map.values()).sort((a, b) => b.trips - a.trips)
  }, [vs.trips_list])

  // Active trips — filtered by selected truck
  const activeTrips = useMemo(() =>
    selectedTruck ? vs.trips_list.filter(t => t.vehicleNo === selectedTruck) : vs.trips_list,
  [vs.trips_list, selectedTruck])

  // Group active trips by site
  const bySite = useMemo(() => {
    const map = new Map<string, { site: string; trips: Trip[]; totalPipes: number }>()
    activeTrips.forEach(t => {
      const key = t.siteAddress || 'Unknown Site'
      if (!map.has(key)) map.set(key, { site: key, trips: [], totalPipes: 0 })
      const s = map.get(key)!
      s.trips.push(t)
      s.totalPipes += t.quantity
    })
    return Array.from(map.values()).sort((a, b) => b.trips.length - a.trips.length)
  }, [activeTrips])

  const selectedTruckData = selectedTruck ? byTruck.find(tk => tk.truck === selectedTruck) : null
  const activePipes  = activeTrips.reduce((s, t) => s + t.quantity, 0)
  const activeAmount = activeTrips.reduce((s, t) => s + t.totalAmount, 0)

  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">

      {/* Summary header — clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 px-5 py-4 transition-colors text-left"
        style={{background:'linear-gradient(to right,#a78bfa,#818cf8)'}}
      >
        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Building2 size={20} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white truncate">{vs.vendor || 'Unknown Vendor'}</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/20 text-white rounded-full border border-white/30 flex-shrink-0">
              {vs.trips} trip{vs.trips !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Package size={11} className="text-white/60" />
              {vs.totalPipes.toLocaleString()} pipes
            </span>
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Truck size={11} className="text-white/60" />
              {vs.vehicles.size} truck{vs.vehicles.size !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/70">
              <MapPin size={11} className="text-white/60" />
              {bySite.length} site{bySite.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-lg font-extrabold text-white tabular-nums">{fmt(vs.totalAmount)}</p>
          <p className="text-[10px] text-white/60 mt-0.5">total payable</p>
        </div>

        <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 mt-1 ml-1">
          {expanded ? <ChevronUp size={14} className="text-white" /> : <ChevronRight size={14} className="text-white" />}
        </div>
      </button>

      {expanded && (
        <>
          {/* ── Truck-wise summary strip ── */}
          <div className="px-5 py-3 bg-violet-50/80 border-b border-violet-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Truck-wise Summary</p>
              {selectedTruck && (
                <button
                  onClick={() => setSelectedTruck(null)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-violet-500 hover:text-violet-700 bg-white border border-violet-200 px-2 py-0.5 rounded-full transition-colors"
                >
                  <X size={10} /> Clear filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {byTruck.map(tk => {
                const isActive = selectedTruck === tk.truck
                return (
                  <button
                    key={tk.truck}
                    onClick={() => setSelectedTruck(isActive ? null : tk.truck)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border shadow-sm transition-all text-left ${
                      isActive
                        ? 'bg-violet-600 border-violet-600 text-white shadow-violet-200'
                        : 'bg-white border-violet-100 hover:border-violet-300 hover:bg-violet-50'
                    }`}
                  >
                    <Truck size={12} className={isActive ? 'text-white/80' : 'text-violet-400'} />
                    <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-800'}`}>{tk.truck}</span>
                    <span className={`text-[10px] ${isActive ? 'text-white/60' : 'text-gray-400'}`}>·</span>
                    <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{tk.trips} trip{tk.trips !== 1 ? 's' : ''}</span>
                    <span className={`text-[10px] ${isActive ? 'text-white/60' : 'text-gray-400'}`}>·</span>
                    <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{tk.pipes} pipes</span>
                    {tk.amount > 0 && (
                      <>
                        <span className={`text-[10px] ${isActive ? 'text-white/60' : 'text-gray-400'}`}>·</span>
                        <span className={`text-[10px] font-semibold tabular-nums ${isActive ? 'text-white' : 'text-violet-600'}`}>{fmt(tk.amount)}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected truck summary banner */}
            {selectedTruckData && (
              <div className="mt-3 bg-violet-600 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Truck size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white">{selectedTruckData.truck}</p>
                  <p className="text-[10px] text-violet-200 mt-0.5">Showing trips for this truck only</p>
                </div>
                <div className="flex gap-5 text-right">
                  <div>
                    <p className="text-sm font-extrabold text-white tabular-nums">{selectedTruckData.trips}</p>
                    <p className="text-[10px] text-violet-200">trips</p>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white tabular-nums">{selectedTruckData.pipes}</p>
                    <p className="text-[10px] text-violet-200">pipes</p>
                  </div>
                  {selectedTruckData.amount > 0 && (
                    <div>
                      <p className="text-sm font-extrabold text-amber-300 tabular-nums">{fmt(selectedTruckData.amount)}</p>
                      <p className="text-[10px] text-violet-200">payable</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Site-by-site breakdown ── */}
          {bySite.map((s, si) => (
            <div key={s.site} className={si > 0 ? 'border-t border-gray-100' : ''}>
              {/* Site sub-header */}
              <div className="flex items-center justify-between px-5 py-2.5 bg-indigo-50/50">
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-indigo-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-gray-800">{s.site}</span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-600 rounded-full">
                    Total trips = {s.trips.length}
                  </span>
                </div>
                <span className="text-xs font-bold text-gray-700 tabular-nums">{s.totalPipes} pipes</span>
              </div>

              {/* Trip table for this site */}
              <div className="overflow-x-auto px-4 py-3">
                <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-5 py-2.5 font-semibold text-gray-900 uppercase tracking-wider text-xs w-36">Truck No</th>
                      <th className="text-left px-5 py-2.5 font-semibold text-gray-900 uppercase tracking-wider text-xs">Pipe Name</th>
                      <th className="text-center px-5 py-2.5 font-semibold text-gray-900 uppercase tracking-wider text-xs w-16">Qty</th>
                      <th className="text-right px-5 py-2.5 font-semibold text-gray-900 uppercase tracking-wider text-xs w-28">Rate</th>
                      <th className="text-left px-5 py-2.5 font-semibold text-gray-900 uppercase tracking-wider text-xs">Destination</th>
                      <th className="text-right px-5 py-2.5 font-semibold text-gray-900 uppercase tracking-wider text-xs w-28">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {s.trips.map((t, i) => (
                      <tr key={t.id} className={`hover:bg-violet-50/20 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-900 font-semibold text-[11px] px-2 py-0.5 rounded-md">
                            <Truck size={10} className="flex-shrink-0 text-gray-500" />
                            {t.vehicleNo || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-700 font-medium">{t.pipeName || '—'}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-block bg-gray-100 text-gray-800 font-bold text-[11px] px-2 py-0.5 rounded-md min-w-[28px] text-center">{t.quantity}</span>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">
                          {t.transportRate
                            ? <span className="text-violet-700 font-semibold">₹{t.transportRate}<span className="text-gray-400 font-normal text-[10px]">/{t.rateType === 'per_trip' ? 'trip' : 'pipe'}</span></span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-gray-500 max-w-[200px]">
                          <span className="truncate block" title={t.siteAddress}>{t.siteAddress || '—'}</span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-right whitespace-nowrap tabular-nums text-[11px]">
                          {t.date ? format(new Date(t.date), 'dd MMM yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Sub-total footer */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t-2 border-violet-200 bg-violet-50">
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
              {selectedTruck ? `${selectedTruck} — Subtotal` : 'Sub-total'}
            </span>
            <div className="flex items-center gap-6">
              <span className="text-xs text-gray-600">
                {activeTrips.length} trips · <strong>{activePipes}</strong> pipes
              </span>
              <span className="text-sm font-extrabold text-gray-900 tabular-nums">{fmt(activeAmount)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Customer breakdown card ───────────────────────────────────────────────────

function CustomerCard({ cs, expanded, onToggle }: { cs: CustomerSummary; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">

      {/* Summary header */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 px-5 py-4 transition-colors text-left"
        style={{background:'linear-gradient(to right,#a78bfa,#818cf8)'}}
      >
        {/* Address icon */}
        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MapPin size={20} className="text-white" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white truncate">{cs.siteAddress || 'Unknown Site'}</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/20 text-white rounded-full border border-white/30 flex-shrink-0">
              {cs.trips} trip{cs.trips !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Package size={11} className="text-white/60" />
              {cs.totalPipes.toLocaleString()} pipes
            </span>
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Truck size={11} className="text-white/60" />
              {cs.vendors.size} vendor{cs.vendors.size !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Building2 size={11} className="text-white/60" />
              {Array.from(cs.vendors).join(', ')}
            </span>
          </div>
          {cs.pipeTypes.size > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Array.from(cs.pipeTypes).map(pt => (
                <span key={pt} className="px-1.5 py-0.5 text-[10px] font-medium bg-white/15 text-white/80 rounded">
                  {pt}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-extrabold text-white tabular-nums">{fmt(cs.totalAmount)}</p>
          <p className="text-[10px] text-white/60 mt-0.5">total transport</p>
        </div>

        {/* Expand toggle */}
        <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 mt-1 ml-1">
          {expanded ? <ChevronUp size={14} className="text-white" /> : <ChevronRight size={14} className="text-white" />}
        </div>
      </button>

      {/* Trip sub-table */}
      {expanded && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-indigo-50/60">
                <th className="text-left px-4 py-2.5 font-bold text-gray-900 uppercase tracking-widest">Date</th>
                <th className="text-left px-4 py-2.5 font-bold text-gray-900 uppercase tracking-widest">Pipe</th>
                <th className="text-center px-4 py-2.5 font-bold text-gray-900 uppercase tracking-widest">Qty</th>
                <th className="text-left px-4 py-2.5 font-bold text-gray-900 uppercase tracking-widest">Vendor</th>
                <th className="text-left px-4 py-2.5 font-bold text-gray-900 uppercase tracking-widest">Vehicle</th>
                <th className="text-left px-4 py-2.5 font-bold text-gray-900 uppercase tracking-widest">Driver</th>
                <th className="text-right px-4 py-2.5 font-bold text-gray-900 uppercase tracking-widest">Rate</th>
                <th className="text-right px-4 py-2.5 font-bold text-gray-900 uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody>
              {cs.trips_list.map((t, i) => (
                <tr key={t.id}
                  className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-slate-50/40'} hover:bg-indigo-50/30 transition-colors`}>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap tabular-nums">
                    {t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{t.pipeName}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="font-bold text-gray-900">
                      {t.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{t.vendor || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{t.vehicleNo || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                    <div>{t.driverName || '—'}</div>
                    {t.driverContact && <div className="text-gray-400">{t.driverContact}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                    {t.transportRate
                      ? <span>₹{t.transportRate}<span className="text-gray-400 font-normal">/{t.rateType === 'per_trip' ? 'trip' : 'pipe'}</span></span>
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                    {t.totalAmount > 0 ? fmt(t.totalAmount) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-indigo-200 bg-indigo-50">
                <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-gray-900 uppercase tracking-wide">Sub-total</td>
                <td className="px-4 py-2.5 text-center">
                  <span className="text-xs font-extrabold text-gray-900 tabular-nums">{cs.totalPipes}</span>
                </td>
                <td colSpan={4} />
                <td className="px-4 py-2.5 text-right text-sm font-extrabold text-gray-900 tabular-nums">{fmt(cs.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Vendor autocomplete filter ────────────────────────────────────────────────
function VendorFilter({ value, onChange, vendors }: {
  value: string; onChange: (v: string) => void; vendors: string[]
}) {
  const [query, setQuery]   = useState(value)
  const [open,  setOpen]    = useState(false)
  const [cursor, setCursor] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)

  // Sync display text when external value clears
  useEffect(() => { if (!value) setQuery('') }, [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? vendors.filter(v => v.toLowerCase().includes(q)) : vendors
  }, [query, vendors])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function pick(v: string) {
    onChange(v); setQuery(v); setOpen(false); setCursor(-1)
  }
  function clear() {
    onChange(''); setQuery(''); setOpen(false); setCursor(-1)
  }
  function handleKey(e: React.KeyboardEvent) {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); setCursor(0); e.preventDefault() } return }
    if (e.key === 'ArrowDown') { setCursor(c => Math.min(c + 1, filtered.length - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setCursor(c => Math.max(c - 1, 0));                   e.preventDefault() }
    if (e.key === 'Enter' && cursor >= 0) { pick(filtered[cursor]); e.preventDefault() }
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  return (
    <div className="relative w-52" ref={ref}>
      <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
      <input
        type="text"
        value={query}
        placeholder="All Vendors"
        onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); if (!e.target.value) onChange('') }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        autoComplete="off"
        className="w-full pl-8 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white shadow-sm"
      />
      {value
        ? <button onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>
        : <ChevronDown size={13} className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      }
      {open && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto z-50">
          {/* "All vendors" clear option */}
          <li
            onMouseDown={e => { e.preventDefault(); clear() }}
            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 ${!value ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Building2 size={13} className="opacity-50" />
            All Vendors
          </li>
          {filtered.length > 0 && <li className="h-px bg-gray-100 mx-3" />}
          {filtered.map((v, i) => (
            <li key={v}
              onMouseDown={e => { e.preventDefault(); pick(v) }}
              onMouseEnter={() => setCursor(i)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${i === cursor ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : value.toLowerCase() === v.toLowerCase() ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-700 hover:bg-violet-50/60'}`}>
              {v}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400 italic">No vendors match</li>
          )}
        </ul>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransportReportPage() {
  const navigate = useNavigate()
  const today    = new Date()

  const [from, setFrom]           = useState(() => { const d = new Date(today); d.setDate(d.getDate() - 29); return isoDate(d) })
  const [to, setTo]               = useState(() => isoDate(today))
  const [search, setSearch]       = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set())
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'vendor' | 'customer' | 'trips'>('vendor')

  const queryClient = useQueryClient()

  // Edit modal state
  const [editTrip, setEditTrip]     = useState<Trip | null>(null)
  const [editForm, setEditForm]     = useState<Partial<Trip>>({})

  function openEdit(t: Trip, e: React.MouseEvent) {
    e.stopPropagation()
    setEditForm({ ...t })
    setEditTrip(t)
  }
  function closeEdit() { setEditTrip(null); setEditForm({}) }
  function setEF(k: keyof Trip, v: string | number) {
    setEditForm(prev => ({ ...prev, [k]: v }))
  }

  const updateMutation = useMutation({
    mutationFn: (data: any) => loadingRecordApi.update(editTrip!.id, data),
    onSuccess: () => {
      toast.success('Record updated')
      queryClient.invalidateQueries({ queryKey: ['loading-records'] })
      closeEdit()
    },
    onError: () => toast.error('Failed to update record'),
  })

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateMutation.mutate({
      date:          editForm.date,
      pipeName:      editForm.pipeName,
      quantity:      Number(editForm.quantity),
      vehicleNo:     editForm.vehicleNo,
      driverName:    editForm.driverName,
      driverContact: editForm.driverContact,
      vendor:        editForm.vendor,
      siteAddress:   editForm.siteAddress,
      transportRate: String(editForm.transportRate ?? ''),
      rateType:      editForm.rateType ?? 'per_pipe',
      notes:         editForm.notes,
    })
  }

  // Expanded trip rows in All Trips table
  const [expandedTrips, setExpandedTrips] = useState<Set<number>>(new Set())
  function toggleTrip(id: number) {
    setExpandedTrips(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Sorting state for the trips table
  type SortKey = 'date' | 'pipeName' | 'quantity' | 'vendor' | 'totalAmount'
  const [sortKey, setSortKey]   = useState<SortKey>('date')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc')

  const { data, isLoading } = useQuery({
    queryKey: ['loading-records', from, to],
    queryFn: () => loadingRecordApi.getAll({ from: from || undefined, to: to || undefined })
      .then(r => r.data.data ?? []),
  })

  // Build enriched trip list with computed totalAmount
  const trips: Trip[] = useMemo(() => {
    const raw: any[] = data ?? []
    return raw.map(r => {
      const rt = r.rateType || 'per_pipe'
      return {
        id:            r.id,
        date:          r.date ?? '',
        pipeName:      r.pipeName ?? '',
        quantity:      r.quantity ?? 0,
        vehicleNo:     r.vehicleNo ?? '',
        driverName:    r.driverName ?? '',
        driverContact: r.driverContact ?? '',
        vendor:        r.vendor ?? '',
        siteAddress:   r.siteAddress ?? '',
        transportRate: r.transportRate ?? '',
        rateType:      rt,
        notes:         r.notes ?? '',
        totalAmount:   computeTotal(r.quantity ?? 0, r.transportRate ?? '0', rt),
      }
    })
  }, [data])

  // Unique vendor list for filter dropdown
  const vendorList = useMemo(() =>
    Array.from(new Set(trips.map(t => t.vendor).filter(Boolean))).sort(),
  [trips])

  // Filtered trips (search + vendor filter)
  const filtered: Trip[] = useMemo(() => {
    const q = search.toLowerCase()
    return trips.filter(t => {
      const matchSearch = !q ||
        t.pipeName.toLowerCase().includes(q)     ||
        t.vehicleNo.toLowerCase().includes(q)    ||
        t.driverName.toLowerCase().includes(q)   ||
        t.vendor.toLowerCase().includes(q)       ||
        t.siteAddress.toLowerCase().includes(q)
      const matchVendor = !vendorFilter || t.vendor.toLowerCase() === vendorFilter.toLowerCase()
      return matchSearch && matchVendor
    })
  }, [trips, search, vendorFilter])

  // Sorted trips
  const sorted: Trip[] = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'date':        cmp = a.date.localeCompare(b.date); break
        case 'pipeName':    cmp = a.pipeName.localeCompare(b.pipeName); break
        case 'quantity':    cmp = a.quantity - b.quantity; break
        case 'vendor':      cmp = a.vendor.localeCompare(b.vendor); break
        case 'totalAmount': cmp = a.totalAmount - b.totalAmount; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown size={12} className="text-gray-300 ml-0.5" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-violet-500 ml-0.5" />
      : <ChevronDown size={12} className="text-violet-500 ml-0.5" />
  }

  // Build vendor summaries
  const vendorSummaries: VendorSummary[] = useMemo(() => {
    const map = new Map<string, VendorSummary>()
    filtered.forEach(t => {
      const key = t.vendor || 'Unknown'
      if (!map.has(key)) {
        map.set(key, { vendor: key, trips: 0, totalPipes: 0, totalAmount: 0, avgRate: 0, vehicles: new Set(), trips_list: [] })
      }
      const vs = map.get(key)!
      vs.trips++
      vs.totalPipes  += t.quantity
      vs.totalAmount += t.totalAmount
      if (t.vehicleNo) vs.vehicles.add(t.vehicleNo)
      vs.trips_list.push(t)
    })
    // Compute avgRate (only per_pipe rows contribute to per-pipe average)
    map.forEach(vs => {
      const perPipeTrips = vs.trips_list.filter(t => t.rateType !== 'per_trip')
      const rateSum = perPipeTrips.reduce((s, t) => s + (parseFloat(t.transportRate || '0') || 0), 0)
      vs.avgRate = perPipeTrips.length > 0 ? rateSum / perPipeTrips.length : 0
      vs.trips_list.sort((a, b) => b.date.localeCompare(a.date))
    })
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [filtered])

  // Grand totals
  const grandTotalPipes    = filtered.reduce((s, t) => s + t.quantity, 0)
  const grandTotalAmount   = filtered.reduce((s, t) => s + t.totalAmount, 0)
  const tripsWithRate      = filtered.filter(t => parseFloat(t.transportRate || '0') > 0).length
  const avgRateOverall     = tripsWithRate > 0
    ? filtered.reduce((s, t) => s + (parseFloat(t.transportRate || '0') || 0), 0) / tripsWithRate
    : 0

  // Build customer summaries (grouped by siteAddress)
  const customerSummaries: CustomerSummary[] = useMemo(() => {
    const map = new Map<string, CustomerSummary>()
    filtered.forEach(t => {
      const key = t.siteAddress || 'Unknown Site'
      if (!map.has(key)) {
        map.set(key, { siteAddress: key, trips: 0, totalPipes: 0, totalAmount: 0, vendors: new Set(), pipeTypes: new Set(), trips_list: [] })
      }
      const cs = map.get(key)!
      cs.trips++
      cs.totalPipes  += t.quantity
      cs.totalAmount += t.totalAmount
      if (t.vendor) cs.vendors.add(t.vendor)
      if (t.pipeName) cs.pipeTypes.add(t.pipeName)
      cs.trips_list.push(t)
    })
    map.forEach(cs => cs.trips_list.sort((a, b) => b.date.localeCompare(a.date)))
    return Array.from(map.values()).sort((a, b) => b.totalPipes - a.totalPipes)
  }, [filtered])

  function toggleVendorExpand(v: string) {
    setExpandedVendors(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  function toggleCustomerExpand(k: string) {
    setExpandedCustomers(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  // Auto-expand all cards whenever data refreshes (initial load + date/filter change)
  useEffect(() => {
    setExpandedVendors(new Set(vendorSummaries.map(v => v.vendor)))
  }, [vendorSummaries])

  useEffect(() => {
    setExpandedCustomers(new Set(customerSummaries.map(c => c.siteAddress)))
  }, [customerSummaries])

  function expandAll()   { setExpandedVendors(new Set(vendorSummaries.map(v => v.vendor))) }
  function collapseAll() { setExpandedVendors(new Set()) }
  function expandAllCustomers()   { setExpandedCustomers(new Set(customerSummaries.map(c => c.siteAddress))) }
  function collapseAllCustomers() { setExpandedCustomers(new Set()) }

  // ── Export helpers ──────────────────────────────────────────────────────────

  const downloadRef = useRef<HTMLDivElement>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) setDownloadOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function dateRange() {
    if (from && to) return `${dmy(from)}_to_${dmy(to)}`.replace(/\//g, '-')
    return format(new Date(), 'dd-MM-yyyy')
  }

  // Rows for All Trips sheet
  function tripRows(list: Trip[]) {
    return list.map(t => ({
      'Date':              dmy(t.date),
      'Pipe Name':         t.pipeName,
      'Quantity':          t.quantity,
      'Vehicle No':        t.vehicleNo || '',
      'Driver Name':       t.driverName || '',
      'Driver Contact':    t.driverContact || '',
      'Vendor':            t.vendor || '',
      'Site Address':      t.siteAddress || '',
      'Transport Rate (₹)': t.transportRate || '',
      'Rate Type':         t.rateType === 'per_trip' ? 'Per Trip' : 'Per Pipe',
      'Total Amount (₹)':  t.totalAmount > 0 ? t.totalAmount : '',
    }))
  }

  function buildXLSX(): XLSX.WorkBook {
    const wb = XLSX.utils.book_new()

    if (activeTab === 'vendor') {
      // Sheet 1: Vendor Summary
      const summary = vendorSummaries.map(vs => ({
        'Vendor':            vs.vendor,
        'Trips':             vs.trips,
        'Total Pipes':       vs.totalPipes,
        'Avg Rate/Pipe (₹)': vs.avgRate > 0 ? +vs.avgRate.toFixed(2) : '',
        'Total Amount (₹)':  +vs.totalAmount.toFixed(2),
        'Vehicles':          Array.from(vs.vehicles).join(', '),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Vendor Summary')
      // Sheet 2: Trip Details
      const details = vendorSummaries.flatMap(vs => tripRows(vs.trips_list))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(details), 'Trip Details')

    } else if (activeTab === 'customer') {
      // Sheet 1: Customer/Site Summary
      const summary = customerSummaries.map(cs => ({
        'Site Address':     cs.siteAddress,
        'Trips':            cs.trips,
        'Total Pipes':      cs.totalPipes,
        'Total Amount (₹)': +cs.totalAmount.toFixed(2),
        'Vendors':          Array.from(cs.vendors).join(', '),
        'Pipe Types':       Array.from(cs.pipeTypes).join(', '),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Customer Summary')
      // Sheet 2: Trip Details
      const details = customerSummaries.flatMap(cs => tripRows(cs.trips_list))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(details), 'Trip Details')

    } else {
      // All Trips
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tripRows(sorted)), 'All Trips')
    }

    return wb
  }

  function handleDownloadXLSX() {
    const label = activeTab === 'vendor' ? 'By_Vendor' : activeTab === 'customer' ? 'By_Customer' : 'All_Trips'
    XLSX.writeFile(buildXLSX(), `Transport_Report_${label}_${dateRange()}.xlsx`)
    setDownloadOpen(false)
  }

  function handleDownloadCSV() {
    let rows: Record<string, any>[]
    let label: string

    if (activeTab === 'vendor') {
      rows = vendorSummaries.map(vs => ({
        'Vendor': vs.vendor, 'Trips': vs.trips, 'Total Pipes': vs.totalPipes,
        'Avg Rate/Pipe (₹)': vs.avgRate > 0 ? +vs.avgRate.toFixed(2) : '',
        'Total Amount (₹)': +vs.totalAmount.toFixed(2), 'Vehicles': Array.from(vs.vehicles).join(' | '),
      }))
      label = 'By_Vendor'
    } else if (activeTab === 'customer') {
      rows = customerSummaries.map(cs => ({
        'Site Address': cs.siteAddress, 'Trips': cs.trips, 'Total Pipes': cs.totalPipes,
        'Total Amount (₹)': +cs.totalAmount.toFixed(2),
        'Vendors': Array.from(cs.vendors).join(' | '), 'Pipe Types': Array.from(cs.pipeTypes).join(' | '),
      }))
      label = 'By_Customer'
    } else {
      rows = tripRows(sorted)
      label = 'All_Trips'
    }

    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const v = String(r[h] ?? '')
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `Transport_Report_${label}_${dateRange()}.csv`
    a.click(); URL.revokeObjectURL(url)
    setDownloadOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(124,58,237,0.28)]">

        {/* Title row */}
        <div className="relative flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/business')}
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0">
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <FileBarChart2 size={22} className="text-violet-200" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business · Reports</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Transport Report</h1>
              <p className="text-sm text-blue-200 mt-0.5">Vendor-wise transport payment summary &amp; trip details</p>
            </div>
          </div>

          {/* Export dropdown — amber style */}
          <div className="relative" ref={downloadRef}>
            <button
              onClick={() => setDownloadOpen(v => !v)}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm"
            >
              <FileDown size={13} />
              Export CSV
              <ChevronDown size={11} className={`transition-transform ${downloadOpen ? 'rotate-180' : ''}`} />
            </button>
            {downloadOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 w-48 py-1.5 overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {activeTab === 'vendor' ? 'Transporter' : activeTab === 'customer' ? 'Customer' : 'All Trips'} · {filtered.length} rows
                </div>
                <button
                  onClick={handleDownloadXLSX}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                >
                  <span className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-[10px] flex-shrink-0">XL</span>
                  Download Excel
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                >
                  <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[10px] flex-shrink-0">CSV</span>
                  Download CSV
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs + date filter strip */}
        <div className="relative flex items-center justify-between gap-3 px-6 pb-4">
          {/* Tab toggle */}
          <div className="flex gap-1 bg-white/10 rounded-xl p-1 backdrop-blur-sm">
            {([
              { key: 'vendor',   label: 'Transporter',   icon: <Building2 size={13} /> },
              { key: 'customer', label: 'Customer',  icon: <MapPin size={13} /> },
              { key: 'trips',    label: 'All Trips',    icon: <Truck size={13} /> },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Date filters */}
          <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          {[
            { label: 'Total Trips',     value: filtered.length.toLocaleString(),                                    icon: <Truck size={14} />,       warn: false },
            { label: 'Total Pipes',     value: grandTotalPipes.toLocaleString(),                                    icon: <Package size={14} />,     warn: false },
            { label: 'Total Payable',   value: fmt(grandTotalAmount),                                               icon: <IndianRupee size={14} />, warn: grandTotalAmount > 0 },
            { label: 'Avg Rate / Pipe', value: avgRateOverall > 0 ? `₹${avgRateOverall.toFixed(2)}` : '—',         icon: <TrendingUp size={14} />,  warn: false },
          ].map(s => (
            <div key={s.label} className="px-6 py-3.5">
              <p className={`text-xl font-extrabold tabular-nums leading-none ${s.warn ? 'text-amber-300' : 'text-white'}`}>{s.value}</p>
              <p className="text-[11px] text-blue-200 mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Search + Vendor filter ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search pipe, vehicle, driver, site…"
            className="w-full pl-8 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white shadow-sm" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Vendor filter */}
        <VendorFilter value={vendorFilter} onChange={setVendorFilter} vendors={vendorList} />
      </div>

      {/* ── Loading state ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl shadow" />)}
        </div>
      )}

      {/* ── Vendor view ───────────────────────────────────────────────── */}
      {!isLoading && activeTab === 'vendor' && (
        <div className="space-y-4">

          {vendorSummaries.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">No transport records found for the selected filters</div>
          ) : (
            <>
              {/* Expand / collapse all */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">
                  {vendorSummaries.length} vendor{vendorSummaries.length !== 1 ? 's' : ''} ·
                  {' '}{filtered.length} trip{filtered.length !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button onClick={expandAll}
                    className="text-xs text-violet-600 hover:text-violet-700 font-semibold px-3 py-1 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors">
                    Expand All
                  </button>
                  <button onClick={collapseAll}
                    className="text-xs text-gray-500 hover:text-gray-700 font-semibold px-3 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Vendor cards */}
              {vendorSummaries.map(vs => (
                <VendorCard
                  key={vs.vendor}
                  vs={vs}
                  expanded={expandedVendors.has(vs.vendor)}
                  onToggle={() => toggleVendorExpand(vs.vendor)}
                />
              ))}

              {/* Grand total footer */}
              <div className="bg-gradient-to-r from-violet-400 to-indigo-400 rounded-2xl px-6 py-4 flex items-center justify-between shadow-[0_4px_20px_rgba(124,58,237,0.30)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <IndianRupee size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-violet-100 uppercase tracking-widest">Grand Total Payable</p>
                    <p className="text-sm text-white/80 mt-0.5">{filtered.length} trips · {grandTotalPipes.toLocaleString()} pipes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-white tabular-nums tracking-tight">{fmt(grandTotalAmount)}</p>
                  <p className="text-xs text-violet-100 mt-0.5">across {vendorSummaries.length} vendor{vendorSummaries.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Customer view ─────────────────────────────────────────── */}
      {!isLoading && activeTab === 'customer' && (
        <div className="space-y-4">
          {customerSummaries.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">No transport records found for the selected filters</div>
          ) : (
            <>
              {/* Expand / collapse all */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">
                  {customerSummaries.length} site{customerSummaries.length !== 1 ? 's' : ''} ·
                  {' '}{filtered.length} trip{filtered.length !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button onClick={expandAllCustomers}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold px-3 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                    Expand All
                  </button>
                  <button onClick={collapseAllCustomers}
                    className="text-xs text-gray-500 hover:text-gray-700 font-semibold px-3 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Customer cards */}
              {customerSummaries.map(cs => (
                <CustomerCard
                  key={cs.siteAddress}
                  cs={cs}
                  expanded={expandedCustomers.has(cs.siteAddress)}
                  onToggle={() => toggleCustomerExpand(cs.siteAddress)}
                />
              ))}

              {/* Grand total footer */}
              <div className="bg-gradient-to-r from-indigo-400 to-violet-400 rounded-2xl px-6 py-4 flex items-center justify-between shadow-[0_4px_20px_rgba(79,70,229,0.30)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <MapPin size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-indigo-100 uppercase tracking-widest">Grand Total Delivered</p>
                    <p className="text-sm text-white/80 mt-0.5">{filtered.length} trips · {grandTotalPipes.toLocaleString()} pipes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-white tabular-nums tracking-tight">{fmt(grandTotalAmount)}</p>
                  <p className="text-xs text-indigo-100 mt-0.5">across {customerSummaries.length} site{customerSummaries.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── All Trips view ────────────────────────────────────────────── */}
      {!isLoading && activeTab === 'trips' && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(124,58,237,0.10),0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-violet-100">

          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-400 to-indigo-400">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Truck size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">All Transport Trips</h2>
                <p className="text-xs text-violet-100 mt-0.5">{sorted.length} trip{sorted.length !== 1 ? 's' : ''} · {fmt(grandTotalAmount)} total · <span className="opacity-75">click row for details</span></p>
              </div>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No trips found for the selected filters</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe'}}>
                    {/* expand toggle col */}
                    <th className="w-8 px-2 py-3" />
                    {[
                      { key: 'date',        label: 'Date' },
                      { key: 'pipeName',    label: 'Pipe Name' },
                      { key: 'quantity',    label: 'Qty' },
                      { key: null,          label: 'Vehicle No' },
                      { key: null,          label: 'Driver' },
                      { key: 'vendor',      label: 'Vendor' },
                      { key: null,          label: 'Site Address' },
                      { key: null,          label: 'Rate' },
                      { key: 'totalAmount', label: 'Amount' },
                    ].map(col => (
                      <th key={col.label}
                        onClick={col.key ? () => toggleSort(col.key as SortKey) : undefined}
                        className={`text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-violet-600 select-none' : ''}`}
                        style={{color:'#1f2937'}}>
                        <span className="inline-flex items-center gap-0.5">
                          {col.label}
                          {col.key && <SortIcon k={col.key as SortKey} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t, idx) => {
                    const isExp = expandedTrips.has(t.id)
                    const rowBg = idx % 2 === 0 ? '' : 'bg-slate-50/40'
                    return (
                      <>
                        {/* ── Main clickable row ── */}
                        <tr
                          key={`row-${t.id}`}
                          onClick={() => toggleTrip(t.id)}
                          className={`border-t border-gray-100 cursor-pointer transition-colors select-none ${
                            isExp ? 'bg-violet-50/70' : `${rowBg} hover:bg-violet-50/40`
                          }`}
                        >
                          {/* expand chevron */}
                          <td className="w-8 px-2 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md transition-all ${
                              isExp
                                ? 'bg-violet-600 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-violet-100 hover:text-violet-500'
                            }`}>
                              {isExp ? <ChevronUp size={12} /> : <ChevronRight size={12} />}
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-medium tabular-nums">
                            {t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{t.pipeName || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-gray-900">
                              {t.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.vehicleNo || '—'}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <User size={12} className="text-gray-400 flex-shrink-0" />
                              <span>{t.driverName || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 size={12} className="text-violet-400 flex-shrink-0" />
                              <span className="text-gray-700 font-medium">{t.vendor || '—'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                            <span className="flex items-center gap-1.5" title={t.siteAddress}>
                              <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate">{t.siteAddress || '—'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap tabular-nums">
                            {t.transportRate
                              ? <span>₹{t.transportRate}<span className="ml-1 text-[10px] text-gray-400">{t.rateType === 'per_trip' ? '/trip' : '/pipe'}</span></span>
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {t.totalAmount > 0
                              ? <span className="font-bold text-gray-900 tabular-nums">{fmt(t.totalAmount)}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {isExp && (
                          <tr key={`detail-${t.id}`} className="border-t border-violet-100">
                            <td colSpan={11} className="p-0">
                              <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border-b-2 border-violet-200 px-8 py-4">
                                <div className="flex items-start gap-6">
                                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">

                                    <div>
                                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">Driver Contact</p>
                                      <span className="flex items-center gap-1.5 text-sm text-gray-700">
                                        <Phone size={13} className="text-violet-400 flex-shrink-0" />
                                        {t.driverContact || <span className="text-gray-300">—</span>}
                                      </span>
                                    </div>

                                    <div className="lg:col-span-2">
                                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">Full Site / Delivery Address</p>
                                      <span className="flex items-start gap-1.5 text-sm text-gray-700">
                                        <MapPin size={13} className="text-violet-400 flex-shrink-0 mt-0.5" />
                                        {t.siteAddress || <span className="text-gray-300">—</span>}
                                      </span>
                                    </div>

                                    <div>
                                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">Amount Breakdown</p>
                                      <p className="text-sm text-gray-700 tabular-nums">
                                        {t.rateType === 'per_trip'
                                          ? <span>Fixed trip rate</span>
                                          : <span>{t.quantity} pipes × ₹{t.transportRate || 0}</span>
                                        }
                                      </p>
                                      <p className="text-base font-extrabold text-gray-900 tabular-nums mt-0.5">
                                        = {t.totalAmount > 0 ? fmt(t.totalAmount) : '—'}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">Notes</p>
                                      <p className="text-sm text-gray-600 italic leading-relaxed">
                                        {t.notes || <span className="text-gray-300 not-italic">No notes</span>}
                                      </p>
                                    </div>

                                  </div>

                                  {/* Edit button */}
                                  <button
                                    onClick={(e) => openEdit(t, e)}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-violet-700 bg-white border border-violet-200 rounded-xl hover:bg-violet-600 hover:text-white hover:border-violet-600 shadow-sm transition-all active:scale-95"
                                  >
                                    <Pencil size={13} />
                                    Edit Record
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-violet-200 bg-violet-50">
                    <td />
                    <td className="px-4 py-3 text-xs font-bold text-gray-900 uppercase tracking-wide">Total</td>
                    <td />
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-extrabold text-gray-900 tabular-nums">
                        {grandTotalPipes.toLocaleString()}
                      </span>
                    </td>
                    <td colSpan={5} />
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-extrabold text-gray-900 tabular-nums">{fmt(grandTotalAmount)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Record Modal ─────────────────────────────────────────── */}
      {editTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEdit} />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-400 to-indigo-400">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <Pencil size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Edit Loading Record</h2>
                  <p className="text-xs text-violet-100 mt-0.5">
                    {editTrip.pipeName} · {editTrip.date ? format(new Date(editTrip.date), 'dd/MM/yyyy') : ''}
                  </p>
                </div>
              </div>
              <button onClick={closeEdit}
                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                <X size={15} className="text-white" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">

              {/* Date + Qty + Vehicle */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
                  <input required type="date" value={editForm.date ?? ''}
                    onChange={e => setEF('date', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Qty</label>
                  <input required type="number" min="1" value={editForm.quantity ?? ''}
                    onChange={e => setEF('quantity', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vehicle No</label>
                  <input type="text" value={editForm.vehicleNo ?? ''}
                    onChange={e => setEF('vehicleNo', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>

              {/* Pipe Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Pipe Name</label>
                <input required type="text" value={editForm.pipeName ?? ''}
                  onChange={e => setEF('pipeName', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>

              {/* ── Transport Rate — highlighted primary field ── */}
              <div className="rounded-xl border-2 border-violet-200 bg-violet-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Transport Rate
                  </label>
                  {/* Per Pipe / Per Trip toggle */}
                  <div className="flex items-center bg-white border border-violet-200 rounded-lg p-0.5 gap-0.5">
                    {(['per_pipe', 'per_trip'] as const).map(rt => (
                      <button
                        key={rt}
                        type="button"
                        onClick={() => setEF('rateType', rt)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                          (editForm.rateType ?? 'per_pipe') === rt
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-violet-600'
                        }`}
                      >
                        {rt === 'per_pipe' ? '₹ / Pipe' : '₹ / Trip'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-violet-400">₹</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={editForm.transportRate ?? ''}
                    onChange={e => setEF('transportRate', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-violet-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white font-semibold text-gray-800"
                    autoFocus
                  />
                </div>
                {Number(editForm.transportRate ?? 0) > 0 && (
                  <p className="text-xs text-gray-900 tabular-nums font-medium">
                    {(editForm.rateType ?? 'per_pipe') === 'per_trip'
                      ? <>Trip total = <span className="font-extrabold text-gray-900">{fmt(parseFloat(String(editForm.transportRate ?? '') || '0'))}</span></>
                      : <>{Number(editForm.quantity ?? 0)} pipes × ₹{editForm.transportRate} = <span className="font-extrabold text-gray-900">{fmt(Number(editForm.quantity ?? 0) * parseFloat(String(editForm.transportRate ?? '') || '0'))}</span></>
                    }
                  </p>
                )}
              </div>

              <div className="border-t border-dashed border-gray-100" />

              {/* Vendor */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vendor / Transporter</label>
                <input type="text" value={editForm.vendor ?? ''}
                  onChange={e => setEF('vendor', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>

              {/* Driver */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Driver Name</label>
                  <input type="text" value={editForm.driverName ?? ''}
                    onChange={e => setEF('driverName', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Driver Contact</label>
                  <input type="tel" value={editForm.driverContact ?? ''}
                    onChange={e => setEF('driverContact', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>

              {/* Site Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Site / Delivery Address</label>
                <input type="text" value={editForm.siteAddress ?? ''}
                  onChange={e => setEF('siteAddress', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="text-gray-300 normal-case font-normal">(optional)</span>
                </label>
                <textarea rows={2} value={editForm.notes ?? ''}
                  onChange={e => setEF('notes', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1 sticky bottom-0 bg-white pb-1">
                <button type="button" onClick={closeEdit}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-500 rounded-xl hover:from-violet-700 hover:to-indigo-600 shadow-md transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  <Save size={15} />
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
