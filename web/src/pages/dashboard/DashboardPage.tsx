import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi, productionOrderApi, pipeConfigApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import {
  Package, Layers, Weight, AlertTriangle, GitBranch,
  Calendar, ChevronDown, X, CheckCircle2,
} from 'lucide-react'
import DiameterHeatmap from '@/components/DiameterHeatmap'

function fmt(n: any, decimals = 2) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '0'
  return v % 1 === 0 ? v.toLocaleString('en-IN') : parseFloat(v.toFixed(decimals)).toLocaleString('en-IN')
}

function extractDiameter(name: string): string {
  const match = name.match(/(\d{3,4})\s*mm/i) || name.match(/\b(\d{3,4})\b/)
  return match ? `${match[1]} mm` : name
}

// ── Card header ──────────────────────────────────────────────────────────────

function CardHeader({
  icon, accent, title, subtitle, right,
}: {
  icon: React.ReactNode
  accent: string
  title: string
  subtitle: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-400 to-blue-400">
      <div className="flex items-center gap-3.5">
        <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
          <p className="text-xs text-blue-100 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {right && <div className="text-right">{right}</div>}
    </div>
  )
}


function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr style={{ background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)', borderBottom: '1px solid #dbeafe', color: '#1f2937' }}>{children}</tr>
    </thead>
  )
}

const TH_LEFT  = 'px-6 py-3 text-left   text-[11px] font-bold uppercase tracking-widest'
const TH_RIGHT = 'px-6 py-3 text-right  text-[11px] font-bold uppercase tracking-widest'
const TH_CTR   = 'px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest'

// ── Date filter ───────────────────────────────────────────────────────────────

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

type PresetKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom'

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
    default:             return { from: '', to: '' }
  }
}

function DateRangePicker({
  fromDate, toDate, onChange,
}: {
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
      {/* White-on-dark button — designed for the gradient hero */}
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
                    onChange={e => { set(e.target.value); setPreset('custom') }}
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { outletId } = useAuthStore()
  const effectiveOutletId = outletId ?? 1

  // Date filter state (applies to Intermediate Stock)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory', 'all', effectiveOutletId],
    queryFn: () => inventoryApi.getAllByOutlet(effectiveOutletId, undefined, 0, 500).then(r => {
      const d = r.data.data
      return Array.isArray(d) ? d : (d?.content ?? d?.items ?? [])
    }),
  })

  // ── Shell Plates ──────────────────────────────────────────────────────────
  const shellPlates = useMemo(() =>
    (inventory as any[]).filter((inv: any) =>
      inv.product?.name?.toLowerCase().includes('sheet')
    ), [inventory])

  const shellTotalQty    = shellPlates.reduce((s: number, i: any) => s + parseFloat(i.quantityOnHand ?? 0), 0)
  const shellTotalWeight = shellTotalQty

  // ── MS Flat ───────────────────────────────────────────────────────────────
  const msFlat = useMemo(() =>
    (inventory as any[]).filter((inv: any) =>
      inv.product?.name?.toLowerCase().includes('flat') ||
      inv.product?.name?.toLowerCase().includes('ms flat')
    ), [inventory])

  const msFlatTotalWeight = msFlat.reduce((s: number, i: any) => s + parseFloat(i.quantityOnHand ?? 0), 0)

  // ── Intermediate Stock (date-filterable) ──────────────────────────────────
  const { data: intermediateStock = [], isLoading: stockLoading } = useQuery({
    queryKey: ['intermediate-stock', fromDate, toDate],
    queryFn: () => productionOrderApi.getIntermediateStock({
      fromDate: fromDate || undefined,
      toDate:   toDate   || undefined,
    }).then(r => r.data.data ?? []),
  })

  const grandCuring1      = (intermediateStock as any[]).reduce((s, r) => s + r.curing1,       0)
  const grandCuring2      = (intermediateStock as any[]).reduce((s, r) => s + r.curing2,       0)
  const grandFinalTesting = (intermediateStock as any[]).reduce((s, r) => s + r.finalTesting,  0)
  const grandTotal        = (intermediateStock as any[]).reduce((s, r) => s + r.total,         0)

  // ── All Stages Stock (date-filterable) ────────────────────────────────────
  const { data: allStagesStock = [], isLoading: allStagesLoading } = useQuery({
    queryKey: ['all-stages-stock', fromDate, toDate],
    queryFn: () => productionOrderApi.getAllStagesStock({
      fromDate: fromDate || undefined,
      toDate:   toDate   || undefined,
    }).then(r => r.data.data ?? []),
  })

  const ALL_STAGES = [
    { key: 'fabrication',        label: 'Fabrication',    color: 'text-slate-600'   },
    { key: 'fabricationTesting', label: 'Fab. Testing',   color: 'text-purple-600'  },
    { key: 'moulding',           label: 'Moulding',       color: 'text-pink-600'    },
    { key: 'spinning',           label: 'Spinning',       color: 'text-rose-600'    },
    { key: 'demoulding',         label: 'Demoulding',     color: 'text-orange-600'  },
    { key: 'curing1',            label: 'Curing 1',       color: 'text-cyan-600'    },
    { key: 'curing2',            label: 'Curing 2',       color: 'text-sky-600'     },
    { key: 'winding',            label: 'Winding',        color: 'text-indigo-600'  },
    { key: 'coating',            label: 'Coating',        color: 'text-teal-600'    },
    { key: 'finalTesting',       label: 'Final Testing',  color: 'text-emerald-600' },
  ] as const

  const allStagesTotal = (allStagesStock as any[]).reduce((s: number, r: any) => s + r.total, 0)

  // ── Pipe configs — for name resolution in both live and dummy rows ─────────
  const { data: pipeConfigsRaw = [] } = useQuery({
    queryKey: ['pipe-configs-dashboard'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 100 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const pipeConfigs: { id: number; name: string; diameterMm: number; pressureClass: string }[] =
    pipeConfigsRaw as any[]

  // id → config lookup for live rows
  const pipeConfigMap = useMemo(() =>
    new Map(pipeConfigs.map(c => [c.id, c])),
  [pipeConfigs])

  // ── Dummy data for all dashboard tables ───────────────────────────────────

  const MSFLAT_DUMMY = [
    { name: 'MS Flat 6 MM',  weight: 4500 },
    { name: 'MS Flat 8 MM',  weight: 3100 },
    { name: 'MS Flat 10 MM', weight: 6800 },
  ]

  const SHELL_DUMMY = [
    { name: '1.6 MM Sheet 350',  qty: 28  },
    { name: '1.6 MM Sheet 400',  qty: 35  },
    { name: '1.6 MM Sheet 500',  qty: 42  },
    { name: '1.6 MM Sheet 600',  qty: 31  },
    { name: '1.6 MM Sheet 800',  qty: 24  },
    { name: '1.6 MM Sheet 1000', qty: 18  },
    { name: '1.6 MM Sheet 1200', qty: 12  },
    { name: '1.6 MM Sheet 1400', qty: 8   },
  ]

  // Use real pipe configs if available, otherwise fall back to hardcoded names
  const FALLBACK_PIPES = [
    { id: -1, name: 'PCCP 300mm PN3.15', diameterMm: 300, pressureClass: 'PN3.15' },
    { id: -2, name: 'PCCP 400mm PN4',    diameterMm: 400, pressureClass: 'PN4'    },
    { id: -3, name: 'PCCP 500mm PN3.15', diameterMm: 500, pressureClass: 'PN3.15' },
    { id: -4, name: 'PCCP 600mm PN4',    diameterMm: 600, pressureClass: 'PN4'    },
    { id: -5, name: 'PCCP 800mm PN3.15', diameterMm: 800, pressureClass: 'PN3.15' },
  ]
  const dummyPipes = pipeConfigs.length > 0 ? pipeConfigs.slice(0, 5) : FALLBACK_PIPES

  const DUMMY_COUNTS_INTERMEDIATE = [
    { curing1: 24, curing2: 18, finalTesting: 12 },
    { curing1: 36, curing2: 28, finalTesting: 20 },
    { curing1: 18, curing2: 14, finalTesting: 8  },
    { curing1: 12, curing2: 8,  finalTesting: 6  },
    { curing1: 8,  curing2: 6,  finalTesting: 4  },
  ]
  const DUMMY_COUNTS_STAGES = [
    { fabrication:120, fabricationTesting:118, moulding:110, spinning:105, demoulding:98,  curing1:24, winding:90, coating:82, curing2:18, finalTesting:12 },
    { fabrication:180, fabricationTesting:176, moulding:168, spinning:162, demoulding:150, curing1:36, winding:140,coating:128,curing2:28, finalTesting:20 },
    { fabrication:96,  fabricationTesting:94,  moulding:88,  spinning:84,  demoulding:78,  curing1:18, winding:72, coating:64, curing2:14, finalTesting:8  },
    { fabrication:72,  fabricationTesting:70,  moulding:64,  spinning:60,  demoulding:56,  curing1:12, winding:50, coating:44, curing2:8,  finalTesting:6  },
    { fabrication:48,  fabricationTesting:46,  moulding:42,  spinning:40,  demoulding:36,  curing1:8,  winding:32, coating:28, curing2:6,  finalTesting:4  },
  ]

  const INTERMEDIATE_DUMMY = dummyPipes.map((p, i) => ({
    name: p.name, dia: `${p.diameterMm}mm`, pc: p.pressureClass,
    ...(DUMMY_COUNTS_INTERMEDIATE[i] ?? DUMMY_COUNTS_INTERMEDIATE[0]),
  }))

  const ALL_STAGES_DUMMY = dummyPipes.map((p, i) => ({
    name: p.name, dia: `${p.diameterMm}mm`, pc: p.pressureClass,
    ...(DUMMY_COUNTS_STAGES[i] ?? DUMMY_COUNTS_STAGES[0]),
  }))

  // ── Reorder Level ─────────────────────────────────────────────────────────

  // Dummy reorder data with real thresholds
  const REORDER_DUMMY = [
    { name: '4 MM Winding Wire',    onHand: 8.2,  threshold: 15,  uom: 'ton'  },
    { name: 'MS Flat 6 MM',         onHand: 4.5,  threshold: 10,  uom: 'ton'  },
    { name: 'MS Flat 8 MM',         onHand: 3.1,  threshold: 10,  uom: 'ton'  },
    { name: 'MS Flat 10 MM',        onHand: 6.8,  threshold: 10,  uom: 'ton'  },
    { name: 'Cement Bags',          onHand: 180,  threshold: 250, uom: 'bags' },
    { name: 'Silo Cement (Silo 1+2)', onHand: 52.3, threshold: 80, uom: 'ton' },
    { name: 'Silo Cement (Silo 3)', onHand: 22.1, threshold: 40,  uom: 'ton'  },
  ]

  const reorderItems = useMemo(() => {
    const fromApi = (inventory as any[])
      .filter((inv: any) =>
        inv.product?.itemType === 'RAW_MATERIAL' &&
        parseFloat(inv.quantityOnHand ?? 0) <= (inv.reorderLevel ?? 10)
      )
      .sort((a: any, b: any) => {
        const gapA = (a.reorderLevel ?? 10) - parseFloat(a.quantityOnHand ?? 0)
        const gapB = (b.reorderLevel ?? 10) - parseFloat(b.quantityOnHand ?? 0)
        return gapB - gapA
      })
    return fromApi.length > 0 ? fromApi : null   // null = use dummy
  }, [inventory])

  const hasDateFilter = fromDate || toDate

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(109,40,217,0.35)]">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 w-72 h-32 rounded-full bg-blue-400/10 blur-3xl" />
        {/* dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        <div className="relative flex items-center justify-between px-8 py-4">
          {/* left — title block */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <Layers size={20} className="text-amber-300" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">Dashboard</h1>
              <p className="text-xs text-blue-200">Raw material &amp; production stock</p>
            </div>
          </div>

          {/* right — stat strips + date filter inline */}
          <div className="flex items-center divide-x divide-white/10">
            {[
              { label: 'Shell Plate Items',    value: fmt(shellTotalWeight),          sub: 'kg total weight',   anchor: 'section-shell',        warn: false },
              { label: 'MS Flat Total Weight', value: fmt(msFlatTotalWeight),         sub: 'kg on hand',        anchor: 'section-msflat',       warn: false },
              { label: 'Pipes in Stages',      value: grandTotal.toLocaleString(),    sub: 'intermediate stock',anchor: 'section-intermediate', warn: false },
              { label: 'Reorder Alerts',       value: (reorderItems ?? REORDER_DUMMY).length.toString(), sub: (reorderItems ?? REORDER_DUMMY).length === 1 ? 'material low' : 'materials low', anchor: 'section-reorder', warn: (reorderItems ?? REORDER_DUMMY).length > 0 },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => document.getElementById(s.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-5 py-1 text-left hover:bg-white/5 transition-colors group cursor-pointer"
              >
                <p className={`text-xl font-extrabold tabular-nums leading-none ${s.warn ? 'text-red-300' : 'text-white'}`}>
                  {s.value}
                </p>
                <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
                <p className="text-[10px] text-white/40 mt-0.5 group-hover:text-white/60 transition-colors">{s.sub} ↓</p>
              </button>
            ))}

            <div className="flex items-center gap-2 pl-5">
              {hasDateFilter && (
                <span className="text-xs text-white bg-white/10 border border-white/20 px-2.5 py-1 rounded-full font-medium backdrop-blur-sm">
                  Filtered: {fromDate || '…'} → {toDate || '…'}
                </span>
              )}
              <DateRangePicker
                fromDate={fromDate}
                toDate={toDate}
                onChange={(f, t) => { setFromDate(f); setToDate(t) }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Diameter Heatmap ─────────────────────────────────────────────── */}
      <DiameterHeatmap
        liveRows={(intermediateStock as any[]).map((r: any) => ({
          pipeName: r.pipeName ?? r.name ?? '',
          finalTesting: r.finalTesting ?? 0,
        }))}
        pipeConfigs={pipeConfigs}
        showLink
        light
      />

      {/* ── Row 1: MS Flat + Reorder Alerts ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6 items-start">

        {/* MS Flat */}
        <div id="section-msflat" className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden ring-1 ring-gray-100 scroll-mt-6">
          <CardHeader
            icon={<Weight size={18} className="text-amber-400" />}
            accent="bg-white/10"
            title="MS Flat"
            subtitle={`${msFlat.length || MSFLAT_DUMMY.length} item${(msFlat.length || MSFLAT_DUMMY.length) !== 1 ? 's' : ''}`}
            right={(
              <div>
                <p className="text-xs text-blue-100">Total Weight</p>
                <p className="text-sm font-bold text-white tabular-nums">
                  {fmt(msFlat.length > 0 ? msFlatTotalWeight : MSFLAT_DUMMY.reduce((s, r) => s + r.weight, 0))} kg
                </p>
              </div>
            )}
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <ColHeader>
                <th className={TH_LEFT}>Product</th>
                <th className={TH_RIGHT}>Weight (Kg)</th>
              </ColHeader>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-40" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-3 bg-gray-100 rounded w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : msFlat.length === 0 ? (
                  MSFLAT_DUMMY.map((item) => (
                    <tr key={item.name} className="hover:bg-violet-50/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt(item.weight)} kg</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  msFlat.map((inv: any) => {
                    const weight = parseFloat(inv.quantityOnHand ?? 0)
                    return (
                      <tr key={inv.id} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="text-sm font-semibold text-gray-800">{inv.product?.name}</span>
                          {inv.product?.sku && <span className="text-xs text-gray-400 ml-2">{inv.product.sku}</span>}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt(weight)} kg</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-violet-50 border-t-2 border-violet-200">
                  <td className="px-6 py-3 text-xs font-bold text-violet-700 uppercase tracking-widest">Total</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">
                    {fmt(msFlat.length > 0 ? msFlatTotalWeight : MSFLAT_DUMMY.reduce((s, r) => s + r.weight, 0))} kg
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Reorder Level Alerts */}
        <div id="section-reorder" className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden ring-1 ring-gray-100 scroll-mt-6">
          <CardHeader
            icon={<AlertTriangle size={18} className="text-amber-400" />}
            accent="bg-white/10"
            title="Reorder Level Alerts"
            subtitle={`${reorderItems ? reorderItems.length : REORDER_DUMMY.length} raw material${(reorderItems ? reorderItems.length : REORDER_DUMMY.length) !== 1 ? 's' : ''} at or below threshold`}
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <ColHeader>
                <th className={TH_LEFT}>Raw Material</th>
                <th className={TH_RIGHT}>On Hand</th>
                <th className={TH_RIGHT}>Threshold</th>
                <th className={TH_RIGHT}>Shortfall</th>
              </ColHeader>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-40" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-3 bg-gray-100 rounded w-16 ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-3 bg-gray-100 rounded w-16 ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-3 bg-gray-100 rounded w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : reorderItems !== null ? (
                  reorderItems.map((inv: any) => {
                    const qty       = parseFloat(inv.quantityOnHand ?? 0)
                    const threshold = inv.reorderLevel ?? 10
                    const shortfall = Math.max(0, threshold - qty)
                    const pct       = Math.min(100, Math.round((qty / threshold) * 100))
                    const isOut     = qty <= 0
                    const uom       = inv.product?.unitOfMeasure || ''
                    return (
                      <tr key={inv.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="text-sm font-semibold text-gray-800">{inv.product?.name}</span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <span className="text-sm font-bold tabular-nums text-gray-900">
                              {fmt(qty)} <span className="text-xs font-normal text-gray-400">{uom}</span>
                            </span>
                            <div className="w-20 h-1 rounded-full bg-gray-100 overflow-hidden">
                              <div className={`h-full rounded-full ${pct < 30 ? 'bg-red-400' : pct < 70 ? 'bg-orange-400' : 'bg-green-400'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-sm font-semibold text-gray-700 tabular-nums">{fmt(threshold)} <span className="text-xs font-normal text-gray-400">{uom}</span></span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-sm font-bold text-red-600 tabular-nums">−{fmt(shortfall)} <span className="text-xs font-normal">{uom}</span></span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  REORDER_DUMMY.map((item) => {
                    const shortfall = Math.max(0, item.threshold - item.onHand)
                    const pct       = Math.min(100, Math.round((item.onHand / item.threshold) * 100))
                    const isOut     = item.onHand <= 0
                    const kgLabel   = item.uom === 'ton' ? `${(item.onHand * 1000).toLocaleString('en-IN')} kg` : null
                    const threshKg  = item.uom === 'ton' ? `${(item.threshold * 1000).toLocaleString('en-IN')} kg` : null
                    const shortKg   = item.uom === 'ton' ? `${(shortfall * 1000).toLocaleString('en-IN')} kg` : null
                    return (
                      <tr key={item.name} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <span className="text-sm font-bold tabular-nums text-gray-900">
                              {item.onHand} <span className="text-xs font-normal text-gray-400">{item.uom}</span>
                            </span>
                            {kgLabel && <span className="text-[10px] text-gray-400 tabular-nums">{kgLabel}</span>}
                            <div className="w-20 h-1 rounded-full bg-gray-100 overflow-hidden">
                              <div className={`h-full rounded-full ${pct < 30 ? 'bg-red-400' : pct < 70 ? 'bg-orange-400' : 'bg-green-400'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-sm font-semibold text-gray-700 tabular-nums">
                            {item.threshold} <span className="text-xs font-normal text-gray-400">{item.uom}</span>
                          </span>
                          {threshKg && <p className="text-[10px] text-gray-400 tabular-nums">{threshKg}</p>}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-sm font-bold text-red-500 tabular-nums">
                            −{shortfall.toFixed(1)} <span className="text-xs font-normal">{item.uom}</span>
                          </span>
                          {shortKg && <p className="text-[10px] text-red-400 tabular-nums">−{shortKg}</p>}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Row 2: Shell Plates + Pipes Intermediate Stock ───────────────── */}
      <div className="grid grid-cols-[2fr_3fr] gap-6 items-start">

        {/* Shell Plates */}
        <div id="section-shell" className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden ring-1 ring-gray-100 scroll-mt-6">
          <CardHeader
            icon={<Layers size={18} className="text-amber-400" />}
            accent="bg-white/10"
            title="1.6 mm Sheet"
            subtitle={`${shellPlates.length || SHELL_DUMMY.length} item${(shellPlates.length || SHELL_DUMMY.length) !== 1 ? 's' : ''}`}
            right={(
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-blue-100">Total Qty</p>
                  <p className="text-sm font-bold text-white tabular-nums">
                    {fmt(shellPlates.length > 0 ? shellTotalQty : SHELL_DUMMY.reduce((s, r) => s + r.qty, 0))}
                  </p>
                </div>
              </div>
            )}
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <ColHeader>
                <th className={TH_LEFT}>Diameter</th>
                <th className={TH_RIGHT}>Quantity</th>
                <th className={TH_RIGHT}>Weight (Kg)</th>
              </ColHeader>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-24" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-3 bg-gray-100 rounded w-16 ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-3 bg-gray-100 rounded w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : shellPlates.length === 0 ? (
                  SHELL_DUMMY.map((item) => (
                    <tr key={item.name} className="hover:bg-violet-50/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="text-sm font-semibold text-gray-800">{item.name.replace('1.6 MM Sheet ', '')} mm</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-sm text-gray-600 tabular-nums">{item.qty}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">—</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  shellPlates.map((inv: any) => {
                    const qty = parseFloat(inv.quantityOnHand ?? 0)
                    return (
                      <tr key={inv.id} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="text-sm font-semibold text-gray-800">{extractDiameter(inv.product?.name ?? '')}</span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-sm text-gray-600 tabular-nums">{fmt(qty)}</span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt(qty)}</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-violet-50 border-t-2 border-violet-200">
                  <td className="px-6 py-3 text-xs font-bold text-violet-700 uppercase tracking-widest">Total</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">
                    {fmt(shellPlates.length > 0 ? shellTotalQty : SHELL_DUMMY.reduce((s, r) => s + r.qty, 0))}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">
                    {shellPlates.length > 0 ? `${fmt(shellTotalWeight)} kg` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Pipes Intermediate Stock */}
        <div id="section-intermediate" className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden ring-1 ring-gray-100 scroll-mt-6">
          <CardHeader
            icon={<GitBranch size={18} className="text-amber-400" />}
            accent="bg-white/10"
            title="Pipes Intermediate Stock"
            subtitle={hasDateFilter
              ? `${fromDate || '…'} → ${toDate || '…'} · ${(intermediateStock as any[]).length || INTERMEDIATE_DUMMY.length} pipe type${((intermediateStock as any[]).length || INTERMEDIATE_DUMMY.length) !== 1 ? 's' : ''}`
              : `${(intermediateStock as any[]).length || INTERMEDIATE_DUMMY.length} pipe types at key stages`}
            right={(
              <div className="text-right">
                <p className="text-[10px] text-emerald-200 uppercase tracking-widest font-semibold">Ready for Dispatch</p>
                <p className="text-lg font-extrabold text-emerald-300 tabular-nums leading-tight">
                  {((intermediateStock as any[]).length > 0 ? grandFinalTesting : INTERMEDIATE_DUMMY.reduce((s, r) => s + r.finalTesting, 0)).toLocaleString()}
                  <span className="text-xs font-medium text-emerald-200 ml-1">pipes</span>
                </p>
              </div>
            )}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <ColHeader>
                <th className={TH_LEFT}>Pipe Name</th>
                <th className={`${TH_CTR} text-cyan-600`}>Curing 1</th>
                <th className={`${TH_CTR} text-sky-600`}>Curing 2</th>
                <th className={`${TH_CTR} text-emerald-600`}>Final Testing</th>
                <th className={TH_CTR}>Total</th>
              </ColHeader>
              <tbody className="divide-y divide-gray-50">
                {stockLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-40" /></td>
                      {[1,2,3,4].map(j => (
                        <td key={j} className="px-6 py-4 text-center"><div className="h-3 bg-gray-100 rounded w-10 mx-auto" /></td>
                      ))}
                    </tr>
                  ))
                ) : (intermediateStock as any[]).length === 0 ? (
                  INTERMEDIATE_DUMMY.map((row) => (
                    <tr key={row.name} className="hover:bg-violet-50/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-semibold text-gray-900">{row.name}</p>
                        <p className="text-xs text-gray-400">{row.dia} · {row.pc}</p>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="font-semibold tabular-nums text-cyan-700">{row.curing1}</span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="font-semibold tabular-nums text-sky-700">{row.curing2}</span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="font-semibold tabular-nums text-emerald-600">{row.finalTesting}</span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="font-bold tabular-nums text-gray-950">{(row.curing1 + row.curing2 + row.finalTesting).toLocaleString()}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  (intermediateStock as any[]).map((row: any) => {
                    const cfg = pipeConfigMap.get(row.pipeConfigId)
                    const displayName = row.pipeName || cfg?.name || `Config #${row.pipeConfigId}`
                    const dia  = row.diameterMm  || cfg?.diameterMm  || 0
                    const pc   = row.pressureClass || cfg?.pressureClass || ''
                    return (
                    <tr key={row.pipeConfigId} className="hover:bg-violet-50/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-semibold text-gray-900">{displayName}</p>
                        {dia > 0 && (
                          <p className="text-xs text-gray-400">{dia}mm · {pc}</p>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`font-semibold tabular-nums ${row.curing1 > 0 ? 'text-cyan-700' : 'text-gray-300'}`}>
                          {row.curing1 > 0 ? row.curing1.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`font-semibold tabular-nums ${row.curing2 > 0 ? 'text-sky-700' : 'text-gray-300'}`}>
                          {row.curing2 > 0 ? row.curing2.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`font-semibold tabular-nums ${row.finalTesting > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                          {row.finalTesting > 0 ? row.finalTesting.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="font-bold tabular-nums text-gray-950">{row.total.toLocaleString()}</span>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
              {((intermediateStock as any[]).length > 1 || (intermediateStock as any[]).length === 0) && (
                <tfoot>
                  <tr className="bg-violet-50 border-t-2 border-violet-200">
                    <td className="px-6 py-3 text-xs font-bold text-violet-700 uppercase tracking-widest">Total</td>
                    <td className="px-6 py-3 text-center font-bold text-gray-900 tabular-nums">
                      {((intermediateStock as any[]).length > 0 ? grandCuring1 : INTERMEDIATE_DUMMY.reduce((s, r) => s + r.curing1, 0)).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-center font-bold text-gray-900 tabular-nums">
                      {((intermediateStock as any[]).length > 0 ? grandCuring2 : INTERMEDIATE_DUMMY.reduce((s, r) => s + r.curing2, 0)).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-center font-bold text-gray-900 tabular-nums">
                      {((intermediateStock as any[]).length > 0 ? grandFinalTesting : INTERMEDIATE_DUMMY.reduce((s, r) => s + r.finalTesting, 0)).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-center font-bold text-gray-950 tabular-nums">
                      {((intermediateStock as any[]).length > 0 ? grandTotal : INTERMEDIATE_DUMMY.reduce((s, r) => s + r.curing1 + r.curing2 + r.finalTesting, 0)).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* ── Row 3: All Production Stages Stock ───────────────────────────── */}
      <div id="section-all-stages" className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden ring-1 ring-gray-100 scroll-mt-6">
        <CardHeader
          icon={<GitBranch size={18} className="text-violet-400" />}
          accent="bg-white/10"
          title="All Production Stages"
          subtitle={hasDateFilter
            ? `${fromDate || '…'} → ${toDate || '…'} · ${(allStagesStock as any[]).length || ALL_STAGES_DUMMY.length} pipe type${((allStagesStock as any[]).length || ALL_STAGES_DUMMY.length) !== 1 ? 's' : ''}`
            : `${(allStagesStock as any[]).length || ALL_STAGES_DUMMY.length} pipe types across all stages`}
          right={(
            <div>
              <p className="text-xs text-blue-100">Grand Total</p>
              <p className="text-sm font-bold text-white tabular-nums">
                {((allStagesStock as any[]).length > 0
                  ? allStagesTotal
                  : ALL_STAGES_DUMMY.reduce((s, r) => s + r.fabrication, 0)
                ).toLocaleString()} pipes
              </p>
            </div>
          )}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <ColHeader>
              <th className={TH_LEFT}>Pipe Name</th>
              {ALL_STAGES.map(s => (
                <th key={s.key} className={`${TH_CTR} ${s.color} whitespace-nowrap`}>{s.label}</th>
              ))}
              <th className={TH_CTR}>Total</th>
            </ColHeader>
            <tbody className="divide-y divide-gray-50">
              {allStagesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-40" /></td>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-4 text-center"><div className="h-3 bg-gray-100 rounded w-8 mx-auto" /></td>
                    ))}
                  </tr>
                ))
              ) : (allStagesStock as any[]).length === 0 ? (
                ALL_STAGES_DUMMY.map((row) => (
                  <tr key={row.name} className="hover:bg-violet-50/30 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-400">{row.dia} · {row.pc}</p>
                    </td>
                    {ALL_STAGES.map(s => {
                      const val = (row as any)[s.key] ?? 0
                      return (
                        <td key={s.key} className="px-4 py-3.5 text-center">
                          <span className={`font-semibold tabular-nums ${val > 0 ? s.color : 'text-gray-300'}`}>
                            {val > 0 ? val.toLocaleString() : '—'}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-bold tabular-nums text-gray-950">{row.fabrication.toLocaleString()}</span>
                    </td>
                  </tr>
                ))
              ) : (
                (allStagesStock as any[]).map((row: any) => {
                  const cfg = pipeConfigMap.get(row.pipeConfigId)
                  const displayName = row.pipeName || cfg?.name || `Config #${row.pipeConfigId}`
                  const dia = row.diameterMm || cfg?.diameterMm || 0
                  const pc  = row.pressureClass || cfg?.pressureClass || ''
                  return (
                  <tr key={row.pipeConfigId} className="hover:bg-violet-50/30 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-gray-900">{displayName}</p>
                      {dia > 0 && (
                        <p className="text-xs text-gray-400">{dia}mm · {pc}</p>
                      )}
                    </td>
                    {ALL_STAGES.map(s => (
                      <td key={s.key} className="px-4 py-3.5 text-center">
                        <span className={`font-semibold tabular-nums ${row[s.key] > 0 ? s.color : 'text-gray-300'}`}>
                          {row[s.key] > 0 ? (row[s.key] as number).toLocaleString() : '—'}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-bold tabular-nums text-gray-950">{row.total.toLocaleString()}</span>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
            {((allStagesStock as any[]).length > 1 || (allStagesStock as any[]).length === 0) && (
              <tfoot>
                <tr className="bg-violet-50 border-t-2 border-violet-200">
                  <td className="px-6 py-3 text-xs font-bold text-violet-700 uppercase tracking-widest">Total</td>
                  {ALL_STAGES.map(s => {
                    const sum = (allStagesStock as any[]).length > 0
                      ? (allStagesStock as any[]).reduce((acc, r) => acc + (r[s.key] ?? 0), 0)
                      : ALL_STAGES_DUMMY.reduce((acc, r) => acc + ((r as any)[s.key] ?? 0), 0)
                    return (
                      <td key={s.key} className="px-4 py-3 text-center font-bold text-gray-900 tabular-nums">
                        {sum > 0 ? sum.toLocaleString() : '—'}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center font-bold text-gray-950 tabular-nums">
                    {(allStagesStock as any[]).length > 0
                      ? allStagesTotal.toLocaleString()
                      : ALL_STAGES_DUMMY.reduce((s, r) => s + r.fabrication, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  )
}
