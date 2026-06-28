import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hammer, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, ChevronDown, ArrowLeft, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { vendorApi } from '@/services/api'
import { extraFabApi, type ExtraFabEntry } from '@/services/businessApi'

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().slice(0, 10) }
function fmtAmt(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n) || n === 0) return '—'
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function num(v: string) { return parseFloat(v) || 0 }

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

function DateRangePicker({ fromDate, toDate, onChange }: { fromDate: string; toDate: string; onChange: (f: string, t: string) => void }) {
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
    setPreset(key); const { from, to } = resolvePreset(key)
    setCustomFrom(from); setCustomTo(to); onChange(from, to); setOpen(false)
  }
  function applyCustom() { onChange(customFrom, customTo); setOpen(false) }
  function clear() { setPreset(''); setCustomFrom(''); setCustomTo(''); onChange('', '') }

  const hasDate = fromDate || toDate
  const activeLabel = preset
    ? PRESETS.find(p => p.key === preset)?.label
    : hasDate ? `${fromDate || '…'} → ${toDate || '…'}` : null

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all ${
          hasDate ? 'bg-white/20 border-white/40 text-white backdrop-blur-sm' : 'bg-white/10 border-white/20 text-white/90 hover:bg-white/20 hover:border-white/40 backdrop-blur-sm'
        }`}>
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
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${preset === p.key ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                {p.label}
                {preset === p.key && <span className="float-right text-xs text-violet-400 tabular-nums">{fromDate} → {toDate}</span>}
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
                  <input type="date" value={val} onChange={e => { set(e.target.value); setPreset('') }}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400" />
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

// ─── Autocomplete ─────────────────────────────────────────────────────────────
function Autocomplete({ value, onChange, options, placeholder, loading = false }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; loading?: boolean
}) {
  const [open,   setOpen]   = useState(false)
  const [cursor, setCursor] = useState(-1)
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options
  }, [value, options])
  const pick = (v: string) => { onChange(v); setOpen(false); setCursor(-1) }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); setCursor(0); e.preventDefault() } return }
    if (e.key === 'ArrowDown') { setCursor(c => Math.min(c + 1, filtered.length - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setCursor(c => Math.max(c - 1, 0));                   e.preventDefault() }
    if (e.key === 'Enter' && cursor >= 0) { pick(filtered[cursor]); e.preventDefault() }
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }
  return (
    <div className="relative">
      <input type="text" placeholder={loading ? 'Loading…' : placeholder} value={value} disabled={loading}
        onChange={e => { onChange(e.target.value); setOpen(true); setCursor(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors disabled:bg-gray-50" />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto" style={{ zIndex: 9999 }}>
          {filtered.map((o, i) => (
            <li key={o} onMouseDown={e => { e.preventDefault(); pick(o) }} onMouseEnter={() => setCursor(i)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${i === cursor ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'text-gray-700 hover:bg-violet-50'}`}>
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────

type FormState = {
  date:            string
  vendorName:      string
  particular:      string
  rate:            string
  quantity:        string
  taxPercent:      string
  lineTotal:       string
  notes:           string
  invoiceNo:       string
  vehicleNo:       string
  invoiceData:     string
  subTotal:        string
  discountPercent: string
  billPrice:       string
  taxable:         string
  gstInclusive:    boolean
  roundingOff:     string
  finalBill:       string
}

function initForm(e?: ExtraFabEntry): FormState {
  return {
    date:            e?.date            ?? todayStr(),
    vendorName:      e?.vendorName      ?? '',
    particular:      e?.particular      ?? 'Fabrication Charges',
    rate:            e?.rate            ?? '',
    quantity:        e?.quantity        ?? '',
    taxPercent:      e?.taxPercent      ?? '0',
    lineTotal:       e?.lineTotal       ?? '',
    notes:           e?.notes           ?? '',
    invoiceNo:       e?.invoiceNo       ?? '',
    vehicleNo:       e?.vehicleNo       ?? '',
    invoiceData:     e?.invoiceData     ?? '',
    subTotal:        e?.subTotal        ?? '',
    discountPercent: e?.discountPercent ?? '0',
    billPrice:       e?.billPrice       ?? '',
    taxable:         e?.taxable         ?? '',
    gstInclusive:    e?.gstInclusive    ?? false,
    roundingOff:     e?.roundingOff     ?? '0',
    finalBill:       e?.finalBill       ?? '',
  }
}

function EntryModal({ initial, onSave, onClose, vendorOptions }: {
  initial?:      ExtraFabEntry
  onSave:        (data: Omit<ExtraFabEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose:       () => void
  vendorOptions: string[]
}) {
  const [form, setForm] = useState<FormState>(initForm(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const set = (k: keyof FormState) => (v: string | boolean) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(p => { const n = { ...p }; delete n[k]; return n })
  }

  // Auto-compute lineTotal = rate * qty * (1 + tax/100)
  useEffect(() => {
    const r = num(form.rate), q = num(form.quantity), t = num(form.taxPercent)
    if (r > 0 && q > 0) {
      const lt = (r * q * (1 + t / 100)).toFixed(2)
      setForm(f => ({ ...f, lineTotal: lt, subTotal: lt }))
    }
  }, [form.rate, form.quantity, form.taxPercent])

  // Auto-compute bill price = subTotal - discount%
  useEffect(() => {
    const sub = num(form.subTotal), disc = num(form.discountPercent)
    const bp = Math.max(0, sub - (sub * disc / 100)).toFixed(2)
    setForm(f => ({ ...f, billPrice: bp, taxable: bp }))
  }, [form.subTotal, form.discountPercent])

  // Auto-compute finalBill = billPrice + roundingOff
  useEffect(() => {
    const bp = num(form.billPrice), ro = num(form.roundingOff)
    setForm(f => ({ ...f, finalBill: (bp + ro).toFixed(2) }))
  }, [form.billPrice, form.roundingOff])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.date)              errs.date       = 'Required'
    if (!form.vendorName.trim()) errs.vendorName = 'Required'
    if (!form.rate || num(form.rate) <= 0) errs.rate = 'Required'
    if (!form.quantity || num(form.quantity) <= 0) errs.quantity = 'Required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    onSave({ ...form, vendorName: form.vendorName.trim() })
    setSaving(false)
  }

  const inp = (err?: string) =>
    `w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
      err ? 'border-red-400 focus:ring-red-400/30 bg-red-50/20' : 'border-gray-200 focus:ring-violet-500/30 focus:border-violet-400'
    }`

  const summaryRow = (label: string, value: string, bold = false) => (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value || '—'}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Hammer size={15} className="text-violet-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? 'Edit Extra Fab Entry' : 'Add Extra Fab Entry'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-5 gap-0">

            {/* ── Left panel (3/5) ── */}
            <div className="col-span-3 p-6 space-y-4 border-r border-gray-100">

              {/* Line item table */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Line Item</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Particular', 'Rate (₹)', 'Qty', 'Tax (%)', 'Total (₹)'].map(h => (
                          <th key={h} className="px-3 py-2 text-xs font-semibold text-gray-500 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2">
                          <input type="text" value={form.particular}
                            onChange={e => set('particular')(e.target.value)}
                            className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" placeholder="0.00" value={form.rate}
                            onChange={e => set('rate')(e.target.value)}
                            className={`w-24 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 ${errors.rate ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-violet-400'}`} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="1" placeholder="0" value={form.quantity}
                            onChange={e => set('quantity')(e.target.value)}
                            className={`w-16 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 ${errors.quantity ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-violet-400'}`} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" max="100" step="0.01" placeholder="0" value={form.taxPercent}
                            onChange={e => set('taxPercent')(e.target.value)}
                            className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm font-semibold text-gray-800 tabular-nums">
                            {form.lineTotal ? num(form.lineTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {(errors.rate || errors.quantity) && (
                  <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> Rate and Quantity are required</p>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label>
                <textarea rows={2} placeholder="Optional notes…" value={form.notes}
                  onChange={e => set('notes')(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-none" />
              </div>

              {/* Invoice No + Vehicle No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice Number</label>
                  <input type="text" placeholder="e.g. INV-001" value={form.invoiceNo}
                    onChange={e => set('invoiceNo')(e.target.value)}
                    className={inp()} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vehicle Number</label>
                  <input type="text" placeholder="e.g. MH-01-AB-1234" value={form.vehicleNo}
                    onChange={e => set('vehicleNo')(e.target.value)}
                    className={inp()} />
                </div>
              </div>

              {/* Invoice Data */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice Data</label>
                <textarea rows={3} placeholder="Additional invoice details…" value={form.invoiceData}
                  onChange={e => set('invoiceData')(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-none" />
              </div>
            </div>

            {/* ── Right panel (2/5) ── */}
            <div className="col-span-2 p-6 space-y-4 bg-gray-50/50">

              {/* Purchase Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Purchase Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.date}
                  onChange={e => set('date')(e.target.value)}
                  className={inp(errors.date)} />
                {errors.date && <p className="flex items-center gap-1 mt-1 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
              </div>

              {/* Vendor Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor Name <span className="text-red-500">*</span></label>
                <div className={errors.vendorName ? 'ring-1 ring-red-400 rounded-xl' : ''}>
                  <Autocomplete value={form.vendorName} onChange={v => set('vendorName')(v)} options={vendorOptions} placeholder="Type or select vendor…" />
                </div>
                {errors.vendorName && <p className="flex items-center gap-1 mt-1 text-xs text-red-500"><AlertTriangle size={11} /> {errors.vendorName}</p>}
              </div>

              {/* Bill Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-0.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bill Summary</p>

                {summaryRow('Sub Total', form.subTotal ? '₹' + num(form.subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '')}

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-500">Discount on Bill (%)</span>
                  <input type="number" min="0" max="100" step="0.01" placeholder="0"
                    value={form.discountPercent}
                    onChange={e => set('discountPercent')(e.target.value)}
                    className="w-20 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                </div>

                {summaryRow('Bill Price', form.billPrice ? '₹' + num(form.billPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '')}
                {summaryRow('Taxable', form.taxable ? '₹' + num(form.taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '')}

                {/* GST Inclusive */}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-500">GST Inclusive</span>
                  <button type="button"
                    onClick={() => set('gstInclusive')(!form.gstInclusive)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.gstInclusive ? 'bg-yellow-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${form.gstInclusive ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Rounding Off */}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-500">Rounding Off</span>
                  <input type="number" step="0.01" placeholder="0.00"
                    value={form.roundingOff}
                    onChange={e => set('roundingOff')(e.target.value)}
                    className="w-20 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                </div>

                <div className="border-t border-gray-200 mt-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">Final Bill</span>
                    <span className="text-base font-extrabold text-yellow-700 tabular-nums">
                      {form.finalBill ? '₹' + num(form.finalBill).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-2">
                <button type="button" onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-60">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {initial ? 'Save Changes' : 'Add Entry'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ entry, onConfirm, onClose }: { entry: ExtraFabEntry; onConfirm: () => void; onClose: () => void }) {
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
          Delete extra fab entry for <span className="font-semibold">{entry.vendorName}</span> on <span className="font-semibold">{fmtDate(entry.date)}</span>?
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
export default function ExtraFabPage() {
  const navigate = useNavigate()
  const [entries,  setEntries]  = useState<ExtraFabEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState<ExtraFabEntry | null>(null)
  const [deleting, setDeleting] = useState<ExtraFabEntry | null>(null)
  const [fromDate, setFromDate] = useState(isoDate(startOf('month')))
  const [toDate,   setToDate]   = useState(isoDate(new Date()))

  useEffect(() => {
    setLoading(true)
    extraFabApi.list(fromDate || undefined, toDate || undefined)
      .then(setEntries)
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  const { data: apiVendors = [] } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: () => vendorApi.getAll().then(r => {
      const d = r.data.data
      const list = Array.isArray(d) ? d : (d?.content ?? d?.items ?? [])
      return (list as any[]).map((v: any) => v.name as string).filter(Boolean)
    }),
    staleTime: 5 * 60 * 1000,
  })

  const vendorOptions = useMemo(() => {
    const local = entries.map(e => e.vendorName).filter(Boolean)
    return [...new Set([...apiVendors, ...local])].sort((a, b) => a.localeCompare(b))
  }, [apiVendors, entries])

  const totalFinalBill = entries.reduce((s, e) => s + (parseFloat(e.finalBill) || 0), 0)

  const handleAdd = async (data: Omit<ExtraFabEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await extraFabApi.create(data)
      setEntries(prev => [created, ...prev])
      setShowAdd(false)
      toast.success('Entry added')
    } catch { toast.error('Failed to add entry') }
  }
  const handleEdit = async (data: Omit<ExtraFabEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updated = await extraFabApi.update(editing!.id, data)
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }
  const handleDelete = async () => {
    try {
      await extraFabApi.delete(deleting!.id)
      setEntries(prev => prev.filter(e => e.id !== deleting!.id))
      setDeleting(null)
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete entry') }
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* Hero Banner */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative px-8 pt-6 pb-0">
          <div className="flex items-start justify-between gap-4 pb-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/business')}
                className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
                <ArrowLeft size={16} className="text-white" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Hammer size={28} className="text-yellow-100" />
              </div>
              <div>
                <p className="text-xs font-semibold text-yellow-200 uppercase tracking-widest mb-0.5">Business</p>
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Extra Fabrication Charges</h1>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <p className="text-sm text-yellow-100/70">Purchase bills for external fabrication work</p>
                  <DateRangePicker fromDate={fromDate} toDate={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
                </div>
              </div>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shrink-0 mt-1">
              <Plus size={15} /> Add Entry
            </button>
          </div>

          <div className="flex border-t border-white/15 divide-x divide-white/15">
            {[
              { label: 'Entries',      value: entries.length.toString() },
              { label: 'Final Bill',   value: totalFinalBill > 0 ? fmtAmt(totalFinalBill) : '—' },
              { label: 'Vendors',      value: new Set(entries.map(e => e.vendorName)).size.toString() },
              { label: 'GST Bills',    value: entries.filter(e => e.gstInclusive).length.toString() },
            ].map(s => (
              <div key={s.label} className="flex-1 px-4 py-3 text-center">
                <p className="text-base font-extrabold text-white tabular-nums">{s.value}</p>
                <p className="text-xs text-yellow-100/60 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr style={{ background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)', borderBottom: '1px solid #dbeafe' }}>
              {['Date', 'Vendor', 'Particular', 'Qty', 'Rate', 'Tax %', 'Invoice No.', 'Vehicle No.', 'Final Bill', 'GST', 'Action'].map(h => (
                <th key={h} style={{ color: '#1f2937' }} className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider ${['Qty', 'Rate', 'Tax %', 'Final Bill'].includes(h) ? 'text-right' : h === 'Action' ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={11} className="px-6 py-16 text-center">
                <Loader2 size={28} className="text-yellow-400 animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Loading entries…</p>
              </td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={11} className="px-6 py-16 text-center">
                <Hammer size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400">No entries yet</p>
                <p className="text-xs text-gray-300 mt-1">Click "Add Entry" to get started</p>
              </td></tr>
            ) : entries.map(e => (
              <tr key={e.id} className="hover:bg-yellow-50/20 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-700 max-w-[130px] truncate">{e.vendorName}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-[130px] truncate">{e.particular || 'Fabrication Charges'}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">{e.quantity || '—'}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">{e.rate ? fmtAmt(e.rate) : '—'}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-600 tabular-nums">{e.taxPercent ? `${e.taxPercent}%` : '0%'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{e.invoiceNo || <span className="text-gray-300 italic text-xs">—</span>}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{e.vehicleNo || <span className="text-gray-300 italic text-xs">—</span>}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700 tabular-nums">{fmtAmt(e.finalBill)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${e.gstInclusive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {e.gstInclusive ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <button onClick={() => setEditing(e)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(e)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50/50">
                <td colSpan={8} className="px-4 py-3 text-xs font-extrabold text-violet-700 uppercase tracking-widest">Total</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 tabular-nums">
                    {fmtAmt(totalFinalBill)}
                  </span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showAdd  && <EntryModal onSave={handleAdd}  onClose={() => setShowAdd(false)} vendorOptions={vendorOptions} />}
      {editing  && <EntryModal initial={editing}   onSave={handleEdit} onClose={() => setEditing(null)} vendorOptions={vendorOptions} />}
      {deleting && <DeleteModal entry={deleting}   onConfirm={handleDelete} onClose={() => setDeleting(null)} />}
    </div>
  )
}
