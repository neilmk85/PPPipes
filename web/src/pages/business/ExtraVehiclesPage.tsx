import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Car, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, ChevronDown, ArrowLeft, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { extraVehiclesApi } from '@/services/businessApi'
import { vendorApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────
type RateType = 'per_day' | 'per_hour'

interface VehicleItem {
  enabled:  boolean
  rateType: RateType
  quantity: string
  rate:     string
  vendor:   string
}

const VEHICLE_KEYS = ['crane', 'jcb', 'tractor', 'excavator', 'tipper', 'selfLoader', 'generator', 'transitMixer'] as const
type VehicleKey = typeof VEHICLE_KEYS[number]

const VEHICLE_LABELS: Record<VehicleKey, string> = {
  crane:        'Crane',
  jcb:          'JCB',
  tractor:      'Tractor',
  excavator:    'Excavator',
  tipper:       'Tipper',
  selfLoader:   'Self Loader',
  generator:    'Generator',
  transitMixer: 'Transit Mixer',
}

type VehicleMap = Record<VehicleKey, VehicleItem>

interface ExtraVehiclesEntry {
  id:       number
  date:     string
  vendor:   string
  vehicles: VehicleMap
  notes:    string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyVehicle(): VehicleItem {
  return { enabled: false, rateType: 'per_day', quantity: '', rate: '', vendor: '' }
}
function emptyVehicleMap(): VehicleMap {
  return Object.fromEntries(VEHICLE_KEYS.map(k => [k, emptyVehicle()])) as VehicleMap
}
function calcAmount(v: VehicleItem) {
  if (!v.enabled) return 0
  const qty  = parseFloat(v.quantity) || 0
  const rate = parseFloat(v.rate)     || 0
  return qty * rate
}
function totalAmount(entry: ExtraVehiclesEntry) {
  return VEHICLE_KEYS.reduce((s, k) => s + calcAmount(entry.vehicles[k]), 0)
}
function fmtCur(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

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

// ─── Vendor Autocomplete ──────────────────────────────────────────────────────
function VendorAutocomplete({ value, onChange, suggestions }: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
}) {
  const [open, setOpen]     = useState(false)
  const [cursor, setCursor] = useState(-1)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    return q ? suggestions.filter(s => s.toLowerCase().includes(q)) : suggestions
  }, [value, suggestions])

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
      <input type="text" placeholder="Type or select vendor…" value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setCursor(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown} autoComplete="off"
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-400 transition-colors" />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-44 overflow-y-auto" style={{ zIndex: 9999 }}>
          {filtered.map((s, i) => (
            <li key={s} onMouseDown={e => { e.preventDefault(); pick(s) }} onMouseEnter={() => setCursor(i)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${i === cursor ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'text-gray-700 hover:bg-fuchsia-50'}`}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${checked ? 'bg-fuchsia-500 border-fuchsia-500' : 'border-gray-300 bg-white hover:border-fuchsia-400'}`}>
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  )
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
interface VehicleFieldError { qty?: string; rate?: string; vendor?: string }
interface FormErrors {
  date?:          string
  vehicles?:      string
  vehicleFields?: Partial<Record<VehicleKey, VehicleFieldError>>
}

function EntryModal({ initial, onSave, onClose, vendorSuggestions }: {
  initial?: ExtraVehiclesEntry
  onSave: (data: Omit<ExtraVehiclesEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  vendorSuggestions: string[]
}) {
  const [date, setDate]   = useState(initial?.date  ?? todayStr())
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [vehicles, setVehicles] = useState<VehicleMap>(
    initial?.vehicles
      ? { ...emptyVehicleMap(), ...initial.vehicles }
      : emptyVehicleMap()
  )
  const [saving,  setSaving]  = useState(false)
  const [errors,  setErrors]  = useState<FormErrors>({})

  const clearErr = (...keys: string[]) =>
    setErrors(prev => {
      const next = { ...prev }
      keys.forEach(k => delete (next as any)[k])
      return next
    })

  const setVehicleField = (key: VehicleKey, field: keyof VehicleItem, value: any) => {
    setVehicles(v => ({ ...v, [key]: { ...v[key], [field]: value } }))
    if (field === 'quantity' || field === 'rate' || field === 'vendor') {
      const errKey = field === 'quantity' ? 'qty' : field === 'rate' ? 'rate' : 'vendor'
      setErrors(prev => {
        if (!prev.vehicleFields?.[key]?.[errKey as keyof VehicleFieldError]) return prev
        const vf = { ...prev.vehicleFields, [key]: { ...prev.vehicleFields[key] } }
        delete vf[key]![errKey as keyof VehicleFieldError]
        if (!Object.keys(vf[key]!).length) delete vf[key]
        return { ...prev, vehicleFields: Object.keys(vf).length ? vf : undefined }
      })
    }
  }

  const toggleVehicle = (key: VehicleKey) => {
    setVehicles(v => ({ ...v, [key]: { ...v[key], enabled: !v[key].enabled } }))
    // enabling a vehicle clears the "no vehicle" error; disabling clears its field errors
    setErrors(prev => {
      const next = { ...prev }
      delete next.vehicles
      if (next.vehicleFields) {
        const vf = { ...next.vehicleFields }
        delete vf[key]
        next.vehicleFields = Object.keys(vf).length ? vf : undefined
      }
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: FormErrors = {}

    if (!date) newErrors.date = 'Please select a date'

    const anyEnabled = VEHICLE_KEYS.some(k => vehicles[k].enabled)
    if (!anyEnabled) {
      newErrors.vehicles = 'Please select at least one vehicle'
    } else {
      const vf: Partial<Record<VehicleKey, VehicleFieldError>> = {}
      for (const k of VEHICLE_KEYS) {
        const v = vehicles[k]
        if (!v.enabled) continue
        const fe: VehicleFieldError = {}
        if (!v.vendor.trim())                           fe.vendor = 'Vendor required'
        if (!v.quantity || parseFloat(v.quantity) <= 0) fe.qty    = 'Qty required'
        if (!v.rate     || parseFloat(v.rate)     <= 0) fe.rate   = 'Rate required'
        if (Object.keys(fe).length) vf[k] = fe
      }
      if (Object.keys(vf).length) newErrors.vehicleFields = vf
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      return
    }

    const firstVendor = VEHICLE_KEYS.map(k => vehicles[k]).find(v => v.enabled)?.vendor.trim() ?? ''
    setSaving(true)
    setTimeout(() => { onSave({ date, vendor: firstVendor, vehicles, notes: notes.trim() }); setSaving(false) }, 250)
  }

  const inputCls  = (disabled: boolean, err?: boolean) =>
    `w-full px-2.5 py-2 text-sm border rounded-xl focus:outline-none transition-colors ${
      disabled ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
      : err     ? 'border-red-400 bg-red-50/20 focus:ring-2 focus:ring-red-400/30 focus:border-red-500'
      :           'border-gray-200 focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-400'
    }`
  const selectCls = (disabled: boolean) =>
    `w-full px-2.5 py-2 text-sm border rounded-xl appearance-none focus:outline-none transition-colors ${
      disabled ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
      :          'border-gray-200 bg-white focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-400'
    }`

  const hasAnyError = !!(errors.date || errors.vehicles || errors.vehicleFields)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-50 flex items-center justify-center">
              <Car size={16} className="text-fuchsia-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? 'Edit Entry' : 'Add Extra Vehicles'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            {/* Top error summary banner — only shown after first failed submit */}
            {hasAnyError && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 font-medium">Please fix the errors below before saving.</p>
              </div>
            )}

            {/* Date row */}
            <div className="max-w-[200px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); clearErr('date') }}
                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
                  errors.date
                    ? 'border-red-400 bg-red-50/20 focus:ring-red-400/30 focus:border-red-500'
                    : 'border-gray-200 focus:ring-fuchsia-500/30 focus:border-fuchsia-400'
                }`}
              />
              {errors.date && (
                <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500">
                  <AlertTriangle size={11} /> {errors.date}
                </p>
              )}
            </div>

            {/* Vehicle rows */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicles</p>
              </div>
              {errors.vehicles && (
                <p className="flex items-center gap-1 mb-2 text-xs text-red-500">
                  <AlertTriangle size={11} /> {errors.vehicles}
                </p>
              )}

              {/* Column headings */}
              <div className="grid grid-cols-[24px_1fr_120px_90px_90px] gap-2 mb-1.5 px-1">
                <div />
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Vehicle</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Rate Type</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Qty</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Rate (₹)</span>
              </div>

              <div className="space-y-1.5">
                {VEHICLE_KEYS.map(key => {
                  const v      = vehicles[key]
                  const dis    = !v.enabled
                  const amount = calcAmount(v)
                  const ve     = errors.vehicleFields?.[key]
                  const hasErr = !!(ve?.qty || ve?.rate || ve?.vendor)

                  return (
                    <div key={key}>
                      <div className={`grid grid-cols-[24px_1fr_120px_90px_90px] gap-2 items-center p-2.5 rounded-xl border transition-all ${
                        hasErr    ? 'border-red-200 bg-red-50/20'
                        : v.enabled ? 'border-fuchsia-200 bg-fuchsia-50/30'
                        :             'border-gray-100 bg-gray-50/40'
                      }`}>

                        <Checkbox checked={v.enabled} onChange={() => toggleVehicle(key)} />

                        {/* Label + amount */}
                        <div className="min-w-0">
                          <span className={`text-sm font-semibold ${v.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                            {VEHICLE_LABELS[key]}
                          </span>
                          {v.enabled && amount > 0 && (
                            <span className="ml-2 text-[11px] font-bold text-fuchsia-600">{fmtCur(amount)}</span>
                          )}
                        </div>

                        {/* Rate Type dropdown */}
                        <div className="relative">
                          <select disabled={dis} value={v.rateType}
                            onChange={e => setVehicleField(key, 'rateType', e.target.value as RateType)}
                            className={selectCls(dis)}>
                            <option value="per_day">Per Day</option>
                            <option value="per_hour">Per Hour</option>
                          </select>
                          {!dis && <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
                        </div>

                        {/* Quantity */}
                        <input type="number" min="0" step="0.5" placeholder="Qty"
                          disabled={dis} value={v.quantity}
                          onChange={e => setVehicleField(key, 'quantity', e.target.value)}
                          className={inputCls(dis, !!ve?.qty)} />

                        {/* Rate */}
                        <input type="number" min="0" step="0.01" placeholder="Rate"
                          disabled={dis} value={v.rate}
                          onChange={e => setVehicleField(key, 'rate', e.target.value)}
                          className={inputCls(dis, !!ve?.rate)} />
                      </div>

                      {/* Per-vehicle vendor field — shown when enabled */}
                      {v.enabled && (
                        <div className="mt-1 ml-7 mr-1">
                          <div className={ve?.vendor ? 'ring-1 ring-red-400 rounded-xl' : ''}>
                            <VendorAutocomplete
                              value={v.vendor}
                              onChange={val => setVehicleField(key, 'vendor', val)}
                              suggestions={vendorSuggestions}
                            />
                          </div>
                          {ve?.vendor && (
                            <p className="flex items-center gap-1 mt-0.5 text-[11px] text-red-500">
                              <AlertTriangle size={10} /> {ve.vendor}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Per-vehicle field errors (qty / rate) */}
                      {(ve?.qty || ve?.rate) && (
                        <p className="flex items-center gap-1 mt-0.5 ml-1 text-[11px] text-red-500">
                          <AlertTriangle size={10} />
                          {[ve?.qty, ve?.rate].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Grand total */}
              {VEHICLE_KEYS.some(k => vehicles[k].enabled) && (
                <div className="flex justify-end mt-3 pr-1">
                  <span className="text-xs font-semibold text-gray-500 mr-2 self-center">Total Amount:</span>
                  <span className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-500">
                    {fmtCur(VEHICLE_KEYS.reduce((s, k) => s + calcAmount(vehicles[k]), 0))}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
              <textarea rows={2} placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-400 transition-colors resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-2.5">
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
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteModal({ entry, onConfirm, onClose }: { entry: ExtraVehiclesEntry; onConfirm: () => void; onClose: () => void }) {
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
        <p className="text-sm text-gray-600">Delete the entry for <span className="font-semibold">{fmtDate(entry.date)}</span> — <span className="font-semibold">{entry.vendor}</span>?</p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExtraVehiclesPage() {
  const navigate = useNavigate()
  const [entries, setEntries]   = useState<ExtraVehiclesEntry[]>([])
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<ExtraVehiclesEntry | null>(null)
  const [deleting, setDeleting] = useState<ExtraVehiclesEntry | null>(null)
  const [fromDate, setFromDate] = useState(isoDate(startOf('month')))
  const [toDate, setToDate]     = useState(isoDate(new Date()))

  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    extraVehiclesApi.list(fromDate || undefined, toDate || undefined)
      .then(data => setEntries(data.map(e => ({
        ...e,
        vehicles: typeof e.vehicles === 'string' ? JSON.parse(e.vehicles) : e.vehicles,
      }))))
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  // Fetch vendors from API
  const { data: apiVendors = [] } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: () => vendorApi.getAll().then(r => {
      const d = r.data.data
      const list = Array.isArray(d) ? d : (d?.content ?? d?.items ?? [])
      return (list as any[]).map((v: any) => v.name as string).filter(Boolean)
    }),
    staleTime: 5 * 60 * 1000,
  })

  const vendorSuggestions = useMemo(() => {
    const local: string[] = []
    entries.forEach(e => {
      VEHICLE_KEYS.forEach(k => {
        const v = e.vehicles?.[k]
        if (v?.enabled && v.vendor) local.push(v.vendor)
      })
      if (e.vendor) local.push(e.vendor)
    })
    return [...new Set([...apiVendors, ...local])].sort((a, b) => a.localeCompare(b))
  }, [apiVendors, entries])

  const filtered = useMemo(() => entries, [entries])

  const grandTotal = useMemo(() => filtered.reduce((s, e) => s + totalAmount(e), 0), [filtered])

  const handleAdd = async (data: Omit<ExtraVehiclesEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const apiData = { ...data, vehicles: JSON.stringify(data.vehicles) }
      const raw = await extraVehiclesApi.create(apiData)
      const created = { ...raw, vehicles: typeof raw.vehicles === 'string' ? JSON.parse(raw.vehicles) : raw.vehicles }
      setEntries(prev => [created, ...prev])
      setShowAdd(false)
      toast.success('Entry added')
    } catch { toast.error('Failed to add entry') }
  }
  const handleEdit = async (data: Omit<ExtraVehiclesEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const apiData = { ...data, vehicles: JSON.stringify(data.vehicles) }
      const raw = await extraVehiclesApi.update(editing!.id, apiData)
      const updated = { ...raw, vehicles: typeof raw.vehicles === 'string' ? JSON.parse(raw.vehicles) : raw.vehicles }
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }
  const handleDelete = async () => {
    try {
      await extraVehiclesApi.delete(deleting!.id)
      setEntries(prev => prev.filter(e => e.id !== deleting!.id))
      setDeleting(null)
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete entry') }
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* Hero Banner */}
      <div className="relative overflow-visible">
        <div className="rounded-2xl bg-gradient-to-r from-violet-700 via-violet-600 to-blue-600 px-6 py-5 overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button onClick={() => navigate('/business')} className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors" title="Back">
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Car size={26} className="text-fuchsia-300" />
                  <h1 className="text-xl font-bold text-white">Extra Vehicles</h1>
                </div>
                <p className="text-sm text-white/60">External vehicle hire — Crane, JCB, Tractor &amp; more</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <DateRangePicker fromDate={fromDate} toDate={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-700 bg-white rounded-xl hover:bg-white/90 shadow-sm hover:shadow-md transition-all">
                <Plus size={16} /> Add Entry
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(139,92,246,0.10), 0 1.5px 6px rgba(0,0,0,0.07)' }}>
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-600 to-blue-600">
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Date</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Vendor</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Vehicle</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Rate Type</th>
              <th className="px-5 py-4 text-right  text-xs font-bold text-white uppercase tracking-wider">Qty</th>
              <th className="px-5 py-4 text-right  text-xs font-bold text-white uppercase tracking-wider">Rate (₹)</th>
              <th className="px-5 py-4 text-right  text-xs font-bold text-white uppercase tracking-wider">Total (₹)</th>
              <th className="px-5 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Notes</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center">
                  <Car size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">{entries.length === 0 ? 'No entries yet' : 'No entries for selected date range'}</p>
                  <p className="text-xs text-gray-300 mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started' : 'Try adjusting the date filter'}</p>
                </td>
              </tr>
            ) : (
              filtered.map(entry => {
                const activeVehicles = VEHICLE_KEYS.filter(k => entry.vehicles[k].enabled)
                const span = activeVehicles.length
                return activeVehicles.map((key, vIdx) => {
                  const v   = entry.vehicles[key]
                  const amt = calcAmount(v)
                  const isFirst = vIdx === 0
                  const topBorder = isFirst ? 'border-t-2 border-gray-100' : 'border-t border-gray-50'
                  return (
                    <tr key={`${entry.id}-${key}`} className="hover:bg-fuchsia-50/20 transition-colors">

                      {/* Date — only on first vehicle row */}
                      {isFirst && (
                        <td rowSpan={span} className={`px-5 py-3.5 align-top ${topBorder}`}>
                          <span className="text-sm font-medium text-gray-500 whitespace-nowrap">{fmtDate(entry.date)}</span>
                        </td>
                      )}

                      {/* Vendor — per vehicle row */}
                      <td className={`px-5 py-3.5 ${topBorder}`}>
                        <span className="text-sm font-medium text-gray-500">{v.vendor || entry.vendor || '—'}</span>
                      </td>

                      {/* Vehicle name */}
                      <td className={`px-5 py-3.5 ${topBorder}`}>
                        <span className="text-sm font-medium text-gray-500">
                          {VEHICLE_LABELS[key]}
                        </span>
                      </td>

                      {/* Rate Type */}
                      <td className={`px-5 py-3.5 text-center ${topBorder}`}>
                        <span className="text-sm font-medium text-gray-500">
                          {v.rateType === 'per_day' ? 'Per Day' : 'Per Hour'}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className={`px-5 py-3.5 text-right ${topBorder}`}>
                        <span className="text-sm font-medium text-gray-500 tabular-nums">{parseFloat(v.quantity).toLocaleString('en-IN')}</span>
                      </td>

                      {/* Rate */}
                      <td className={`px-5 py-3.5 text-right ${topBorder}`}>
                        <span className="text-sm font-medium text-gray-500 tabular-nums">{fmtCur(parseFloat(v.rate) || 0)}</span>
                      </td>

                      {/* Total */}
                      <td className={`px-5 py-3.5 text-right ${topBorder}`}>
                        <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtCur(amt)}</span>
                      </td>

                      {/* Notes — only on first vehicle row */}
                      {isFirst && (
                        <td rowSpan={span} className={`px-5 py-3.5 align-top ${topBorder}`}>
                          <span className="text-sm text-gray-500">{entry.notes || <span className="text-gray-200 italic">—</span>}</span>
                        </td>
                      )}

                      {/* Action — only on first vehicle row */}
                      {isFirst && (
                        <td rowSpan={span} className={`px-5 py-3.5 align-top ${topBorder}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setEditing(entry)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-violet-50 hover:text-violet-600 transition-colors" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setDeleting(entry)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              })
            )}
          </tbody>

          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                <td colSpan={6} className="px-5 py-3.5 text-xs font-extrabold text-violet-600 uppercase tracking-widest">Grand Total</td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-base font-extrabold text-gray-900 tabular-nums">
                    {fmtCur(grandTotal)}
                  </span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showAdd  && <EntryModal onSave={handleAdd}  onClose={() => setShowAdd(false)} vendorSuggestions={vendorSuggestions} />}
      {editing  && <EntryModal initial={editing}   onSave={handleEdit} onClose={() => setEditing(null)} vendorSuggestions={vendorSuggestions} />}
      {deleting && <DeleteModal entry={deleting}   onConfirm={handleDelete} onClose={() => setDeleting(null)} />}
    </div>
  )
}
