import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, ArrowLeft, CheckCircle2, MinusCircle, Calendar, ChevronDown, PlusCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { pdisApi, type PDIEntry } from '@/services/businessApi'
import { productionEntryApi } from '@/services/api'

// ─── Constants ────────────────────────────────────────────────────────────────
const CHECKS = [
  { key: 'finishing',       label: 'Finishing'        },
  { key: 'colour',          label: 'Colour'           },
  { key: 'numbering',       label: 'Numbering'        },
  { key: 'ghola',           label: 'Ghola'            },
  { key: 'qualityCheck',    label: 'Quality Check'    },
  { key: 'diameterCheck',   label: 'Diameter Check'   },
] as const

type CheckKey = typeof CHECKS[number]['key']
type CheckMap = Record<CheckKey, boolean>

function emptyChecks(): CheckMap {
  return Object.fromEntries(CHECKS.map(c => [c.key, false])) as CheckMap
}

// ─── Local form data type ─────────────────────────────────────────────────────
type PDIFormData = {
  date:       string
  thirdParty: string
  pipeName:   string
  quantity:   string
  checks:     CheckMap
  notes:      string
}

type PipeRow    = { id: string; pipeName: string; quantity: string }
type PipeOption = { pipeName: string; available: number }
let _rowId = 0
function newRow(): PipeRow { return { id: String(++_rowId), pipeName: '', quantity: '' } }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().slice(0, 10) }
function passCount(entry: PDIEntry) {
  return CHECKS.filter(c => entry[c.key as keyof PDIEntry] as boolean).length
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

// ─── Third-Party Combobox ─────────────────────────────────────────────────────
function ThirdPartyCombobox({ value, onChange, existing, error }: {
  value: string; onChange: (v: string) => void; existing: string[]; error?: string
}) {
  const [open, setOpen]     = useState(false)
  const [cursor, setCursor] = useState(-1)
  const wrapRef             = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    return q ? existing.filter(n => n.toLowerCase().includes(q)) : existing
  }, [value, existing])

  const exactMatch   = existing.some(n => n.toLowerCase() === value.trim().toLowerCase())
  const showAddNew   = value.trim().length > 0 && !exactMatch

  // total options: filtered list + optional "Add new" entry
  const totalOptions = filtered.length + (showAddNew ? 1 : 0)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function pick(name: string) { onChange(name); setOpen(false); setCursor(-1) }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); setCursor(0); e.preventDefault() } return }
    if (e.key === 'ArrowDown') { setCursor(c => Math.min(c + 1, totalOptions - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setCursor(c => Math.max(c - 1, 0));                e.preventDefault() }
    if (e.key === 'Enter' && cursor >= 0) {
      if (cursor < filtered.length) pick(filtered[cursor])
      else if (showAddNew) pick(value.trim())
      e.preventDefault()
    }
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        placeholder="Search or type new name…"
        value={value}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); setCursor(-1) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
          error ? 'border-red-400 focus:ring-red-400/30 bg-red-50/20' : 'border-gray-200 focus:ring-emerald-500/30 focus:border-emerald-400'
        }`}
      />
      {open && (filtered.length > 0 || showAddNew) && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto z-50">
          {filtered.map((name, i) => (
            <li key={name}
              onMouseDown={e => { e.preventDefault(); pick(name) }}
              onMouseEnter={() => setCursor(i)}
              className={`flex items-center px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                i === cursor ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'text-gray-700 hover:bg-emerald-50'
              }`}
            >
              {name}
            </li>
          ))}
          {showAddNew && (
            <li
              onMouseDown={e => { e.preventDefault(); pick(value.trim()) }}
              onMouseEnter={() => setCursor(filtered.length)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer border-t border-gray-100 transition-colors font-medium ${
                cursor === filtered.length ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <Plus size={13} />
              Add "{value.trim()}"
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

// ─── Pipe Autocomplete ────────────────────────────────────────────────────────
function PipeAutocomplete({ value, onChange, options, loading }: {
  value: string; onChange: (v: string) => void; options: PipeOption[]; loading: boolean
}) {
  const [open, setOpen]     = useState(false)
  const [cursor, setCursor] = useState(-1)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    return q ? options.filter(o => o.pipeName.toLowerCase().includes(q)) : options
  }, [value, options])

  const pick = (v: string) => { onChange(v); setOpen(false); setCursor(-1) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); setCursor(0); e.preventDefault() } return }
    if (e.key === 'ArrowDown') { setCursor(c => Math.min(c + 1, filtered.length - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setCursor(c => Math.max(c - 1, 0));                   e.preventDefault() }
    if (e.key === 'Enter' && cursor >= 0) { pick(filtered[cursor].pipeName); e.preventDefault() }
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  return (
    <div className="relative">
      <input type="text" placeholder={loading ? 'Loading pipes…' : 'Search pipe (final tested)…'}
        value={value} disabled={loading}
        onChange={e => { onChange(e.target.value); setOpen(true); setCursor(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown} autoComplete="off"
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors disabled:bg-gray-50 disabled:text-gray-400" />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto" style={{ zIndex: 9999 }}>
          {filtered.map((o, i) => (
            <li key={o.pipeName}
              onMouseDown={e => { e.preventDefault(); pick(o.pipeName) }}
              onMouseEnter={() => setCursor(i)}
              className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-colors ${i === cursor ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'text-gray-700 hover:bg-emerald-50'}`}>
              <span className="font-medium">{o.pipeName}</span>
              <span className={`text-xs font-bold tabular-nums ${i === cursor ? 'text-white/80' : 'text-emerald-600'}`}>
                {o.available} avail.
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && !loading && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-xs text-gray-400 text-center" style={{ zIndex: 9999 }}>
          No pipes in final testing
        </div>
      )}
    </div>
  )
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div onClick={e => { e.stopPropagation(); onChange() }}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white hover:border-emerald-400'}`}>
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  )
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function EntryModal({ initial, onSave, onClose, pipeOptions, loadingPipes, thirdPartyOptions }: {
  initial?:           PDIEntry
  onSave:             (data: PDIFormData[]) => void
  onClose:            () => void
  pipeOptions:        PipeOption[]
  loadingPipes:       boolean
  thirdPartyOptions:  string[]
}) {
  const isEdit = !!initial

  const [date,       setDate]       = useState(initial?.date       ?? todayStr())
  const [thirdParty, setThirdParty] = useState(initial?.thirdParty ?? '')
  // single-pipe fields (edit mode only)
  const [pipeName,   setPipeName]   = useState(initial?.pipeName   ?? '')
  const [quantity,   setQuantity]   = useState(initial?.quantity != null ? String(initial.quantity) : '')
  // multi-pipe rows (add mode)
  const [pipeRows,   setPipeRows]   = useState<PipeRow[]>([newRow()])
  const [checks,     setChecks]     = useState<CheckMap>(initial ? {
    finishing:     initial.finishing,
    colour:        initial.colour,
    numbering:     initial.numbering,
    ghola:         initial.ghola,
    qualityCheck:  initial.qualityCheck,
    diameterCheck: initial.diameterCheck,
  } : emptyChecks())
  const [notes,      setNotes]      = useState(initial?.notes ?? '')
  const [saving,     setSaving]     = useState(false)
  const [errors,     setErrors]     = useState<Record<string, string>>({})

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const toggleCheck = (key: CheckKey) => setChecks(c => ({ ...c, [key]: !c[key] }))

  const updateRow = (id: string, field: 'pipeName' | 'quantity', value: string) => {
    setPipeRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
    setErrors(prev => { const n = { ...prev }; delete n[`row-${id}`]; return n })
  }
  const addRow    = () => setPipeRows(rows => [...rows, newRow()])
  const removeRow = (id: string) => setPipeRows(rows => rows.filter(r => r.id !== id))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!date)              errs.date       = 'Please select a date'
    if (!thirdParty.trim()) errs.thirdParty = 'Please enter the third party name'

    if (isEdit) {
      if (!pipeName.trim())                       errs.pipeName = 'Please enter a pipe name'
      if (!quantity || parseFloat(quantity) <= 0) errs.quantity = 'Please enter a valid quantity'
    } else {
      pipeRows.forEach(r => {
        if (!r.pipeName.trim() || !r.quantity || parseFloat(r.quantity) <= 0)
          errs[`row-${r.id}`] = 'Pipe name and quantity required'
      })
    }

    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)

    const base = { date, thirdParty: thirdParty.trim(), checks, notes: notes.trim() }
    const payload: PDIFormData[] = isEdit
      ? [{ ...base, pipeName: pipeName.trim(), quantity }]
      : pipeRows.map(r => ({ ...base, pipeName: r.pipeName.trim(), quantity: r.quantity }))

    setTimeout(() => { onSave(payload); setSaving(false) }, 250)
  }

  const passed = CHECKS.filter(c => checks[c.key]).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ClipboardCheck size={15} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Edit PDI Entry' : 'Add PDI Entry'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

            {/* Date + Third Party */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input type="date" value={date}
                  onChange={e => { setDate(e.target.value); setErrors(p => { const n = {...p}; delete n.date; return n }) }}
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${errors.date ? 'border-red-400 focus:ring-red-400/30 bg-red-50/20' : 'border-gray-200 focus:ring-emerald-500/30 focus:border-emerald-400'}`} />
                {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Third Party Name <span className="text-red-500">*</span></label>
                <ThirdPartyCombobox
                  value={thirdParty}
                  onChange={v => { setThirdParty(v); setErrors(p => { const n = {...p}; delete n.thirdParty; return n }) }}
                  existing={thirdPartyOptions}
                  error={errors.thirdParty}
                />
                {errors.thirdParty && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.thirdParty}</p>}
              </div>
            </div>

            {/* ── Pipes section ── */}
            {isEdit ? (
              /* Edit mode: single pipe */
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Pipe Name <span className="text-red-500">*</span></label>
                  <div className={errors.pipeName ? 'ring-1 ring-red-400 rounded-xl' : ''}>
                    <PipeAutocomplete value={pipeName}
                      onChange={v => { setPipeName(v); setErrors(p => { const n = {...p}; delete n.pipeName; return n }) }}
                      options={pipeOptions} loading={loadingPipes} />
                  </div>
                  {errors.pipeName && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.pipeName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="1" placeholder="Enter quantity…" value={quantity}
                    onChange={e => { setQuantity(e.target.value); setErrors(p => { const n = {...p}; delete n.quantity; return n }) }}
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${errors.quantity ? 'border-red-400 focus:ring-red-400/30 bg-red-50/20' : 'border-gray-200 focus:ring-emerald-500/30 focus:border-emerald-400'}`} />
                  {errors.quantity && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.quantity}</p>}
                </div>
              </div>
            ) : (
              /* Add mode: multi-pipe rows */
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Pipes <span className="text-red-500">*</span>
                    <span className="ml-1.5 text-[10px] font-normal text-gray-400 normal-case tracking-normal">({pipeRows.length} {pipeRows.length === 1 ? 'pipe type' : 'pipe types'})</span>
                  </label>
                  <button type="button" onClick={addRow}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                    <PlusCircle size={13} /> Add Pipe
                  </button>
                </div>

                <div className="space-y-2">
                  {pipeRows.map((row, idx) => (
                    <div key={row.id} className={`flex items-start gap-2 p-2.5 rounded-xl border transition-colors ${errors[`row-${row.id}`] ? 'border-red-300 bg-red-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                      {/* Row number */}
                      <span className="text-[11px] font-bold text-gray-300 mt-3 w-4 shrink-0 text-center">{idx + 1}</span>

                      {/* Pipe autocomplete */}
                      <div className="flex-1 min-w-0">
                        <PipeAutocomplete
                          value={row.pipeName}
                          onChange={v => updateRow(row.id, 'pipeName', v)}
                          options={pipeOptions}
                          loading={loadingPipes}
                        />
                      </div>

                      {/* Quantity */}
                      <div className="w-24 shrink-0">
                        <input type="number" min="0" step="1" placeholder="Qty"
                          value={row.quantity}
                          onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors" />
                      </div>

                      {/* Remove */}
                      <button type="button" onClick={() => removeRow(row.id)}
                        disabled={pipeRows.length === 1}
                        className="w-8 h-9 mt-0.5 shrink-0 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-0 disabled:pointer-events-none">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Row-level errors */}
                {pipeRows.some(r => errors[`row-${r.id}`]) && (
                  <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500">
                    <AlertTriangle size={11} /> All pipes must have a name and quantity
                  </p>
                )}
              </div>
            )}

            {/* Inspection Checks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inspection Checks</p>
                {passed > 0 && (
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {passed}/{CHECKS.length} passed
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CHECKS.map(({ key, label }) => (
                  <div key={key}
                    onClick={() => toggleCheck(key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                      checks[key] ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/50 hover:border-emerald-200'
                    }`}>
                    <Checkbox checked={checks[key]} onChange={() => toggleCheck(key)} />
                    <span className={`text-sm font-medium ${checks[key] ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
              <textarea rows={2} placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors resize-none" />
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
              {isEdit ? 'Save Changes' : pipeRows.length > 1 ? `Add ${pipeRows.length} Entries` : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteModal({ entry, onConfirm, onClose }: { entry: PDIEntry; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Delete PDI Entry</h3>
            <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">Delete PDI entry for <span className="font-semibold">{entry.pipeName}</span> on <span className="font-semibold">{fmtDate(entry.date)}</span>?</p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Check Badge ──────────────────────────────────────────────────────────────
function CheckBadge({ passed }: { passed: boolean }) {
  return passed
    ? <CheckCircle2 size={15} className="text-emerald-500" />
    : <MinusCircle  size={15} className="text-gray-200"    />
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PDIPage() {
  const navigate = useNavigate()
  const [entries, setEntries]   = useState<PDIEntry[]>([])
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<PDIEntry | null>(null)
  const [deleting, setDeleting] = useState<PDIEntry | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')

  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    pdisApi.list(fromDate || undefined, toDate || undefined)
      .then(setEntries)
      .catch(() => toast.error('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  const { data: pipeOptions = [], isLoading: loadingPipes } = useQuery({
    queryKey: ['final-testing-pipes-for-pdi'],
    queryFn: async () => {
      // Use stage-wise inventory so available = Final Testing completed − already in PDI
      const res = await import('@/services/api').then(m => m.inventoryApi.getStageWise({}))
      const rows: any[] = res.data.data ?? []
      return rows
        .filter((r: any) => r.stageType === 'FINAL_TESTING' && r.pipesCompleted > 0)
        .map((r: any) => ({ pipeName: r.pipeConfig, available: r.pipesCompleted }))
        .sort((a: any, b: any) => a.pipeName.localeCompare(b.pipeName))
    },
    staleTime: 2 * 60 * 1000,
  })

  const filtered = useMemo(() => entries, [entries])

  const thirdPartyOptions = useMemo(() =>
    [...new Set(entries.map(e => e.thirdParty).filter(Boolean))].sort()
  , [entries])

  const totalQty = useMemo(() =>
    filtered.reduce((s, e) => s + (Number(e.quantity) || 0), 0),
    [filtered]
  )

  const handleAdd = async (dataArr: PDIFormData[]) => {
    try {
      const created = await Promise.all(
        dataArr.map(data => { const { checks, ...rest } = data; return pdisApi.create({ ...rest, ...checks, quantity: Number(rest.quantity) || 0 }) })
      )
      setEntries(prev => [...created.reverse(), ...prev])
      setShowAdd(false)
      toast.success(created.length > 1 ? `${created.length} PDI entries added` : 'PDI entry added')
    } catch { toast.error('Failed to add entry') }
  }
  const handleEdit = async (dataArr: PDIFormData[]) => {
    try {
      const data = dataArr[0]
      const { checks, ...rest } = data
      const updated = await pdisApi.update(editing!.id, { ...rest, ...checks, quantity: Number(rest.quantity) || 0 })
      setEntries(prev => prev.map(e => e.id === editing!.id ? updated : e))
      setEditing(null)
      toast.success('Entry updated')
    } catch { toast.error('Failed to update entry') }
  }
  const handleDelete = async () => {
    try {
      await pdisApi.delete(deleting!.id)
      setEntries(prev => prev.filter(e => e.id !== deleting!.id))
      setDeleting(null)
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete entry') }
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.28)]">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Title + date filter row (all inline) */}
        <div className="relative px-8 pt-6 pb-5">
          {/* Top line: back + icon + title + Add Entry */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-5 min-w-0">
              <button
                onClick={() => navigate('/business')}
                className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0 mt-0.5"
              >
                <ArrowLeft size={16} className="text-white" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
                <ClipboardCheck size={26} className="text-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business</p>
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">PDI</h1>
                {/* Subtitle + date filters on the same line */}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <p className="text-sm text-blue-200 whitespace-nowrap">Pre-Dispatch Inspection — quality checks before dispatch</p>
                  <div className="w-px h-4 bg-white/20 shrink-0 hidden sm:block" />
                  <DateRangePicker fromDate={fromDate} toDate={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
                </div>
              </div>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all active:scale-95 shrink-0 mt-1">
              <Plus size={16} /> Add Entry
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-3 divide-x divide-white/10">
          {[
            { label: 'Total Entries',    value: filtered.length,                                                          sub: 'PDI records' },
            { label: 'Pipes Inspected',  value: totalQty.toLocaleString('en-IN'),                                         sub: 'total quantity' },
            { label: 'Avg Checks Passed',value: filtered.length ? (filtered.reduce((s,e) => s + passCount(e), 0) / filtered.length).toFixed(1) : '—', sub: `out of ${CHECKS.length}` },
          ].map(s => (
            <div key={s.label} className="px-6 py-3.5">
              <p className="text-xl font-extrabold text-white tabular-nums leading-none">{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(16,185,129,0.10), 0 1.5px 6px rgba(0,0,0,0.07)' }}>
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-600 to-blue-600">
              <th className="px-4 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Date</th>
              <th className="px-4 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Third Party</th>
              <th className="px-4 py-4 text-left   text-xs font-bold text-white uppercase tracking-wider">Pipe Name</th>
              <th className="px-4 py-4 text-right  text-xs font-bold text-white uppercase tracking-wider">Qty</th>
              <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Finishing</th>
              <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Colour</th>
              <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Numbering</th>
              <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Ghola</th>
              <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Quality Check</th>
              <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Diameter Check</th>
              <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-16 text-center">
                  <ClipboardCheck size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">{entries.length === 0 ? 'No PDI entries yet' : 'No entries for selected date range'}</p>
                  <p className="text-xs text-gray-300 mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started' : 'Try adjusting the date filter'}</p>
                </td>
              </tr>
            ) : (
              filtered.map(entry => {
                const pc = passCount(entry)
                return (
                  <>
                    <tr key={entry.id} className="hover:bg-emerald-50/20 transition-colors">

                      <td className="px-4 py-3.5">
                        <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{fmtDate(entry.date)}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-sm font-semibold text-gray-700">{entry.thirdParty}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-sm text-gray-700">{entry.pipeName}</span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-bold text-emerald-700 tabular-nums">{Number(entry.quantity).toLocaleString('en-IN')}</span>
                      </td>

                      <td className="px-4 py-3.5 text-center"><CheckBadge passed={entry.finishing}     /></td>
                      <td className="px-4 py-3.5 text-center"><CheckBadge passed={entry.colour}        /></td>
                      <td className="px-4 py-3.5 text-center"><CheckBadge passed={entry.numbering}     /></td>
                      <td className="px-4 py-3.5 text-center"><CheckBadge passed={entry.ghola}         /></td>
                      <td className="px-4 py-3.5 text-center"><CheckBadge passed={entry.qualityCheck}  /></td>
                      <td className="px-4 py-3.5 text-center"><CheckBadge passed={entry.diameterCheck} /></td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mr-1 ${
                            pc === CHECKS.length ? 'bg-emerald-100 text-emerald-700' :
                            pc > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                          }`}>{pc}/{CHECKS.length}</span>
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
                    </tr>

                    {/* Notes sub-row */}
                    <tr key={`${entry.id}-notes`} className="border-b border-gray-50">
                      <td colSpan={11} className="px-4 pb-3 pt-0">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mt-0.5 shrink-0">Notes</span>
                          <span className="text-xs text-gray-500 leading-relaxed">
                            {entry.notes || <span className="italic text-gray-300">—</span>}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </>
                )
              })
            )}
          </tbody>

          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50/50">
                <td colSpan={3} className="px-4 py-3.5 text-xs font-extrabold text-violet-600 uppercase tracking-widest">Total Inspected</td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-500 tabular-nums">
                    {totalQty.toLocaleString('en-IN')}
                  </span>
                </td>
                <td colSpan={7} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showAdd  && <EntryModal onSave={handleAdd}  onClose={() => setShowAdd(false)} pipeOptions={pipeOptions} loadingPipes={loadingPipes} thirdPartyOptions={thirdPartyOptions} />}
      {editing  && <EntryModal initial={editing}   onSave={handleEdit} onClose={() => setEditing(null)} pipeOptions={pipeOptions} loadingPipes={loadingPipes} thirdPartyOptions={thirdPartyOptions} />}
      {deleting && <DeleteModal entry={deleting}   onConfirm={handleDelete} onClose={() => setDeleting(null)} />}
    </div>
  )
}
