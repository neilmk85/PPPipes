import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Truck, Pencil, Save, X, User, Phone, MapPin,
  Building2, IndianRupee, StickyNote, Loader2, Package,
  Calendar, Hash, ChevronDown,
} from 'lucide-react'
import { loadingRecordApi, customerApi, vendorApi } from '@/services/api'
import toast from 'react-hot-toast'

function dmy(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// ── View-mode field tile ──────────────────────────────────────────────────────

function Field({
  label, value, icon, badge, mono, wide, full,
}: {
  label: string
  value?: string | number | null
  icon?: React.ReactNode
  badge?: boolean
  mono?: boolean
  wide?: boolean
  full?: boolean
}) {
  const display = value != null && value !== '' ? String(value) : '—'
  const empty   = display === '—'

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 ${wide ? 'col-span-2' : ''} ${full ? 'col-span-full' : ''}`}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        {icon && <span className="opacity-60">{icon}</span>}
        {label}
      </p>
      {badge ? (
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-base font-extrabold bg-violet-50 text-violet-700 border border-violet-200 tabular-nums">
          {display} pipes
        </span>
      ) : (
        <p className={`text-sm font-semibold leading-relaxed ${empty ? 'text-gray-300 italic' : 'text-gray-800'} ${mono ? 'font-mono tracking-wide' : ''}`}>
          {display}
        </p>
      )}
    </div>
  )
}

// ── Edit-mode field ───────────────────────────────────────────────────────────

const inputCls = 'w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white text-gray-800 placeholder-gray-300 transition-all'
const labelCls = 'text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5'

// ── Generic autocomplete combobox ────────────────────────────────────────────

function Autocomplete({ value, onChange, options, placeholder, textarea }: {
  value:       string
  onChange:    (v: string) => void
  options:     string[]
  placeholder?: string
  textarea?:   boolean
}) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState(value)
  const [cursor, setCursor] = useState(-1)
  const ref                 = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  function select(v: string) {
    setQuery(v); onChange(v); setOpen(false); setCursor(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true) } return }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
    else if (e.key === 'Enter' && !textarea) {
      e.preventDefault()
      if (cursor >= 0 && filtered[cursor]) select(filtered[cursor])
      else { onChange(query); setOpen(false) }
    }
    else if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  const sharedProps = {
    ref: inputRef as any,
    value: query,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setQuery(e.target.value); onChange(e.target.value); setOpen(true); setCursor(-1)
    },
    onFocus: () => setOpen(true),
    onKeyDown: handleKeyDown,
    placeholder,
    autoComplete: 'off' as const,
    className: inputCls + ' pr-9',
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        {textarea
          ? <textarea {...sharedProps} rows={3} className={inputCls + ' resize-none pr-9'} />
          : <input {...sharedProps} />
        }
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setOpen(o => !o); inputRef.current?.focus() }}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
          {filtered.map((opt, i) => (
            <li
              key={opt}
              onMouseDown={e => { e.preventDefault(); select(opt) }}
              onMouseEnter={() => setCursor(i)}
              className={`px-4 py-2.5 text-sm cursor-pointer leading-snug transition-colors ${
                i === cursor ? 'bg-violet-50 text-violet-800 font-semibold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Party name options ────────────────────────────────────────────────────────

function isPartyName(s: string | null | undefined): boolean {
  if (!s || s.trim().length < 2) return false
  const t = s.trim()
  if (/^\d+$/.test(t)) return false
  if (/^\+?\d[\d\s\-()]{6,}$/.test(t)) return false
  if (['walk in customer', 'empty name'].includes(t.toLowerCase())) return false
  return true
}

function usePartyOptions(): string[] {
  const { data: custData } = useQuery({
    queryKey: ['customers-all'],
    queryFn:  () => customerApi.getAll({ size: 500 }).then(r => r.data.data?.content ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const { data: vendData } = useQuery({
    queryKey: ['vendors-all'],
    queryFn:  () => vendorApi.getAll().then(r => r.data.data?.content ?? r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const names: string[] = []
  for (const c of custData ?? []) {
    if (isPartyName(c.name))  names.push(c.name.trim())
    if (isPartyName(c.phone)) names.push(c.phone.trim())
  }
  for (const v of vendData ?? []) {
    if (isPartyName(v.name)) names.push(v.name.trim())
  }
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
}

// ── Site address options ──────────────────────────────────────────────────────

function useSiteAddressOptions(): string[] {
  const { data: custData } = useQuery({
    queryKey: ['customers-all'],
    queryFn:  () => customerApi.getAll({ size: 500 }).then(r => r.data.data?.content ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const { data: recordsData } = useQuery({
    queryKey: ['loading-records-all'],
    queryFn:  () => loadingRecordApi.getAll().then(r => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })

  const addrs: string[] = []

  // From customers: siteAddresses array (delivery sites only, not office address)
  for (const c of custData ?? []) {
    for (const sa of c.siteAddresses ?? []) {
      const parts = [sa.address, sa.city, sa.state, sa.pincode ? sa.pincode : ''].filter(Boolean)
      if (parts.length) addrs.push(parts.join(', '))
    }
  }

  // From past loading records
  for (const r of recordsData ?? []) {
    if (r.siteAddress?.trim()) addrs.push(r.siteAddress.trim())
  }

  return Array.from(new Set(addrs)).sort((a, b) => a.localeCompare(b))
}

// ── Main page ─────────────────────────────────────────────────────────────────
// (PartyAutocomplete and SiteAddressAutocomplete are inlined via Autocomplete + hooks above)

export default function LoadingRecordDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState<any | null>(null)

  // Autocomplete option lists — fetched once, shared by both fields
  const partyOptions       = usePartyOptions()
  const siteAddressOptions = useSiteAddressOptions()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['loading-record', id],
    queryFn:  () => loadingRecordApi.getById(Number(id)).then(r => r.data.data),
    enabled:  !!id,
  })

  const record: any = data

  function startEdit() {
    setForm({
      date:          record.date          ?? '',
      pipeName:      record.pipeName      ?? '',
      quantity:      String(record.quantity ?? ''),
      vehicleNo:     record.vehicleNo     ?? '',
      driverName:    record.driverName    ?? '',
      driverContact: record.driverContact ?? '',
      vendor:        record.vendor        ?? '',
      siteAddress:   record.siteAddress   ?? '',
      transportRate: record.transportRate ?? '',
      rateType:      record.rateType      ?? 'per_pipe',
      notes:         record.notes         ?? '',
    })
    setEditing(true)
  }

  function cancelEdit() { setEditing(false); setForm(null) }

  function set(field: string, value: string) {
    setForm((f: any) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { ...record, ...form, quantity: parseInt(form.quantity) || 0 }
      const res = await loadingRecordApi.update(Number(id), payload)
      // Invalidate the detail query so it refetches fresh data
      qc.invalidateQueries({ queryKey: ['loading-record', id] })
      // Also patch the list cache if it exists
      qc.setQueriesData({ queryKey: ['loading-records'] }, (old: any) =>
        Array.isArray(old) ? old.map((r: any) => r.id === res.data.data.id ? { ...r, ...res.data.data } : r) : old
      )
      toast.success('Record updated')
      setEditing(false)
      setForm(null)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading / error states ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/60 p-6 flex items-center justify-center">
        <Loader2 size={32} className="text-violet-400 animate-spin" />
      </div>
    )
  }

  if (isError || !record) {
    return (
      <div className="min-h-screen bg-gray-50/60 p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-sm">Record not found.</p>
        <button onClick={() => navigate('/business/loading')}
          className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold">
          Back to list
        </button>
      </div>
    )
  }

  const challanNo = `DC-${String(record.id).padStart(4, '0')}`

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(124,58,237,0.25)]">
        {/* Background */}
        <div className={`absolute inset-0 overflow-hidden rounded-2xl pointer-events-none transition-all duration-500 ${
          editing
            ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-orange-400'
            : 'bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-500'
        }`}>
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative px-8 py-6 flex items-center justify-between">
          {/* Left — back + title */}
          <div className="flex items-center gap-5">
            <button
              onClick={() => navigate('/business/loading')}
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              {editing ? <Pencil size={24} className="text-white/80" /> : <Truck size={26} className="text-violet-200" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-0.5">
                {editing ? 'Editing' : 'Loaded Pipes'} · {challanNo}
              </p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
                {record.pipeName}
              </h1>
              <p className="text-sm text-white/70 mt-0.5">
                {record.quantity} pipes · {dmy(record.date)} · {record.vendor || 'No party'}
              </p>
            </div>
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-3">
            {!editing ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold rounded-xl transition-all active:scale-95"
              >
                <Pencil size={15} /> Edit
              </button>
            ) : (
              <>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold rounded-xl transition-all active:scale-95"
                >
                  <X size={15} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-orange-600 hover:bg-orange-50 text-sm font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save changes
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stat strip */}
        {!editing && (
          <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
            {[
              { label: 'Challan No.',    value: challanNo },
              { label: 'Date',           value: dmy(record.date) },
              { label: 'Quantity',       value: `${record.quantity} pipes` },
              { label: 'Vehicle',        value: record.vehicleNo || '—' },
            ].map(s => (
              <div key={s.label} className="px-6 py-3.5">
                <p className="text-xs text-white/50 mb-0.5">{s.label}</p>
                <p className="text-base font-bold text-white tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      {!editing ? (

        /* ── VIEW ── */
        <div className="grid grid-cols-3 gap-4">

          {/* Section: Pipe details */}
          <div className="col-span-full">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Pipe Details</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Date"      icon={<Calendar size={12} />} value={dmy(record.date)} />
              <Field label="Pipe Name" icon={<Package size={12} />}  value={record.pipeName} />
              <Field label="Quantity"  badge value={record.quantity} />
            </div>
          </div>

          {/* Section: Vehicle & Driver */}
          <div className="col-span-full">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Vehicle &amp; Driver</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Vehicle No."  icon={<Truck size={12} />}  value={record.vehicleNo}     mono />
              <Field label="Driver Name"  icon={<User size={12} />}   value={record.driverName} />
              <Field label="Contact No."  icon={<Phone size={12} />}  value={record.driverContact} />
            </div>
          </div>

          {/* Section: Party & Transport */}
          <div className="col-span-full">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Party &amp; Transport</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Vendor / Party"   icon={<Building2 size={12} />}    value={record.vendor} />
              <Field label="Transport Rate"   icon={<IndianRupee size={12} />}
                value={record.transportRate
                  ? `₹${record.transportRate} / ${record.rateType === 'per_trip' ? 'trip' : 'pipe'}`
                  : null} />
              <Field label="Challan No. (CH.NO)" icon={<Hash size={12} />} value={record.customerPoNo} mono />
            </div>
          </div>

          {/* Site Address + Notes */}
          <div className="col-span-full">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Site Address" icon={<MapPin size={12} />}     value={record.siteAddress} wide />
              <Field label="Notes"        icon={<StickyNote size={12} />} value={record.notes} wide />
            </div>
          </div>

        </div>

      ) : (

        /* ── EDIT ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

          {/* Pipe details */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Pipe Details</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pipe Name</label>
                <input value={form.pipeName} onChange={e => set('pipeName', e.target.value)} className={inputCls} placeholder="PCCP 900mm 4kg" />
              </div>
              <div>
                <label className={labelCls}>Quantity (pipes)</label>
                <input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Vehicle & Driver */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Vehicle &amp; Driver</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Vehicle No.</label>
                <input value={form.vehicleNo} onChange={e => set('vehicleNo', e.target.value)} className={inputCls} placeholder="MH14KQ7556" />
              </div>
              <div>
                <label className={labelCls}>Driver Name</label>
                <input value={form.driverName} onChange={e => set('driverName', e.target.value)} className={inputCls} placeholder="Name" />
              </div>
              <div>
                <label className={labelCls}>Contact No.</label>
                <input value={form.driverContact} onChange={e => set('driverContact', e.target.value)} className={inputCls} placeholder="Phone" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Party & Transport */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Party &amp; Transport</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Vendor / Party Name</label>
                <Autocomplete
                  value={form.vendor}
                  onChange={v => set('vendor', v)}
                  options={partyOptions}
                  placeholder="Type to search party name…"
                />
              </div>
              <div>
                <label className={labelCls}>Transport Rate (₹)</label>
                <input type="number" value={form.transportRate} onChange={e => set('transportRate', e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Rate Type</label>
                <select value={form.rateType} onChange={e => set('rateType', e.target.value)} className={inputCls + ' cursor-pointer'}>
                  <option value="per_pipe">Per Pipe</option>
                  <option value="per_trip">Per Trip</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Address & Notes */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Address &amp; Notes</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Site Address</label>
                <Autocomplete
                  value={form.siteAddress}
                  onChange={v => set('siteAddress', v)}
                  options={siteAddressOptions}
                  placeholder="Type to search or enter address…"
                  textarea
                />
              </div>
              <div>
                <label className={labelCls}>Notes / Instructions</label>
                <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
                  className={inputCls + ' resize-none'} placeholder="Any notes or instructions" />
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={cancelEdit}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
