import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  Scissors, Plus, Pencil, Trash2, X, Loader2, AlertTriangle,
  ArrowRight, ChevronDown, ArrowLeft, Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cuttingsApi, type CuttingEntry } from '@/services/businessApi'
import { productApi } from '@/services/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

const SHEET_RE = /^1\.6MM SHEET (\d+)$/
function diameter(name: string) { return parseInt(name.split(' ')[2]) }
function isSheet(name: string) { return SHEET_RE.test(name) }

const PRESETS = [
  { label: 'Today',       from: () => format(new Date(), 'yyyy-MM-dd'),              to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 7d',    from: () => format(subDays(new Date(), 6), 'yyyy-MM-dd'),   to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 30d',   from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'),  to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month', from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
]

// ─── Custom Range Picker ───────────────────────────────────────────────────────
function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function CustomRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  const [open,    setOpen]    = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo,   setTmpTo]   = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setTmpFrom(from); setTmpTo(to) }, [from, to])
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const presetActive = PRESETS.some(p => from === p.from() && to === p.to())
  const customActive = !presetActive && !!(from || to)
  const label = customActive ? `${dmy(from)} – ${dmy(to)}` : 'Custom'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
          customActive
            ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-transparent'
            : 'border-white/30 text-white/80 hover:border-white/60'
        }`}
      >
        <Calendar size={11} />
        {label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-72">
          <p className="text-xs font-semibold text-gray-600 mb-3">Custom Date Range</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">From</label>
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">To</label>
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { onChange('', ''); setOpen(false) }}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Clear
            </button>
            <button onClick={() => { onChange(tmpFrom, tmpTo); setOpen(false) }}
              className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-rose-600 rounded-lg hover:from-pink-700 hover:to-rose-700 transition-all">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────
function EntryModal({ initial, onSave, onClose, sheets, loadingSheets }: {
  initial?:     CuttingEntry
  onSave:       (data: Omit<CuttingEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose:      () => void
  sheets:       string[]
  loadingSheets: boolean
}) {
  const [date,      setDate]      = useState(initial?.date ?? todayStr())
  const [fromSheet, setFromSheet] = useState(initial?.fromSheet ?? '')
  const [toSheet,   setToSheet]   = useState(initial?.toSheet   ?? '')
  const [quantity,  setQuantity]  = useState(initial ? String(initial.quantity) : '')
  const [notes,     setNotes]     = useState(initial?.notes ?? '')
  const [saving,    setSaving]    = useState(false)
  const [errors,    setErrors]    = useState<Record<string, string>>({})

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // To-sheet list: only sheets with smaller diameter than fromSheet
  const toSheets = useMemo(() => {
    if (!fromSheet) return []
    const fromDia = diameter(fromSheet)
    return sheets.filter(s => diameter(s) < fromDia)
  }, [sheets, fromSheet])

  const handleFromChange = (val: string) => {
    setFromSheet(val)
    // Auto-clear toSheet if it's no longer valid
    if (toSheet && diameter(toSheet) >= diameter(val)) setToSheet('')
    setErrors(prev => { const n = { ...prev }; delete n.fromSheet; delete n.toSheet; return n })
  }

  const clearErr = (k: string) => setErrors(prev => { const n = { ...prev }; delete n[k]; return n })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!date)                          errs.date      = 'Please select a date'
    if (!fromSheet)                     errs.fromSheet = 'Please select a From sheet'
    if (!toSheet)                       errs.toSheet   = 'Please select a To sheet'
    if (fromSheet && toSheet && diameter(toSheet) >= diameter(fromSheet))
                                        errs.toSheet   = 'To sheet must be a smaller diameter than From sheet'
    const qty = parseInt(quantity)
    if (!quantity || isNaN(qty) || qty < 1) errs.quantity = 'Please enter a valid quantity (≥ 1)'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    onSave({ date, fromSheet, toSheet, quantity: qty, notes: notes.trim() })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
              <Scissors size={15} className="text-pink-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? 'Edit Cutting Entry' : 'New Cutting Entry'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-500">*</span></label>
            <input type="date" value={date}
              onChange={e => { setDate(e.target.value); clearErr('date') }}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 transition-colors ${errors.date ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.date}</p>}
          </div>

          {/* From Sheet → To Sheet */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Sheet Cutting <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400">larger → smaller diameter</span>
            </label>
            <div className="grid grid-cols-[1fr_36px_1fr] items-start gap-2">

              {/* From Sheet */}
              <div>
                <div className="relative">
                  <select
                    value={fromSheet}
                    onChange={e => handleFromChange(e.target.value)}
                    disabled={loadingSheets}
                    className={`w-full appearance-none px-3 py-2.5 pr-9 text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${errors.fromSheet ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">From sheet…</option>
                    {sheets.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                {errors.fromSheet && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.fromSheet}</p>}
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center pt-2.5">
                <ArrowRight size={16} className="text-pink-400" />
              </div>

              {/* To Sheet */}
              <div>
                <div className="relative">
                  <select
                    value={toSheet}
                    onChange={e => { setToSheet(e.target.value); clearErr('toSheet') }}
                    disabled={loadingSheets || !fromSheet || toSheets.length === 0}
                    className={`w-full appearance-none px-3 py-2.5 pr-9 text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${errors.toSheet ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">{fromSheet ? 'To sheet…' : 'Select From first'}</option>
                    {toSheets.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                {errors.toSheet && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.toSheet}</p>}
              </div>
            </div>

            {/* Live preview */}
            {fromSheet && toSheet && (
              <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-pink-50 rounded-lg border border-pink-100">
                <span className="text-[11px] font-medium text-gray-500">Cutting:</span>
                <span className="text-xs font-semibold text-rose-700 bg-rose-50 rounded-md px-2 py-0.5">{fromSheet}</span>
                <ArrowRight size={12} className="text-pink-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-pink-700 bg-pink-50 rounded-md px-2 py-0.5 border border-pink-100">{toSheet}</span>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity (sheets) <span className="text-red-500">*</span></label>
            <input
              type="number" min="1" step="1" placeholder="Number of sheets cut…"
              value={quantity}
              onChange={e => { setQuantity(e.target.value); clearErr('quantity') }}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 transition-colors ${errors.quantity ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.quantity && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} />{errors.quantity}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea rows={2} placeholder="Any remarks…" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 transition-colors resize-none" />
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl hover:from-pink-700 hover:to-rose-700 transition-all disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {initial ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteModal({ entry, onConfirm, onClose }: { entry: CuttingEntry; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Delete Entry</h3>
            <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Delete cutting <span className="font-semibold">{entry.fromSheet}</span> → <span className="font-semibold">{entry.toSheet}</span> on <span className="font-semibold">{fmtDate(entry.date)}</span>?
        </p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CuttingPage() {
  const navigate = useNavigate()
  const [entries,  setEntries]  = useState<CuttingEntry[]>([])
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState<CuttingEntry | null>(null)
  const [deleting, setDeleting] = useState<CuttingEntry | null>(null)
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [toDate,   setToDate]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    cuttingsApi.list(fromDate || undefined, toDate || undefined)
      .then(setEntries)
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  // Fetch 1.6MM SHEET raw materials
  const { data: sheets = [], isLoading: loadingSheets } = useQuery({
    queryKey: ['sheets-for-cutting'],
    queryFn: async () => {
      const res  = await productApi.getAll({ itemType: 'RAW_MATERIAL', size: 2000 })
      const list = res.data.data?.content ?? res.data.data ?? []
      return (list as any[])
        .map((p: any) => p.name as string)
        .filter(isSheet)
        .sort((a, b) => diameter(a) - diameter(b))
    },
    staleTime: 5 * 60 * 1000,
  })

  // Stat strip
  const stats = useMemo(() => {
    const totalQty     = entries.reduce((s, e) => s + e.quantity, 0)
    const fromSizes    = new Set(entries.map(e => e.fromSheet)).size
    const toSizes      = new Set(entries.map(e => e.toSheet)).size
    return { count: entries.length, totalQty, fromSizes, toSizes }
  }, [entries])

  const handleAdd = async (data: Omit<CuttingEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await cuttingsApi.create(data)
      setEntries(prev => [created, ...prev])
      setShowAdd(false)
      toast.success('Cutting entry added')
    } catch { toast.error('Failed to add entry') }
  }

  const handleEdit = async (data: Omit<CuttingEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updated = await cuttingsApi.update(editing!.id, data)
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }

  const handleDelete = async () => {
    try {
      await cuttingsApi.delete(deleting!.id)
      setEntries(prev => prev.filter(e => e.id !== deleting!.id))
      setDeleting(null)
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete entry') }
  }

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 text-white">
        <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/business')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors" title="Back">
              <ArrowLeft size={18} />
            </button>
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Scissors size={22} className="text-rose-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business · Production</p>
              <h1 className="text-xl font-extrabold tracking-tight">Sheet Cutting</h1>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p className="text-blue-200 text-sm">1.6MM sheet diameter reduction log</p>
                <div className="w-px h-4 bg-white/20" />
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => { setFromDate(p.from()); setToDate(p.to()) }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                      fromDate === p.from() && toDate === p.to()
                        ? 'bg-white/20 text-white border-white/30'
                        : 'border-white/20 text-white/60 hover:border-white/40'
                    }`}>
                    {p.label}
                  </button>
                ))}
                <CustomRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
              </div>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-700 bg-white rounded-xl hover:bg-white/90 shadow-sm hover:shadow-md transition-all">
            <Plus size={16} /> Record Cutting
          </button>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/15 grid grid-cols-4 divide-x divide-white/15">
          {[
            { label: 'Total Cuts',   value: stats.count,                            sub: 'cutting entries' },
            { label: 'Total Sheets', value: stats.totalQty.toLocaleString('en-IN'), sub: 'sheets cut' },
            { label: 'From Sizes',   value: stats.fromSizes,                        sub: 'unique source sizes' },
            { label: 'To Sizes',     value: stats.toSizes,                          sub: 'unique target sizes' },
          ].map(s => (
            <div key={s.label} className="px-6 py-3.5">
              <p className="text-lg font-extrabold text-white tabular-nums leading-none">{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)', borderBottom: '1px solid #dbeafe' }}>
                <th className="px-5 py-3 text-left   text-[11px] font-bold uppercase tracking-widest" style={{ color: '#1f2937' }}>Date</th>
                <th className="px-5 py-3 text-left   text-[11px] font-bold uppercase tracking-widest" style={{ color: '#1f2937' }}>From Sheet</th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest w-8" style={{ color: '#1f2937' }}></th>
                <th className="px-5 py-3 text-left   text-[11px] font-bold uppercase tracking-widest" style={{ color: '#1f2937' }}>To Sheet</th>
                <th className="px-5 py-3 text-right  text-[11px] font-bold uppercase tracking-widest" style={{ color: '#1f2937' }}>Qty (sheets)</th>
                <th className="px-5 py-3 text-left   text-[11px] font-bold uppercase tracking-widest" style={{ color: '#1f2937' }}>Notes</th>
                <th className="px-5 py-3 text-center text-[11px] font-bold uppercase tracking-widest" style={{ color: '#1f2937' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 size={24} className="text-violet-300 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Loading…</p>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Scissors size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-400">No cutting entries yet</p>
                    <p className="text-xs text-gray-300 mt-1">Click "Record Cutting" to get started</p>
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-violet-50/20 transition-colors">

                    {/* Date */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{fmtDate(entry.date)}</span>
                    </td>

                    {/* From Sheet */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 whitespace-nowrap">
                        {entry.fromSheet}
                      </span>
                    </td>

                    {/* Arrow */}
                    <td className="px-2 py-3.5 text-center">
                      <ArrowRight size={14} className="text-pink-300 mx-auto" />
                    </td>

                    {/* To Sheet */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 whitespace-nowrap">
                        {entry.toSheet}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-700 tabular-nums">
                        {entry.quantity.toLocaleString('en-IN')}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-gray-500">
                        {entry.notes || <span className="text-gray-200 italic text-xs">—</span>}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setEditing(entry)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-pink-50 hover:text-pink-600 transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleting(entry)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd  && (
        <EntryModal onSave={handleAdd} onClose={() => setShowAdd(false)} sheets={sheets} loadingSheets={loadingSheets} />
      )}
      {editing  && (
        <EntryModal initial={editing} onSave={handleEdit} onClose={() => setEditing(null)} sheets={sheets} loadingSheets={loadingSheets} />
      )}
      {deleting && (
        <DeleteModal entry={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} />
      )}
    </div>
  )
}
