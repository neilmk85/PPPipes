import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format, subDays, startOfMonth, addMonths, subMonths,
  endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isWithinInterval, isBefore, parseISO,
} from 'date-fns'
import { Users, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, ArrowLeft, Clock, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { labourApi, type LabourEntry } from '@/services/businessApi'
import { vendorApi } from '@/services/api'

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'Today',       from: () => format(new Date(), 'yyyy-MM-dd'),              to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 7d',    from: () => format(subDays(new Date(), 6), 'yyyy-MM-dd'),   to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 30d',   from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'),  to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month', from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
]

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function EntryModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: LabourEntry
  onSave: (entry: Omit<LabourEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    date:           initial?.date           ?? today(),
    contractorName: initial?.contractorName ?? '',
    labourCount:    initial?.labourCount    != null ? String(initial.labourCount) : '',
    ratePerDay:     initial?.ratePerDay     ?? '',
    notes:          initial?.notes          ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function set(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => { const next = { ...prev }; delete next[k]; return next })
  }

  function handleSave() {
    const errs: Record<string, string> = {}
    if (!form.date)                                          errs.date           = 'Please select a date'
    if (!form.contractorName.trim())                        errs.contractorName = 'Contractor name is required'
    if (!form.labourCount || Number(form.labourCount) <= 0) errs.labourCount    = 'Number of labours must be greater than 0'
    if (form.ratePerDay && parseFloat(form.ratePerDay) < 0) errs.ratePerDay     = 'Rate cannot be negative'
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({
      date:                form.date,
      contractorName:      form.contractorName.trim(),
      labourCount:         Number(form.labourCount),
      ratePerDay:          form.ratePerDay.trim(),
      // preserve existing OT when editing; blank when creating
      overtimeHours:        initial?.overtimeHours        ?? '',
      overtimeLabourCount:  initial?.overtimeLabourCount  ?? 0,
      overtimeRatePerHour:  initial?.overtimeRatePerHour  ?? '',
      notes:                form.notes.trim(),
    })
    onClose()
  }

  const rateNum    = parseFloat(form.ratePerDay) || 0
  const countNum   = parseInt(form.labourCount)  || 0
  const totalDaily = rateNum > 0 && countNum > 0 ? rateNum * countNum : null

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition'
  const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <h3 className="font-bold text-white text-sm">
              {initial ? 'Edit Labour Entry' : 'Add Labour Entry'}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Date */}
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" value={form.date} max={today()} onChange={e => set('date', e.target.value)} className={`${inputCls}${errors.date ? ' border-red-400 focus:ring-red-400' : ''}`} />
            {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
          </div>

          {/* Contractor Name */}
          <div>
            <label className={labelCls}>Contractor Name *</label>
            <input
              type="text"
              value={form.contractorName}
              onChange={e => set('contractorName', e.target.value)}
              placeholder="Enter contractor / agency name"
              className={`${inputCls}${errors.contractorName ? ' border-red-400 focus:ring-red-400' : ''}`}
            />
            {errors.contractorName && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.contractorName}</p>}
          </div>

          {/* Labour Count + Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>No. of Labours *</label>
              <input
                type="number" min="1" step="1"
                value={form.labourCount}
                onChange={e => set('labourCount', e.target.value)}
                placeholder="0"
                className={`${inputCls}${errors.labourCount ? ' border-red-400 focus:ring-red-400' : ''}`}
              />
              {errors.labourCount && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.labourCount}</p>}
            </div>
            <div>
              <label className={labelCls}>Rate / Day / Labour <span className="normal-case font-normal">(optional)</span></label>
              <input
                type="text" inputMode="decimal"
                min="0"
                value={form.ratePerDay}
                onChange={e => set('ratePerDay', e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="₹ 0.00"
                className={`${inputCls}${errors.ratePerDay ? ' border-red-400 focus:ring-red-400' : ''}`}
              />
              {errors.ratePerDay && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.ratePerDay}</p>}
            </div>
          </div>

          {/* Total preview */}
          {totalDaily !== null && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-violet-50 rounded-xl border border-violet-100 text-sm">
              <span className="text-violet-600 font-medium">Daily Total</span>
              <span className="font-bold text-violet-800 tabular-nums">
                ₹ {totalDaily.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-violet-400 font-normal text-xs ml-1">({countNum} × ₹{rateNum})</span>
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes <span className="normal-case font-normal">(optional)</span></label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Any additional details…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-5 py-2 rounded-xl font-semibold text-sm shadow-md shadow-violet-200 transition-all"
          >
            {initial ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── shared OT form (used by both modals below) ──────────────────────────────

function OTForm({
  entry,
  onSave,
  onClose,
}: {
  entry:   LabourEntry
  onSave:  (overtimeHours: string, overtimeLabourCount: number, overtimeRatePerHour: string) => void
  onClose: () => void
}) {
  const [hours, setHours] = useState(entry.overtimeHours ?? '')
  const [count, setCount] = useState(
    (entry.overtimeLabourCount ?? 0) > 0 ? String(entry.overtimeLabourCount) : ''
  )
  const [rate, setRate] = useState(entry.overtimeRatePerHour ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const hoursNum    = parseFloat(hours) || 0
  const countNum    = parseInt(count)   || 0
  const rateNum     = parseFloat(rate)  || 0
  const totalOTHrs  = hoursNum > 0 && countNum > 0 ? hoursNum * countNum : null
  const totalCost   = totalOTHrs !== null && rateNum > 0 ? totalOTHrs * rateNum : null
  const hasExisting = hoursNum > 0 || countNum > 0

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition'
  const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'

  function handleSave() {
    const errs: Record<string, string> = {}
    if (hoursNum > 0 && countNum <= 0) errs.count = 'Enter number of labours who did overtime'
    if (countNum > 0 && hoursNum <= 0) errs.hours = 'Enter overtime hours'
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave(hours.trim(), countNum, rate.trim())
    onClose()
  }

  function handleClear() {
    onSave('', 0, '')
    onClose()
  }

  return (
    <div className="p-6 space-y-4">
      {/* Context pill */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
        <Users size={13} className="text-amber-500 shrink-0" />
        <span className="text-xs text-amber-700">
          <span className="font-semibold">{entry.labourCount}</span> labours present on {fmtDate(entry.date)}
        </span>
      </div>

      {/* OT Hours + No. of Labours */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>OT Hours *</label>
          <input type="number" min="0" step="0.5" value={hours}
            onChange={e => { setHours(e.target.value); setErrors(prev => { const next = { ...prev }; delete next.hours; return next }) }}
            placeholder="e.g. 2.5"
            className={`${inputCls}${errors.hours ? ' border-red-400 focus:ring-red-400' : ''}`}
            autoFocus />
          {errors.hours
            ? <p className="flex items-center gap-1 mt-1 text-xs text-red-500"><AlertTriangle size={11} /> {errors.hours}</p>
            : <p className="text-[10px] text-gray-400 mt-1">Supports decimals (½ h = 0.5)</p>
          }
        </div>
        <div>
          <label className={labelCls}>No. of Labours *</label>
          <input type="number" min="0" step="1" value={count}
            onChange={e => { setCount(e.target.value); setErrors(prev => { const next = { ...prev }; delete next.count; return next }) }}
            placeholder="0"
            className={`${inputCls}${errors.count ? ' border-red-400 focus:ring-red-400' : ''}`} />
          {errors.count
            ? <p className="flex items-center gap-1 mt-1 text-xs text-red-500"><AlertTriangle size={11} /> {errors.count}</p>
            : <p className="text-[10px] text-gray-400 mt-1">Who worked overtime</p>
          }
        </div>
      </div>

      {/* Rate per hour */}
      <div>
        <label className={labelCls}>Rate / Hour / Labour <span className="normal-case font-normal text-gray-300">(optional)</span></label>
        <input type="number" min="0" step="0.01" value={rate}
          onChange={e => setRate(e.target.value)} placeholder="₹ 0.00" className={inputCls} />
      </div>

      {/* Preview */}
      {totalOTHrs !== null && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-700 font-medium">Total OT</span>
            <span className="font-bold text-amber-800 tabular-nums">
              {totalOTHrs.toLocaleString('en-IN', { maximumFractionDigits: 1 })} labour-hrs
              <span className="text-amber-400 font-normal text-xs ml-1.5">({countNum} × {hoursNum}h)</span>
            </span>
          </div>
          {totalCost !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-700 font-medium">OT Cost</span>
              <span className="font-bold text-emerald-700 tabular-nums">
                ₹ {totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button onClick={handleClear} disabled={!hasExisting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed enabled:text-red-500 enabled:hover:text-red-700 enabled:hover:bg-red-50">
          <X size={12} /> Clear OT
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">Cancel</button>
          <button onClick={handleSave}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2 rounded-xl font-semibold text-sm shadow-md shadow-amber-200 transition-all">
            <Clock size={14} />
            Save OT
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Row OT modal (entry always known) ───────────────────────────────────────

function OvertimeModal({ entry, onSave, onClose }: {
  entry:   LabourEntry
  onSave:  (overtimeHours: string, overtimeLabourCount: number, overtimeRatePerHour: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-400 to-orange-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Record Overtime</h3>
              <p className="text-xs text-amber-100 mt-0.5 truncate max-w-[200px]">
                {entry.contractorName} · {fmtDate(entry.date)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        <OTForm entry={entry} onSave={onSave} onClose={onClose} />
      </div>
    </div>
  )
}

// ─── Header "Add OT" modal — standalone form with vendor search ───────────────

interface AddOTFormData {
  contractorName:      string
  date:                string
  overtimeHours:       string
  overtimeLabourCount: number
  overtimeRatePerHour: string
}

function AddOTModal({ onSave, onClose }: {
  onSave:  (data: AddOTFormData) => void
  onClose: () => void
}) {
  const [contractorName, setContractorName] = useState('')
  const [dropOpen,       setDropOpen]       = useState(false)
  const [date,           setDate]           = useState(today())
  const [hours,  setHours]  = useState('')
  const [count,  setCount]  = useState('')
  const [rate,   setRate]   = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const wrapRef = useRef<HTMLDivElement>(null)

  const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'
  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition'

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // fetch vendors with correct data path
  const { data: vendors = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['vendors-for-ot'],
    queryFn:  () => vendorApi.getAll().then((r: any) => {
      const raw = r?.data?.data
      if (Array.isArray(raw)) return raw
      if (raw?.content && Array.isArray(raw.content)) return raw.content
      return []
    }),
    staleTime: 60_000,
  })

  // filtered suggestions
  const suggestions = useMemo(() => {
    const q = contractorName.trim().toLowerCase()
    if (!q) return vendors.slice(0, 8)
    return vendors.filter(v => (v.name || '').toLowerCase().includes(q)).slice(0, 8)
  }, [contractorName, vendors])

  // close dropdown on outside click
  useEffect(() => {
    function onDown(ev: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const hoursNum   = parseFloat(hours) || 0
  const countNum   = parseInt(count)   || 0
  const rateNum    = parseFloat(rate)  || 0
  const totalOTHrs = hoursNum > 0 && countNum > 0 ? hoursNum * countNum : null
  const totalCost  = totalOTHrs !== null && rateNum > 0 ? totalOTHrs * rateNum : null

  function handleSave() {
    const errs: Record<string, string> = {}
    if (!contractorName.trim()) errs.contractorName = 'Enter contractor name'
    if (!date)                  errs.date           = 'Select a date'
    if (hoursNum <= 0)          errs.hours          = 'Enter overtime hours'
    if (countNum <= 0)          errs.count          = 'Enter number of labours'
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({ contractorName: contractorName.trim(), date, overtimeHours: hours.trim(), overtimeLabourCount: countNum, overtimeRatePerHour: rate.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-400 to-orange-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Add Overtime</h3>
              <p className="text-xs text-amber-100 mt-0.5">Record contractor overtime</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Contractor search */}
          <div>
            <label className={labelCls}>Contractor *</label>
            <div ref={wrapRef} className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <Search size={14} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={contractorName}
                onChange={e => { setContractorName(e.target.value); setDropOpen(true); setErrors(prev => { const next = { ...prev }; delete next.contractorName; return next }) }}
                onFocus={() => setDropOpen(true)}
                placeholder="Search vendor / contractor name…"
                autoFocus
                className={`w-full bg-white border rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition${errors.contractorName ? ' border-red-400 focus:ring-red-400' : ' border-gray-200 focus:ring-amber-400'}`}
              />
              {dropOpen && suggestions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-h-44 overflow-y-auto">
                  {suggestions.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onMouseDown={() => { setContractorName(v.name); setDropOpen(false); setErrors(prev => { const next = { ...prev }; delete next.contractorName; return next }) }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${
                        contractorName === v.name ? 'bg-amber-50 font-semibold text-amber-700' : 'text-gray-700 hover:bg-amber-50'
                      }`}
                    >
                      <Users size={13} className="text-gray-400 shrink-0" />
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.contractorName && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.contractorName}</p>}
          </div>

          {/* Date */}
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" value={date} max={today()} onChange={e => { setDate(e.target.value); setErrors(prev => { const next = { ...prev }; delete next.date; return next }) }} className={`${inputCls}${errors.date ? ' border-red-400 focus:ring-red-400' : ''}`} />
            {errors.date && <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500"><AlertTriangle size={11} /> {errors.date}</p>}
          </div>

          {/* OT Hours + Labours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>OT Hours *</label>
              <input type="number" min="0" step="0.5" value={hours}
                onChange={e => { setHours(e.target.value); setErrors(prev => { const next = { ...prev }; delete next.hours; return next }) }}
                placeholder="e.g. 2.5"
                className={`${inputCls}${errors.hours ? ' border-red-400 focus:ring-red-400' : ''}`} />
              {errors.hours
                ? <p className="flex items-center gap-1 mt-1 text-xs text-red-500"><AlertTriangle size={11} /> {errors.hours}</p>
                : <p className="text-[10px] text-gray-400 mt-1">Supports decimals (½ h = 0.5)</p>
              }
            </div>
            <div>
              <label className={labelCls}>Total Labours *</label>
              <input type="number" min="1" step="1" value={count}
                onChange={e => { setCount(e.target.value); setErrors(prev => { const next = { ...prev }; delete next.count; return next }) }}
                placeholder="0"
                className={`${inputCls}${errors.count ? ' border-red-400 focus:ring-red-400' : ''}`} />
              {errors.count
                ? <p className="flex items-center gap-1 mt-1 text-xs text-red-500"><AlertTriangle size={11} /> {errors.count}</p>
                : <p className="text-[10px] text-gray-400 mt-1">Who worked overtime</p>
              }
            </div>
          </div>

          {/* Rate per hour */}
          <div>
            <label className={labelCls}>Rate / Hour / Labour <span className="normal-case font-normal text-gray-300">(optional)</span></label>
            <input type="number" min="0" step="0.01" value={rate}
              onChange={e => setRate(e.target.value)} placeholder="₹ 0.00" className={inputCls} />
          </div>

          {/* Preview */}
          {totalOTHrs !== null && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700 font-medium">Total OT</span>
                <span className="font-bold text-amber-800 tabular-nums">
                  {totalOTHrs.toLocaleString('en-IN', { maximumFractionDigits: 1 })} labour-hrs
                  <span className="text-amber-400 font-normal text-xs ml-1.5">({countNum} × {hoursNum}h)</span>
                </span>
              </div>
              {totalCost !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-700 font-medium">OT Cost</span>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    ₹ {totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">
            Cancel
          </button>
          <button onClick={handleSave}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2 rounded-xl font-semibold text-sm shadow-md shadow-amber-200 transition-all">
            <Clock size={14} />
            Save OT
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ entry, onConfirm, onClose }: {
  entry: LabourEntry
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-red-600 to-rose-500">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <AlertTriangle size={16} className="text-white" />
          </div>
          <h3 className="font-bold text-white text-sm">Delete Entry?</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            Delete the entry for <span className="font-semibold text-gray-800">{entry.contractorName}</span> on{' '}
            <span className="font-semibold text-gray-800">{fmtDate(entry.date)}</span>?
            This cannot be undone.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-red-200"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Date Range Picker ───────────────────────────────────────────────────────

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function MonthGrid({
  month, selecting, hoverDate, onDayClick, onDayHover,
}: {
  month:      Date
  selecting:  { start: Date | null; end: Date | null }
  hoverDate:  Date | null
  onDayClick: (d: Date) => void
  onDayHover: (d: Date | null) => void
}) {
  const days       = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const offset     = getDay(startOfMonth(month))
  const effectEnd  = selecting.end ?? hoverDate

  function inRange(d: Date) {
    if (!selecting.start || !effectEnd) return false
    const lo = isBefore(selecting.start, effectEnd) ? selecting.start : effectEnd
    const hi = isBefore(selecting.start, effectEnd) ? effectEnd        : selecting.start
    return isWithinInterval(d, { start: lo, end: hi })
  }

  return (
    <div className="flex-1 min-w-0">
      <p className="text-center text-sm font-bold text-gray-800 mb-3">{format(month, 'MMMM yyyy')}</p>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(l => (
          <div key={l} className="text-center text-[10px] font-semibold text-gray-400 py-1">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: offset }).map((_, i) => <div key={i} />)}
        {days.map(day => {
          const isStart = selecting.start ? isSameDay(day, selecting.start) : false
          const isEnd   = effectEnd        ? isSameDay(day, effectEnd)       : false
          const ranged  = inRange(day) && !isStart && !isEnd
          const isToday = isSameDay(day, new Date())
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick(day)}
              onMouseEnter={() => onDayHover(day)}
              onMouseLeave={() => onDayHover(null)}
              className={[
                'h-8 w-full text-xs font-medium transition-colors',
                isStart || isEnd  ? 'bg-violet-600 text-white font-bold rounded-lg z-10 relative' : '',
                ranged            ? 'bg-violet-100 text-violet-800' : '',
                !ranged && !isStart && !isEnd ? 'text-gray-700 hover:bg-gray-100 rounded-lg' : '',
                isToday && !isStart && !isEnd ? 'ring-1 ring-inset ring-violet-400 rounded-lg' : '',
              ].filter(Boolean).join(' ')}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DateRangePicker({ from, to, onApply, onClear, onClose }: {
  from:    string
  to:      string
  onApply: (from: string, to: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const ref        = useRef<HTMLDivElement>(null)
  const [leftMonth, setLeftMonth] = useState(() =>
    from ? startOfMonth(parseISO(from)) : startOfMonth(new Date())
  )
  const rightMonth = addMonths(leftMonth, 1)
  const [selecting, setSelecting] = useState<{ start: Date | null; end: Date | null }>({
    start: from ? parseISO(from) : null,
    end:   to   ? parseISO(to)   : null,
  })
  const [hoverDate, setHoverDate] = useState<Date | null>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  function handleDayClick(day: Date) {
    if (!selecting.start || (selecting.start && selecting.end)) {
      setSelecting({ start: day, end: null })
    } else {
      if (isBefore(day, selecting.start)) {
        setSelecting({ start: day, end: selecting.start })
      } else {
        setSelecting({ start: selecting.start, end: day })
      }
    }
  }

  function handleHover(day: Date | null) {
    if (selecting.start && !selecting.end) setHoverDate(day)
  }

  function handleApply() {
    if (!selecting.start) return
    const end = selecting.end ?? selecting.start
    const lo  = isBefore(selecting.start, end) ? selecting.start : end
    const hi  = isBefore(selecting.start, end) ? end              : selecting.start
    onApply(format(lo, 'yyyy-MM-dd'), format(hi, 'yyyy-MM-dd'))
    onClose()
  }

  const effectEnd  = selecting.end ?? hoverDate
  const rangeLabel = selecting.start
    ? `${format(selecting.start, 'dd/MM/yyyy')} — ${effectEnd ? format(effectEnd, 'dd/MM/yyyy') : '…'}`
    : 'Click a start date'

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full mt-2 right-0 bg-white rounded-2xl shadow-2xl ring-1 ring-gray-100 p-5"
      style={{ width: 520 }}
    >
      {/* Month navigation + two grids */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setLeftMonth(m => subMonths(m, 1))}
          className="mt-1 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex flex-1 gap-6">
          <MonthGrid
            month={leftMonth}  selecting={selecting}
            hoverDate={hoverDate} onDayClick={handleDayClick} onDayHover={handleHover}
          />
          <MonthGrid
            month={rightMonth} selecting={selecting}
            hoverDate={hoverDate} onDayClick={handleDayClick} onDayHover={handleHover}
          />
        </div>
        <button
          type="button"
          onClick={() => setLeftMonth(m => addMonths(m, 1))}
          className="mt-1 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
        <span className="text-xs text-gray-500 tabular-nums">{rangeLabel}</span>
        <div className="flex items-center gap-2">
          {(from || to) && (
            <button
              type="button"
              onClick={() => { onClear(); onClose() }}
              className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
            >
              Clear
            </button>
          )}
          <button
            type="button" onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition"
          >
            Cancel
          </button>
          <button
            type="button" onClick={handleApply} disabled={!selecting.start}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LabourPage() {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const [showAdd, setShowAdd]           = useState(false)
  const [editing, setEditing]           = useState<LabourEntry | null>(null)
  const [deleting, setDeleting]         = useState<LabourEntry | null>(null)
  // otEntry = specific row's OT button; showOtModal = header button (no pre-selected entry)
  const [otEntry, setOtEntry]           = useState<LabourEntry | null>(null)
  const [showOtModal, setShowOtModal]   = useState(false)
  const [fromDate, setFromDate]         = useState('')
  const [toDate, setToDate]             = useState('')
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [activeTab, setActiveTab]       = useState<'labour' | 'ot'>('labour')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showCalendar,   setShowCalendar]   = useState(false)

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ['labour-entries', fromDate, toDate],
    queryFn: () => labourApi.list(fromDate || undefined, toDate || undefined),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<LabourEntry, 'id' | 'createdAt' | 'updatedAt'>) => labourApi.create(d),
    onSuccess: () => { refetch(); toast.success('Entry added') },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to add entry'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Omit<LabourEntry, 'id' | 'createdAt' | 'updatedAt'> }) => labourApi.update(id, d),
    onSuccess: () => {
      refetch()
      toast.success('Entry updated')
      setEditing(null)
      setOtEntry(null)
      setShowOtModal(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to update entry'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => labourApi.delete(id),
    onSuccess: () => { refetch(); toast.success('Entry deleted'); setDeleting(null) },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete entry'),
  })

  function applyPreset(p: typeof PRESETS[0]) {
    setFromDate(p.from()); setToDate(p.to()); setActivePreset(p.label)
  }
  function clearFilter() { setFromDate(''); setToDate(''); setActivePreset(null) }

  function saveOT(target: LabourEntry, overtimeHours: string, overtimeLabourCount: number, overtimeRatePerHour = '') {
    updateMut.mutate({
      id: target.id,
      d: {
        date:                target.date,
        contractorName:      target.contractorName,
        labourCount:         target.labourCount,
        ratePerDay:          target.ratePerDay,
        notes:               target.notes,
        overtimeHours,
        overtimeLabourCount,
        overtimeRatePerHour,
      },
    })
  }

  function handleAddOT(data: AddOTFormData) {
    const existing = entries.find(
      e => e.contractorName.toLowerCase() === data.contractorName.toLowerCase() && e.date === data.date
    )
    if (existing) {
      // Update OT on the matched entry
      updateMut.mutate({
        id: existing.id,
        d: {
          ...existing,
          overtimeHours:       data.overtimeHours,
          overtimeLabourCount: data.overtimeLabourCount,
          overtimeRatePerHour: data.overtimeRatePerHour,
        },
      })
    } else {
      // No entry yet for this date+contractor → create one with OT fields only
      createMut.mutate({
        date:                data.date,
        contractorName:      data.contractorName,
        labourCount:         data.overtimeLabourCount,
        ratePerDay:          '',
        overtimeHours:       data.overtimeHours,
        overtimeLabourCount: data.overtimeLabourCount,
        overtimeRatePerHour: data.overtimeRatePerHour,
        notes:               '',
      })
    }
  }

  // Summary stats
  const totalLabours = useMemo(() => entries.reduce((s, e) => s + (e.labourCount ?? 0), 0), [entries])
  const totalCost    = useMemo(() =>
    entries.reduce((s, e) => {
      const rate = parseFloat(e.ratePerDay) || 0
      return s + (rate * (e.labourCount ?? 0))
    }, 0)
  , [entries])
  const otEntries = useMemo(() =>
    entries.filter(e => parseFloat(e.overtimeHours) > 0 && (e.overtimeLabourCount ?? 0) > 0)
  , [entries])
  const totalOTHours = useMemo(() =>
    otEntries.reduce((s, e) => {
      const hrs   = parseFloat(e.overtimeHours) || 0
      const count = e.overtimeLabourCount ?? 0
      return s + (hrs * count)
    }, 0)
  , [otEntries])
  const totalOTCost = useMemo(() =>
    otEntries.reduce((s, e) => {
      const hrs   = parseFloat(e.overtimeHours) || 0
      const count = e.overtimeLabourCount ?? 0
      const rate  = parseFloat(e.overtimeRatePerHour) || 0
      return s + (hrs * count * rate)
    }, 0)
  , [otEntries])

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* ── Hero header ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(109,40,217,0.28)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center justify-between px-8 py-6">
          {/* Left: back + icon + title + tabs + date filter */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={() => navigate('/business')}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition shrink-0"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Users size={22} className="text-amber-300" />
            </div>
            <div className="shrink-0">
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Labour</h1>
              <p className="text-sm text-blue-200 mt-0.5">Daily contractor & labour attendance log</p>
            </div>

            {/* Separator */}
            <div className="w-px h-10 bg-white/20 mx-2 shrink-0" />

            {/* Tab pills */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setActiveTab('labour')}
                style={activeTab === 'labour' ? {boxShadow:'0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'} : undefined}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  activeTab === 'labour'
                    ? 'bg-white/25 border-white/60 text-white'
                    : 'bg-white/10 border-white/25 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Users size={13} />
                Labour Data
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                  {entries.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('ot')}
                style={activeTab === 'ot' ? {boxShadow:'0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'} : undefined}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  activeTab === 'ot'
                    ? 'bg-white/25 border-white/60 text-white'
                    : 'bg-white/10 border-white/25 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Clock size={13} />
                OT Data
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                  {otEntries.length}
                </span>
              </button>
            </div>

            {/* Date dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowDatePicker(p => !p)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  fromDate || toDate
                    ? 'bg-white text-violet-700 border-white shadow-sm'
                    : 'bg-white/10 border-white/25 text-white hover:bg-white/20'
                }`}
              >
                <Calendar size={13} />
                {activePreset
                  ? activePreset
                  : fromDate && toDate
                    ? `${fmtDate(fromDate)} – ${fmtDate(toDate)}`
                    : 'Filter by Date'
                }
                {(fromDate || toDate)
                  ? <X size={11} onClick={e => { e.stopPropagation(); clearFilter() }} className="ml-0.5 opacity-70 hover:opacity-100" />
                  : <ChevronRight size={11} className={`transition-transform ${showDatePicker ? 'rotate-90' : ''}`} />
                }
              </button>

            {showDatePicker && (
              <div className="absolute z-50 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl ring-1 ring-gray-100 overflow-hidden w-56">
                {/* Presets */}
                <div className="p-2 space-y-0.5">
                  {PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => { applyPreset(p); setShowDatePicker(false) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activePreset === p.label ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 p-2">
                  <button
                    onClick={() => { setActivePreset(null); setShowDatePicker(false); setTimeout(() => setShowCalendar(true), 0) }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      !activePreset && (fromDate || toDate) ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Calendar size={13} className="text-gray-400" />
                    Custom Range…
                  </button>
                </div>
              </div>
            )}

              {/* Calendar picker for custom range */}
              {showCalendar && (
                <div className="absolute left-0 top-full mt-2 z-50">
                  <DateRangePicker
                    from={fromDate}
                    to={toDate}
                    onApply={(f, t) => { setFromDate(f); setToDate(t); setActivePreset(null); setShowCalendar(false) }}
                    onClear={() => { clearFilter(); setShowCalendar(false) }}
                    onClose={() => setShowCalendar(false)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowOtModal(true)}
              className="inline-flex items-center gap-2 bg-amber-400/20 hover:bg-amber-400/35 border border-amber-300/40 text-amber-100 hover:text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition backdrop-blur-sm"
            >
              <Clock size={15} />
              Add OT
            </button>
            <button
              onClick={() => { setEditing(null); setOtEntry(null); setShowOtModal(false); setShowAdd(true) }}
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition backdrop-blur-sm"
            >
              <Plus size={15} />
              Add Entry
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          {[
            { label: 'Records',       value: entries.length,           sub: 'in selected range' },
            { label: 'Total Labours', value: totalLabours,             sub: 'labour-days logged' },
            { label: 'Total OT',      value: totalOTHours > 0 ? `${totalOTHours.toLocaleString('en-IN', { maximumFractionDigits: 1 })} h` : '—', sub: 'total labour-hours OT' },
            { label: 'Total Cost',    value: totalCost > 0 ? `₹${totalCost.toLocaleString('en-IN')}` : '—', sub: 'where rate is set' },
          ].map(s => (
            <div key={s.label} className="px-6 py-3.5">
              <p className="text-xl font-extrabold text-white tabular-nums leading-none">{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Full-width table ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100 overflow-hidden">

        {/* ── LABOUR DATA ─────────────────────────────────────────────── */}
        {activeTab === 'labour' && (
          <>
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-500 to-blue-500">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <Users size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Labour Entries</h2>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {isLoading ? 'Loading…' : `${entries.length} record${entries.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setEditing(null); setOtEntry(null); setShowOtModal(false); setShowAdd(true) }}
                className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                <Plus size={13} /> Add Entry
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Loading entries…</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <Users size={36} className="opacity-20" />
                <p className="text-sm font-medium">No labour entries found</p>
                <p className="text-xs text-gray-300">{fromDate || toDate ? 'Try a different date range' : 'Add your first entry above'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-white">
                      <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Date</th>
                      <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Contractor</th>
                      <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Labours</th>
                      <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Rate / Day</th>
                      <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Daily Total</th>
                      <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Notes</th>
                      <th className="px-5 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => {
                      const rate       = parseFloat(entry.ratePerDay) || 0
                      const dailyTotal = rate > 0 ? rate * entry.labourCount : null
                      return (
                        <tr key={entry.id} className={`border-t border-gray-50 hover:bg-violet-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-500">
                            {fmtDate(entry.date)}
                          </td>
                          <td className="px-5 py-3 text-gray-800">{entry.contractorName}</td>
                          <td className="px-5 py-3 text-center text-violet-700 tabular-nums">
                            {entry.labourCount}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-gray-600">
                            {rate > 0
                              ? `₹ ${rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : <span className="text-gray-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-emerald-700">
                            {dailyTotal !== null
                              ? `₹ ${dailyTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : <span className="text-gray-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs max-w-[200px] truncate">{entry.notes || '—'}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditing(entry)}
                                title="Edit Entry"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => setDeleting(entry)}
                                title="Delete Entry"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {entries.length > 1 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest" colSpan={2}>Total</td>
                        <td className="px-5 py-3 text-center font-bold text-violet-700 tabular-nums">{totalLabours}</td>
                        <td className="px-5 py-3" />
                        <td className="px-5 py-3 text-right font-bold tabular-nums text-emerald-700">
                          {totalCost > 0 ? `₹ ${totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </>
        )}

        {/* ── OT DATA ─────────────────────────────────────────────────── */}
        {activeTab === 'ot' && (
          <>
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-400 to-orange-400">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Clock size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Overtime Entries</h2>
                  <p className="text-xs text-amber-100 mt-0.5">
                    {isLoading ? 'Loading…' : `${otEntries.length} record${otEntries.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOtModal(true)}
                className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 border border-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                <Plus size={13} /> Add OT
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Loading entries…</span>
              </div>
            ) : otEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <Clock size={36} className="opacity-20" />
                <p className="text-sm font-medium">No overtime entries found</p>
                <p className="text-xs text-gray-300">{fromDate || toDate ? 'Try a different date range' : 'Record OT using the button above'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-white">
                      <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Date</th>
                      <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Contractor</th>
                      <th className="text-center px-5 py-3 text-[11px] font-bold text-amber-600 uppercase tracking-wider">OT Hours</th>
                      <th className="text-center px-5 py-3 text-[11px] font-bold text-amber-600 uppercase tracking-wider">No. of Labours</th>
                      <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">Rate / Hr</th>
                      <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-700 uppercase tracking-wider">OT Cost</th>
                      <th className="px-5 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {otEntries.map((entry, idx) => {
                      const hrs    = parseFloat(entry.overtimeHours) || 0
                      const count  = entry.overtimeLabourCount ?? 0
                      const rateOT = parseFloat(entry.overtimeRatePerHour) || 0
                      const otCost = rateOT > 0 ? hrs * count * rateOT : null
                      return (
                        <tr key={entry.id} className={`border-t border-gray-50 hover:bg-amber-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/10'}`}>
                          <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-500">
                            {fmtDate(entry.date)}
                          </td>
                          <td className="px-5 py-3 text-gray-800">{entry.contractorName}</td>
                          <td className="px-5 py-3 text-center">
                            <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
                              <Clock size={13} className="text-amber-400" />
                              {hrs}h
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center text-amber-700 tabular-nums">
                            {count}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-gray-600">
                            {rateOT > 0
                              ? `₹ ${rateOT.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : <span className="text-gray-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-emerald-700">
                            {otCost !== null
                              ? `₹ ${otCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : <span className="text-gray-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setOtEntry(entry)}
                                title="Edit Overtime"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => setDeleting(entry)}
                                title="Delete Entry"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {otEntries.length > 1 && (
                    <tfoot>
                      <tr className="border-t-2 border-amber-100 bg-amber-50/40">
                        <td className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest" colSpan={2}>Total</td>
                        <td className="px-5 py-3 text-center font-bold text-amber-700 tabular-nums">
                          {totalOTHours > 0 ? `${totalOTHours.toLocaleString('en-IN', { maximumFractionDigits: 1 })}h` : '—'}
                        </td>
                        <td className="px-5 py-3" />
                        <td className="px-5 py-3" />
                        <td className="px-5 py-3 text-right font-bold tabular-nums text-emerald-700">
                          {totalOTCost > 0 ? `₹ ${totalOTCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {editing && (
        <EntryModal
          initial={editing}
          onSave={d => updateMut.mutate({ id: editing.id, d })}
          onClose={() => setEditing(null)}
        />
      )}
      {showAdd && (
        <EntryModal
          onSave={d => createMut.mutate(d)}
          onClose={() => setShowAdd(false)}
        />
      )}
      {/* OT from row button — entry pre-selected */}
      {otEntry && (
        <OvertimeModal
          entry={otEntry}
          onSave={(hrs, cnt, rph) => saveOT(otEntry, hrs, cnt, rph)}
          onClose={() => setOtEntry(null)}
        />
      )}
      {/* OT from header button — standalone: contractor search + date + OT fields */}
      {showOtModal && !otEntry && (
        <AddOTModal
          onSave={handleAddOT}
          onClose={() => setShowOtModal(false)}
        />
      )}
      {deleting && (
        <DeleteModal
          entry={deleting}
          onConfirm={() => deleteMut.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
