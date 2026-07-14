import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'

const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Truck, Calendar, ChevronDown, X, Search,
  PackageCheck, Plus, Minus, MapPin,
  ClipboardList, Layers, Gauge,
  Printer, Camera, Upload, Trash2, ZoomIn, Loader2, ImageOff, Check, FileText, Eye,
  Receipt, Building2, Send,
} from 'lucide-react'
import { productionEntryApi, vendorApi, salesOrderApi, customerApi, loadingRecordApi, invoiceApi, pipeConfigApi, inventoryApi, taxGroupApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { format, subDays, addDays } from 'date-fns'
import toast from 'react-hot-toast'

// ── Date helpers ──────────────────────────────────────────────────────────────

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }

/** Convert ISO yyyy-MM-dd to dd/MM/yyyy for display */
function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function startOf(unit: 'week' | 'month' | 'quarter' | 'year', d = new Date()) {
  const r = new Date(d)
  if (unit === 'week')    { const day = r.getDay() || 7; r.setDate(r.getDate() - day + 1) }
  else if (unit === 'month')   r.setDate(1)
  else if (unit === 'quarter') r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1)
  else                         r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfWeekSun() {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay()) // Sunday
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfLastMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfLastMonth() {
  const d = new Date()
  d.setDate(0) // last day of previous month
  d.setHours(0, 0, 0, 0)
  return d
}

const PRESETS = [
  { label: 'Today',        from: () => fmtDate(new Date()),                    to: () => fmtDate(new Date()) },
  { label: 'Yesterday',    from: () => fmtDate(subDays(new Date(), 1)),        to: () => fmtDate(subDays(new Date(), 1)) },
  { label: 'Last 7 Days',  from: () => fmtDate(subDays(new Date(), 6)),        to: () => fmtDate(new Date()) },
  { label: 'Last 15 Days', from: () => fmtDate(subDays(new Date(), 14)),       to: () => fmtDate(new Date()) },
  { label: 'Last 30 Days', from: () => fmtDate(subDays(new Date(), 29)),       to: () => fmtDate(new Date()) },
  { label: 'This Week',    from: () => fmtDate(startOfWeekSun()),              to: () => fmtDate(new Date()) },
  { label: 'This Month',   from: () => fmtDate(startOf('month')),              to: () => fmtDate(new Date()) },
  { label: 'Last Month',   from: () => fmtDate(startOfLastMonth()),            to: () => fmtDate(endOfLastMonth()) },
  { label: 'This Year',    from: () => fmtDate(startOf('year')),               to: () => fmtDate(new Date()) },
]

function CustomRangePicker({ fromDate, toDate, onChange }: {
  fromDate: string; toDate: string; onChange: (f: string, t: string) => void
}) {
  const [open, setOpen]       = useState(false)
  const [tmpFrom, setTmpFrom] = useState(fromDate)
  const [tmpTo,   setTmpTo]   = useState(toDate)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const presetActive = PRESETS.some(p => fromDate === p.from() && toDate === p.to())
  const customActive = !presetActive && !!(fromDate || toDate)

  function openPicker() { setTmpFrom(fromDate); setTmpTo(toDate); setOpen(true) }
  function apply()      { onChange(tmpFrom, tmpTo); setOpen(false) }
  function clear()      { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPicker}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
          customActive
            ? 'bg-white text-violet-700 border-white shadow-sm'
            : 'border-white/30 text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        <Calendar size={11} />
        {customActive ? `${dmy(fromDate)} – ${dmy(toDate)}` : 'Custom'}
        {customActive
          ? <X size={10} className="ml-0.5 opacity-70 hover:opacity-100" onClick={e => { e.stopPropagation(); clear() }} />
          : <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-64">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Custom Range</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From</label>
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To</label>
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={clear}
              className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Clear
            </button>
            <button onClick={apply} disabled={!tmpFrom && !tmpTo}
              className="flex-1 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

function Autocomplete({
  value, onChange, options, placeholder, renderOption, displayValue,
}: {
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder?: string
  renderOption?: (opt: string) => React.ReactNode
  displayValue?: (opt: string) => string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState(value)
  const [pos, setPos]     = useState<{ top: number; left: number; width: number } | null>(null)
  const ref               = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function updatePos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos) }
  }, [open])

  const filtered = options.filter(o =>
    o.toLowerCase().includes(query.toLowerCase())
  )

  const dropdown = open && filtered.length > 0 && pos ? createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      <div className="bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
        {filtered.map(opt => (
          <button
            key={opt}
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 hover:text-violet-700 transition-colors"
            onMouseDown={e => { e.preventDefault(); onChange(opt); setQuery(displayValue ? displayValue(opt) : opt); setOpen(false) }}
          >
            {renderOption ? renderOption(opt) : opt}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="relative" ref={ref}>
      <div className={`flex items-center border rounded-xl px-3 py-2.5 gap-2 bg-white transition-all ${
        open ? 'border-violet-400 ring-2 ring-violet-200' : 'border-gray-200 hover:border-gray-300'
      }`}>
        <input
          ref={inputRef}
          className="flex-1 text-sm text-gray-800 focus:outline-none bg-transparent"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange('') }}
          onBlur={() => {
            // If the typed text doesn't exactly match a committed selection, reset to the committed value
            const committed = displayValue ? options.find(o => displayValue(o) === value || o === value) : value
            const display = committed ? (displayValue ? displayValue(committed) : committed) : value
            if (query !== display) setQuery(display ?? '')
          }}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); onChange(''); setOpen(false) }}>
            <X size={13} className="text-gray-300 hover:text-gray-500" />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  )
}


// ── Challan document body ─────────────────────────────────────────────────────

function ChallanBody({ record }: { record: any }) {
  const qty = record.quantity ?? 0
  const s: React.CSSProperties = { fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '13px', lineHeight: '1.5' }
  return (
    <div style={{ ...s, border: '1.5px solid #000', padding: '0' }}>
      <div style={{ textAlign: 'center', borderBottom: '1.5px solid #000', padding: '8px 16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '3px' }}>DELIVERY CHALLAN</div>
      </div>
      <div style={{ textAlign: 'center', borderBottom: '1px solid #aaa', padding: '10px 16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 900 }}>P &amp; P PIPE PRODUCTS PRIVATE LIMITED</div>
        <div style={{ fontSize: '11px', marginTop: '3px' }}>GAT NO.156, AT POST HOTGI, TAL-SOUTH SOLAPUR. DIST-SOLAPUR-413215.</div>
        <div style={{ fontSize: '11px' }}>GSTIN : 27AALCP2256P1ZR , MO-8380055005</div>
      </div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div><span style={{ fontWeight: 700 }}>CH. NO - </span><span>{record.customerPoNo || ''}</span></div>
          <div><span style={{ fontWeight: 700 }}>DATE - </span><span>{dmy(record.date)}</span></div>
        </div>
        <div style={{ marginBottom: '4px' }}><span style={{ fontWeight: 700 }}>NAME - </span><span>{record.vendor || ''}</span></div>
        <div style={{ marginBottom: '14px' }}><span style={{ fontWeight: 700 }}>ADDRESS - </span><span>{record.siteAddress || ''}</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div style={{ border: '1.5px solid #000', padding: '3px 14px', fontSize: '15px', fontWeight: 700, minWidth: '36px', textAlign: 'center' }}>{qty}</div>
          <div style={{ fontSize: '13px' }}>{record.pipeName || ''}</div>
        </div>
        <div style={{ textAlign: 'right', marginBottom: '22px' }}>
          <div style={{ marginBottom: '4px' }}><span style={{ fontWeight: 700 }}>VEHICLE NO - </span><span>{record.vehicleNo || ''}</span></div>
          <div style={{ marginBottom: '4px' }}><span style={{ fontWeight: 700 }}>DRIVER NAME - </span><span>{record.driverName || ''}</span></div>
          <div style={{ fontWeight: 700, textDecoration: 'underline' }}><span>CONTACT NO. - </span><span>{record.driverContact || ''}</span></div>
        </div>
        <div style={{ marginBottom: '40px' }}><span style={{ fontWeight: 700 }}>PIPE NO. - </span><span>{record.pipeNo || ''}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
          <span style={{ fontWeight: 700 }}>SENDER SIGNATURE</span>
          <span style={{ fontWeight: 700 }}>RECEIVER SIGNATURE</span>
        </div>
      </div>
    </div>
  )
}

// ── Delivery Challan Modal ─────────────────────────────────────────────────────

function DeliveryChallanModal({ record, onClose, autoPrint, onSaved }: {
  record: any; onClose: () => void; autoPrint?: boolean; onSaved: (updated: any) => void
}) {
  const [chNo,   setChNo]   = useState<string>(record.customerPoNo ?? '')
  const [pipeNo, setPipeNo] = useState<string>(record.pipeNo ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const liveRecord = { ...record, customerPoNo: chNo, pipeNo }

  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'challan-print-style'
    style.textContent = `
      @media print {
        @page { size: A4 portrait; margin: 8mm 10mm; }
        body > * { display: none !important; }
        #challan-print-portal { display: block !important; position: fixed; inset: 0; background: white; padding: 0; }
        .challan-copy { height: calc(50% - 6px); overflow: hidden; padding: 4mm 6mm; box-sizing: border-box; }
        .challan-sep  { height: 12px; border-top: 1px dashed #999; margin: 0 6mm; }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById('challan-print-style')?.remove() }
  }, [])

  useEffect(() => { if (autoPrint) saveAndPrint() }, [autoPrint]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveFields() {
    const changed = chNo.trim() !== (record.customerPoNo ?? '') || pipeNo.trim() !== (record.pipeNo ?? '')
    if (!changed) return
    setSaving(true)
    try {
      const res = await loadingRecordApi.update(record.id, { ...record, customerPoNo: chNo.trim(), pipeNo: pipeNo.trim() })
      onSaved(res.data.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function saveAndPrint() { await saveFields(); setTimeout(() => window.print(), 300) }

  return (
    <>
      {createPortal(
        <div id="challan-print-portal" style={{ display: 'none' }}>
          <div className="challan-copy"><ChallanBody record={liveRecord} /></div>
          <div className="challan-sep" />
          <div className="challan-copy"><ChallanBody record={liveRecord} /></div>
        </div>,
        document.body
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between px-6 py-3.5 bg-gradient-to-r from-violet-700 to-indigo-500 rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <ClipboardList size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Delivery Challan</h2>
                <p className="text-xs text-violet-100">{record.pipeName} · {record.quantity} pipes · {dmy(record.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveFields} disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Save
              </button>
              <button onClick={saveAndPrint} disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50">
                <Printer size={13} />Save &amp; Print
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                <X size={14} className="text-white" />
              </button>
            </div>
          </div>
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Challan details — edits auto-update preview &amp; save on print</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">CH. NO (Customer PO No.)</label>
                <div className="relative flex items-center">
                  <input value={chNo} onChange={e => { setChNo(e.target.value); setSaved(false) }}
                    onBlur={saveFields} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    placeholder="e.g. LOA/0615"
                    className={`w-full px-3 py-2 pr-8 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all font-mono ${saved ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-800 placeholder-gray-300'}`} />
                  <span className="absolute right-2.5 pointer-events-none">
                    {saving && <Loader2 size={12} className="text-gray-400 animate-spin" />}
                    {saved   && <Check   size={12} className="text-emerald-500" />}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">Pipe No.</label>
                <div className="relative flex items-center">
                  <input value={pipeNo} onChange={e => { setPipeNo(e.target.value); setSaved(false) }}
                    onBlur={saveFields} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    placeholder="e.g. 1"
                    className={`w-full px-3 py-2 pr-8 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all ${saved ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-800 placeholder-gray-300'}`} />
                  <span className="absolute right-2.5 pointer-events-none">
                    {saving && <Loader2 size={12} className="text-gray-400 animate-spin" />}
                    {saved   && <Check   size={12} className="text-emerald-500" />}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-8 flex-1 bg-white">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Preview (printed twice per page)</p>
            <ChallanBody record={liveRecord} />
            <div className="my-4 border-t border-dashed border-gray-300" />
            <ChallanBody record={liveRecord} />
          </div>
        </div>
      </div>
    </>
  )
}

// ── Challan Photo Modal ───────────────────────────────────────────────────────

function ChallanPhotoModal({ record, onClose, onUpdated }: {
  record: any; onClose: () => void; onUpdated: (updated: any) => void
}) {
  const fileRef                   = useRef<HTMLInputElement>(null)
  const cameraRef                 = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [lightbox,  setLightbox]  = useState(false)
  const existing   = record.challanPhotoUrl ?? null
  const displaySrc = preview ?? existing

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024)   { toast.error('File too large (max 10 MB)');  return }
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const res = await loadingRecordApi.uploadChallanPhoto(record.id, file)
      onUpdated(res.data.data)
      toast.success('Photo uploaded')
    } catch { toast.error('Upload failed'); setPreview(null) }
    finally { setUploading(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await loadingRecordApi.deleteChallanPhoto(record.id)
      onUpdated(res.data.data)
      setPreview(null)
      toast.success('Photo removed')
    } catch { toast.error('Failed to remove photo') }
    finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Camera size={15} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Received Challan Photo</h2>
              <p className="text-xs text-gray-400 mt-0.5">{record.deliveryChallanNo || `DC-${String(record.id).padStart(4, '0')}`} · {record.pipeName} · {record.vehicleNo || 'No vehicle'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {displaySrc ? (
            <>
              <div onClick={() => setLightbox(true)}
                className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-zoom-in"
                style={{ aspectRatio: '4/3' }} title="Click to view full size">
                <img src={displaySrc} alt="Challan" className="w-full h-full object-contain" />
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1 bg-black/60 rounded-lg text-white text-xs font-medium pointer-events-none">
                  <ZoomIn size={11} /> Click to view
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 size={28} className="text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => cameraRef.current?.click()} disabled={uploading}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors disabled:opacity-50">
                  <Camera size={14} /> Camera
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl border border-violet-200 transition-colors disabled:opacity-50">
                  <Upload size={14} /> Upload
                </button>
                <button onClick={handleDelete} disabled={deleting || uploading}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors disabled:opacity-50">
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <div onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-8">
                {uploading ? (
                  <><Loader2 size={28} className="text-violet-400 animate-spin" /><p className="text-sm text-gray-500">Uploading…</p></>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                      <ImageOff size={22} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">No photo attached yet</p>
                    <p className="text-xs text-gray-400">Drag &amp; drop an image here, or use the buttons below</p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => cameraRef.current?.click()} disabled={uploading}
                  className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors disabled:opacity-50">
                  <Camera size={15} /> Take Photo
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl border border-violet-200 transition-colors disabled:opacity-50">
                  <Upload size={15} /> Upload File
                </button>
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        </div>
      </div>
      {lightbox && displaySrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"><X size={18} /></button>
          <img src={displaySrc} alt="Challan full" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

// ── Date Filter Dropdown ──────────────────────────────────────────────────────

function DateFilterDropdown({ from, to, onChange }: {
  from: string; to: string; onChange: (f: string, t: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo,   setTmpTo]   = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const activePreset = PRESETS.find(p => from === p.from() && to === p.to())
  const isCustom     = !activePreset && !!(from || to)

  function applyPreset(p: typeof PRESETS[number]) {
    onChange(p.from(), p.to())
    setOpen(false)
  }

  function applyCustom() {
    if (tmpFrom && tmpTo) { onChange(tmpFrom, tmpTo); setOpen(false) }
  }

  function clearCustom() {
    setTmpFrom(''); setTmpTo('')
    onChange('', '')
    setOpen(false)
  }

  const label = activePreset
    ? activePreset.label
    : isCustom
      ? `${dmy(from)} – ${dmy(to)}`
      : 'All dates'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setTmpFrom(from); setTmpTo(to); setOpen(v => !v) }}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/40"
      >
        <Calendar size={15} />
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-60">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Quick Range</p>
          <div className="space-y-0.5 mb-3">
            {PRESETS.map(p => {
              const active = from === p.from() && to === p.to()
              return (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors font-medium ${
                    active ? 'bg-violet-50 text-violet-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  {p.label}
                </button>
              )
            })}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Custom Range</p>
            <div className="space-y-2">
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700" />
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700" />
              <div className="flex gap-2">
                <button onClick={clearCustom}
                  className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Clear
                </button>
                <button onClick={applyCustom} disabled={!tmpFrom || !tmpTo}
                  className="flex-1 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Convert to Invoice Modal ──────────────────────────────────────────────────

const METERS_PER_PIPE = 5.25

function GstPicker({ value, onChange, taxGroups }: {
  value: number; onChange: (rate: number) => void; taxGroups: any[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 130) })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const options = [{ label: 'No Tax / 0%', rate: 0 }, ...taxGroups.map((g: any) => { const r = Number(g.totalRate ?? g.rate ?? 0); return { label: `${g.name} / ${r}%`, rate: r } })]

  return (
    <>
      <button ref={ref} type="button" onClick={toggle}
        className={`w-full flex items-center justify-between px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white tabular-nums`}>
        <span className="text-gray-800">{value}%</span>
        <ChevronDown size={12} className="text-gray-400 shrink-0" />
      </button>
      {open && createPortal(
        <div className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: pos.width }}>
          {options.map(o => (
            <button key={o.rate} type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 hover:text-violet-700 transition-colors ${o.rate === value ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-gray-700'}`}
              onClick={() => { onChange(o.rate); setOpen(false) }}>
              {o.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

interface InvLineItem {
  id: string
  productName: string
  lengthM: number        // meters per pipe for this config
  meters: number
  quantity: number       // auto-derived: Math.ceil(meters / lengthM)
  unitPrice: number      // price per meter
  discountPercent: number
  taxRate: number
}

function calcLine(item: InvLineItem) {
  const qty       = item.meters
  const base      = qty * item.unitPrice
  const disc      = base * (item.discountPercent / 100)
  const afterDisc = base - disc
  const tax       = afterDisc * (item.taxRate / 100)
  return { base, disc, tax, total: afterDisc + tax }
}

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const INV_PAYMENT_TERMS = [
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt', days: 0 },
  { value: 'NET_7',          label: 'Net 7',           days: 7 },
  { value: 'NET_15',         label: 'Net 15',          days: 15 },
  { value: 'NET_30',         label: 'Net 30',          days: 30 },
  { value: 'NET_45',         label: 'Net 45',          days: 45 },
  { value: 'NET_60',         label: 'Net 60',          days: 60 },
  { value: 'CUSTOM',         label: 'Custom Date',     days: null },
]

function ConvertToInvoiceModal({ record, outletId, onClose, onConverted }: {
  record: any; outletId: number; onClose: () => void; onConverted: (updated: any) => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])
  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  const [customer,       setCustomer]       = useState<{ id: number; name: string; phone?: string } | null>(null)
  const [customerSearch, setCustomerSearch] = useState(record.customerName ?? '')
  const [custResults,    setCustResults]    = useState<any[]>([])
  const [custOpen,       setCustOpen]       = useState(false)
  const custRef = useRef<HTMLDivElement>(null)

  const today = fmtDate(new Date())
  const [invoiceDate,       setInvoiceDate]       = useState(typeof record.date === 'string' ? record.date.split('T')[0] : today)
  const [dueDate,           setDueDate]           = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [paymentTerms,      setPaymentTerms]      = useState('NET_30')
  const [poNumber,          setPoNumber]          = useState(record.customerPoNo ?? '')
  const [notes,             setNotes]             = useState('')
  const [termsConditions,   setTermsConditions]   = useState('')
  const [shippingAmount,    setShippingAmount]     = useState(0)
  const [billDiscountPct,   setBillDiscountPct]   = useState(0)
  const [deliveryChallanNo, setDeliveryChallanNo] = useState(record.deliveryChallanNo || `DC-${String(record.id).padStart(4, '0')}`)
  const [eWayBillNo,        setEWayBillNo]        = useState('')
  const [eInvoiceNo,        setEInvoiceNo]        = useState('')
  const [submitting,        setSubmitting]        = useState(false)
  const [sendOnSave,        setSendOnSave]        = useState(false)

  const { data: nextNumberData } = useQuery({
    queryKey: ['invoice-next-number'],
    queryFn: () => invoiceApi.nextNumber().then((r: any) => r.data.data?.nextNumber ?? ''),
    staleTime: 0,
  })
  const nextInvoiceNumber: string = nextNumberData ?? ''

  const { data: taxGroupsData } = useQuery({
    queryKey: ['taxGroups'],
    queryFn: () => taxGroupApi.getAll(true).then((r: any) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const taxGroups: any[] = taxGroupsData ?? []

  const recordLengthM = (record as any).pipeConfig?.lengthM ?? (record as any).lengthM ?? 5.25
  const [items, setItems] = useState<InvLineItem[]>([
    { id: '1', productName: record.pipeName ?? '',
      lengthM: recordLengthM,
      meters: (record.quantity ?? 1) * recordLengthM,
      quantity: record.quantity ?? 1,
      unitPrice: 0, discountPercent: 0, taxRate: 18 },
  ])

  // Auto-update due date when terms or issue date changes
  useEffect(() => {
    const term = INV_PAYMENT_TERMS.find(t => t.value === paymentTerms)
    if (term && term.days !== null) {
      setDueDate(format(addDays(new Date(invoiceDate), term.days), 'yyyy-MM-dd'))
    }
  }, [paymentTerms, invoiceDate])

  // Customer search debounce
  useEffect(() => {
    if (customerSearch.trim().length < 2) { setCustResults([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await customerApi.search(customerSearch)
        setCustResults(res.data.data ?? [])
        setCustOpen(true)
      } catch { setCustResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (custRef.current && !custRef.current.contains(e.target as Node)) setCustOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function addItem() {
    setItems(prev => [...prev, { id: Date.now().toString(), productName: '', lengthM: 5.25, meters: 5.25, quantity: 1, unitPrice: 0, discountPercent: 0, taxRate: 18 }])
  }
  function removeItem(id: string) { setItems(prev => prev.filter(i => i.id !== id)) }
  function updateItem(id: string, patch: Partial<InvLineItem>) {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      const merged = { ...i, ...patch }
      const lengthM = merged.lengthM ?? 5.25
      if ('meters' in patch)   merged.quantity = Math.ceil((patch.meters ?? 0) / lengthM)
      if ('quantity' in patch) merged.meters   = (patch.quantity ?? 0) * lengthM
      return merged
    }))
  }

  // Totals
  const lineTotals = items.reduce((acc, it) => {
    const c = calcLine(it)
    return { subtotal: acc.subtotal + c.base, lineDisc: acc.lineDisc + c.disc, tax: acc.tax + c.tax }
  }, { subtotal: 0, lineDisc: 0, tax: 0 })
  const afterLineDisc = lineTotals.subtotal - lineTotals.lineDisc
  const billDiscAmt   = afterLineDisc * (billDiscountPct / 100)
  const grandTotal    = afterLineDisc - billDiscAmt + lineTotals.tax + shippingAmount
  const roundedTotal  = Math.round(grandTotal)

  async function handleSubmit(send: boolean) {
    if (items.some(i => !i.productName.trim())) { toast.error('All items need a product name'); return }
    if (items.some(i => i.unitPrice <= 0))      { toast.error('All items need a unit price'); return }
    setSendOnSave(send)
    setSubmitting(true)
    try {
      const payload: any = {
        outletId,
        customerId:        customer?.id ?? null,
        issueDate:         invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        dueDate:           paymentTerms !== 'DUE_ON_RECEIPT' && dueDate ? new Date(dueDate).toISOString() : null,
        paymentTerms:      paymentTerms || null,
        poNumber:          poNumber   || null,
        deliveryChallanNo: deliveryChallanNo || null,
        eWayBillNo:        eWayBillNo || null,
        eInvoiceNo:        eInvoiceNo || null,
        notes:             notes || null,
        termsConditions:   termsConditions || null,
        shippingAmount:    shippingAmount || null,
        billDiscountPct:   billDiscountPct || null,
        items: items.map(i => ({
          productName:     i.productName,
          quantity:        i.meters,
          unitPrice:       i.unitPrice,
          discountPercent: i.discountPercent || null,
          taxRate:         i.taxRate || null,
        })),
      }
      const invRes = await invoiceApi.create(payload)
      const invoice = invRes.data.data
      if (send) await invoiceApi.updateStatus(invoice.id, 'SENT')
      const linkRes = await loadingRecordApi.linkInvoice(record.id, {
        invoiceId:     invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      })
      onConverted(linkRes.data.data)
      toast.success(`Invoice ${invoice.invoiceNumber} ${send ? 'created & sent' : 'saved as draft'}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  const fieldCls = 'w-full text-sm text-gray-800 placeholder-gray-300 border-0 bg-transparent p-0 focus:outline-none'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sliding panel */}
      <div className={`fixed inset-y-0 right-0 left-[220px] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* ── Header ── */}
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <Receipt size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">Convert to Invoice</h2>
                <p className="text-xs text-gray-400 mt-0.5">{record.deliveryChallanNo || `DC-${String(record.id).padStart(4, '0')}`} · {record.pipeName} · {record.quantity} pipes · Invoice number assigned on save</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClose} className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleSubmit(false)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-violet-400 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors font-medium">
                {submitting && !sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Save Draft
              </button>
              <button onClick={() => handleSubmit(true)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm">
                {submitting && sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Save &amp; Send
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">

              {/* ── From / Bill To ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">From</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                      <Building2 size={17} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">PP Pipes Products</p>
                      <p className="text-xs text-gray-400 mt-0.5">Outlet #{outletId}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bill To</p>
                  {customer ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 font-bold text-sm">
                        {customer.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{customer.name}</p>
                        {customer.phone && <p className="text-xs text-gray-400 mt-0.5">{customer.phone}</p>}
                      </div>
                      <button onClick={() => { setCustomer(null); setCustomerSearch('') }}
                        className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative" ref={custRef}>
                      <input
                        value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setCustomer(null) }}
                        onFocus={() => custResults.length > 0 && setCustOpen(true)}
                        placeholder="Search customer by name or phone…"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-gray-800 placeholder-gray-300"
                      />
                      {custOpen && custResults.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {custResults.map((c: any) => (
                            <button key={c.id} type="button"
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-violet-50 hover:text-violet-700 transition-colors border-b border-gray-50 last:border-0"
                              onClick={() => { setCustomer({ id: c.id, name: c.name, phone: c.phone }); setCustomerSearch(c.name); setCustOpen(false) }}>
                              <span className="font-medium">{c.name}</span>
                              {c.phone && <span className="ml-2 text-xs text-gray-400">{c.phone}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Invoice metadata bar ── */}
              <div className="bg-white rounded-xl shadow-md">
                <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: '1fr 1fr 1fr 1.4fr 1fr' }}>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Invoice No.</p>
                    {nextInvoiceNumber
                      ? <p className="text-[13px] font-semibold tracking-wide text-blue-600">{nextInvoiceNumber}</p>
                      : <p className="text-sm text-gray-400 italic">Auto-assigned</p>}
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Issue Date</p>
                    <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={fieldCls} />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Due Date</p>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={fieldCls} />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Payment Terms</p>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                      className={fieldCls + ' appearance-none cursor-pointer'}>
                      {INV_PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">PO Number</p>
                    <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-001" className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* ── Compliance docs ── */}
              <div className="bg-blue-50 rounded-xl shadow-md px-5 py-4">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3">Compliance Documents</p>
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">Delivery Challan No.</p>
                    <input type="text" value={deliveryChallanNo} onChange={e => setDeliveryChallanNo(e.target.value)} placeholder="DC-0001"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white text-gray-800 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">E-Way Bill No.</p>
                    <input type="text" value={eWayBillNo} onChange={e => setEWayBillNo(e.target.value)} placeholder="331234567890"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white text-gray-800 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">E-Invoice No. (IRN)</p>
                    <input type="text" value={eInvoiceNo} onChange={e => setEInvoiceNo(e.target.value)} placeholder="IRN-..."
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white text-gray-800 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              </div>

              {/* ── Line items ── */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {/* Table header */}
                <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100"
                  style={{ gridTemplateColumns: '2.5fr 90px 90px 120px 80px 80px 116px 36px',
                           background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
                           borderBottom: '1px solid #dbeafe' }}>
                  <div className="px-5 py-3 text-gray-800">Description</div>
                  <div className="px-3 py-3 text-right text-gray-800">Meters (m)</div>
                  <div className="px-3 py-3 text-right text-gray-800">Qty (pcs)</div>
                  <div className="px-3 py-3 text-right text-gray-800">Price / m (₹)</div>
                  <div className="px-3 py-3 text-right text-gray-800">Disc %</div>
                  <div className="px-3 py-3 text-right text-gray-800">GST %</div>
                  <div className="px-3 py-3 text-right text-gray-800">Net Amount</div>
                  <div />
                </div>

                {/* Item rows */}
                {items.map((item, idx) => {
                  const c = calcLine(item)
                  return (
                    <div key={item.id}
                      className={`grid items-center border-b border-gray-100 last:border-0 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'} hover:bg-violet-50/20`}
                      style={{ gridTemplateColumns: '2.5fr 90px 90px 120px 80px 80px 116px 36px' }}>

                      {/* Description */}
                      <div className="px-5 py-3">
                        <input
                          value={item.productName}
                          onChange={e => updateItem(item.id, { productName: e.target.value })}
                          placeholder="Product name / description"
                          className="w-full text-sm font-medium text-gray-900 bg-transparent focus:outline-none placeholder-gray-300"
                        />
                        {item.meters > 0 && item.unitPrice > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                            {item.meters}m × ₹{item.unitPrice}/m
                          </p>
                        )}
                      </div>

                      {/* Meters */}
                      <div className="px-2 py-2.5">
                        <input type="number" min="0.01" step="0.01" value={item.meters || ''}
                          onChange={e => updateItem(item.id, { meters: parseFloat(e.target.value) || 0 })}
                          className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                      </div>

                      {/* Qty (pcs) */}
                      <div className="px-2 py-2.5">
                        <input type="number" min="1" step="1" value={item.quantity || ''}
                          onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                          className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                      </div>

                      {/* Price/m */}
                      <div className="px-2 py-2.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">₹</span>
                          <input type="number" min="0" step="0.01" value={item.unitPrice || ''}
                            onChange={e => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className={`w-full pl-5 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                        </div>
                      </div>

                      {/* Disc % */}
                      <div className="px-2 py-2.5">
                        <input type="number" min="0" max="100" step="0.5" value={item.discountPercent || ''}
                          onChange={e => updateItem(item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                          className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                      </div>

                      {/* GST % — dropdown */}
                      <div className="px-2 py-2.5">
                        <GstPicker value={item.taxRate} onChange={rate => updateItem(item.id, { taxRate: rate })} taxGroups={taxGroups} />
                      </div>

                      {/* Net Amount */}
                      <div className="px-3 py-2.5 text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">₹{c.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        {c.disc > 0 && <p className="text-[10px] text-emerald-600 tabular-nums">−₹{c.disc.toLocaleString('en-IN', { minimumFractionDigits: 2 })} disc</p>}
                      </div>

                      {/* Delete */}
                      <div className="pr-2 flex items-center justify-center">
                        <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Subtotals row */}
                {items.some(i => i.unitPrice > 0) && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex justify-end gap-8 text-sm">
                    <span className="text-gray-500">Subtotal: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                    {lineTotals.lineDisc > 0 && <span className="text-emerald-600">Discount: <span className="font-semibold tabular-nums">−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>}
                    <span className="text-gray-500">GST: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                  </div>
                )}

                {/* Add item */}
                <button type="button" onClick={addItem}
                  className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-violet-600 hover:bg-violet-50/50 transition-colors border-t border-dashed border-gray-200">
                  <Plus size={13} /> Add Line Item
                </button>
              </div>

              {/* ── Adjustments + Summary ── */}
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adjustments</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Bill Discount (%)</label>
                      <input type="number" min="0" max="100" step="0.5" value={billDiscountPct || ''}
                        onChange={e => setBillDiscountPct(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-right ${NO_SPINNER}`} />
                      {billDiscountPct > 0 && <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Freight (₹)</label>
                      <input type="number" min="0" step="0.01" value={shippingAmount || ''}
                        onChange={e => setShippingAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-right ${NO_SPINNER}`} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Invoice Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span className="tabular-nums font-medium">₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {lineTotals.lineDisc > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Line Discounts</span>
                        <span className="tabular-nums font-medium">−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {billDiscountPct > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Bill Discount ({billDiscountPct}%)</span>
                        <span className="tabular-nums font-medium">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>GST</span>
                      <span className="tabular-nums font-medium">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {shippingAmount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Freight</span>
                        <span className="tabular-nums font-medium">₹{shippingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[15px] border-t border-gray-200 pt-3 mt-1 text-gray-900">
                      <span>Grand Total</span>
                      <span className="tabular-nums text-violet-700">₹{roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Notes & Terms ── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Any notes for the customer…"
                    className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms &amp; Conditions</label>
                  <textarea rows={3} value={termsConditions} onChange={e => setTermsConditions(e.target.value)}
                    placeholder="Late payment charges, return policy…"
                    className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                </div>
              </div>

            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400 tabular-nums">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {grandTotal > 0 ? ` · Total ₹${roundedTotal.toLocaleString('en-IN')}` : ''}
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleClose} disabled={submitting}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-violet-400 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors font-medium">
                {submitting && !sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Save Draft
              </button>
              <button onClick={() => handleSubmit(true)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm">
                {submitting && sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Save &amp; Send
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Diameter View Modal ───────────────────────────────────────────────────────

function extractDiameterMm(name: string): number {
  const m = name.match(/(\d{3,4})\s*mm/i) || name.match(/\b(\d{3,4})\b/)
  return m ? parseInt(m[1]) : 0
}

function extractPressureClass(name: string): string {
  const m = name.match(/PN\s*[\d.]+/i)
  return m ? m[0].toUpperCase() : ''
}

const FALLBACK_DIAMETER_ROWS: { pipeName: string; finalTesting: number }[] = [
  { pipeName: 'PCCP 150mm PN3.15', finalTesting: 18 },
  { pipeName: 'PCCP 150mm PN4',    finalTesting: 7  },
  { pipeName: 'PCCP 200mm PN3.15', finalTesting: 24 },
  { pipeName: 'PCCP 300mm PN4',    finalTesting: 19 },
  { pipeName: 'PCCP 400mm PN3.15', finalTesting: 14 },
]
const DUMMY_QTY = [18, 7, 24, 11, 5, 32, 19, 14, 8, 6]

function DiameterViewModal({ rows, pipeConfigs, onClose }: {
  rows: { pipeName: string; finalTesting: number }[]
  pipeConfigs: { id: number; name: string; diameterMm: number; pressureClass: string }[]
  onClose: () => void
}) {
  const dummyRows: { pipeName: string; finalTesting: number }[] = useMemo(() => {
    if (pipeConfigs.length > 0) {
      return pipeConfigs.slice(0, 10).map((c, i) => ({
        pipeName: c.name,
        finalTesting: DUMMY_QTY[i % DUMMY_QTY.length],
      }))
    }
    return FALLBACK_DIAMETER_ROWS
  }, [pipeConfigs])

  const displayRows = rows.length === 0 ? dummyRows : rows

  // Group by diameter
  const byDiameter = useMemo(() => {
    const map = new Map<number, { pipeName: string; pressureClass: string; finalTesting: number }[]>()
    displayRows.forEach(r => {
      const dia = extractDiameterMm(r.pipeName)
      if (!map.has(dia)) map.set(dia, [])
      map.get(dia)!.push({
        pipeName: r.pipeName,
        pressureClass: extractPressureClass(r.pipeName),
        finalTesting: r.finalTesting,
      })
    })
    // Sort diameters ascending, unknown (0) last
    return Array.from(map.entries())
      .sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
  }, [rows])

  const totalReady = displayRows.reduce((s, r) => s + r.finalTesting, 0)
  const isDummy = rows.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Gauge size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Pipes Ready — by Diameter</h2>
              <p className="text-xs text-violet-100 mt-0.5">
                {totalReady} pipe{totalReady !== 1 ? 's' : ''} in Final Testing · {byDiameter.length} diameter{byDiameter.length !== 1 ? 's' : ''}
                {isDummy && <span className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold tracking-wide">SAMPLE</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
            <X size={15} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {byDiameter.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Gauge size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium">No pipes in Final Testing</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {byDiameter.map(([dia, entries]) => {
                const diaTotal = entries.reduce((s, e) => s + e.finalTesting, 0)
                return (
                  <div key={dia} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                    {/* Diameter header */}
                    <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                          <Gauge size={15} className="text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-violet-100 uppercase tracking-widest">Diameter</p>
                          <p className="text-base font-extrabold text-white leading-tight">
                            {dia > 0 ? `${dia} mm` : 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-extrabold text-white tabular-nums leading-none">{diaTotal}</p>
                        <p className="text-[10px] text-violet-100 mt-0.5">ready</p>
                      </div>
                    </div>

                    {/* Pressure class rows */}
                    <div className="divide-y divide-gray-100">
                      {entries.map(e => (
                        <div key={e.pipeName} className="flex items-center justify-between px-5 py-3 hover:bg-violet-50/40 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{e.pipeName}</p>
                            {e.pressureClass && (
                              <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100">
                                {e.pressureClass}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-extrabold tabular-nums leading-none ${e.finalTesting > 0 ? 'text-violet-600' : 'text-gray-300'}`}>
                              {e.finalTesting}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">pipes</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Card footer total (only if >1 pressure class) */}
                    {entries.length > 1 && (
                      <div className="px-5 py-2.5 bg-violet-50 border-t border-violet-100 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">Total</span>
                        <span className="text-sm font-extrabold text-violet-700 tabular-nums">{diaTotal} pipes</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer summary bar */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {byDiameter.map(([dia, entries]) => (
              <div key={dia} className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">{dia > 0 ? `${dia}mm` : 'Other'}:</span>
                <span className="text-sm font-bold text-violet-700 tabular-nums">
                  {entries.reduce((s, e) => s + e.finalTesting, 0)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Grand Total</span>
            <span className="text-base font-extrabold text-gray-900 tabular-nums">{totalReady}</span>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LoadingPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const outletId     = useAuthStore(s => s.outletId ?? 1)
  const today        = new Date()

  const [from, setFrom]   = useState(fmtDate(subDays(today, 29)))
  const [to, setTo]       = useState(fmtDate(today))
  const [search, setSearch] = useState('')

  // Fetch CURING_2 and FINAL_TESTING entries in the date range
  const { data: curing2Data, isLoading: loadingC2 } = useQuery({
    queryKey: ['loading-curing2', from, to],
    queryFn: () => productionEntryApi.getAll({
      stageType: 'CURING_2',
      from: from || undefined,
      to:   to   || undefined,
      size: 500,
    }).then(r => r.data.data?.content ?? r.data.data ?? []),
  })

  const { data: finalData, isLoading: loadingFT } = useQuery({
    queryKey: ['loading-final-testing', from, to],
    queryFn: () => productionEntryApi.getAll({
      stageType: 'FINAL_TESTING',
      from: from || undefined,
      to:   to   || undefined,
      size: 500,
    }).then(r => r.data.data?.content ?? r.data.data ?? []),
  })

  const isLoading = loadingC2 || loadingFT

  // Day 5 = pipes entered exactly 5 days ago (5th day of curing)
  // Day 6 = pipes entered exactly 6 days ago (6th day of curing)
  // Day 7 = pipes entered 7 OR MORE days ago (ready to load — cumulative)
  const day5Date = subDays(today, 5)
  const day6Date = subDays(today, 6)
  const day7Date = subDays(today, 7)   // cutoff — anything on or before this date
  const day5Str  = fmtDate(day5Date)
  const day6Str  = fmtDate(day6Date)
  const day7Str  = fmtDate(day7Date)

  // Build rows grouped by pipe config name
  const rows = useMemo(() => {
    const c2Entries: any[] = curing2Data ?? []
    const ftEntries: any[] = finalData    ?? []

    const pipeNames = new Set<string>()
    ;[...c2Entries, ...ftEntries].forEach(e => {
      pipeNames.add(e.pipeConfig?.name ?? `Config #${e.pipeConfigId}`)
    })

    return Array.from(pipeNames).sort().map(pipeName => {
      const byName = (e: any) =>
        (e.pipeConfig?.name ?? `Config #${e.pipeConfigId}`) === pipeName

      // Exact date match (Day 5 & Day 6)
      function sumExact(entries: any[], dateStr: string) {
        return entries
          .filter(e => byName(e) && (e.entryDate ?? '').split('T')[0] === dateStr)
          .reduce((s: number, e: any) => s + (e.pipesCompleted ?? 0), 0)
      }

      // Day 7+: all entries on or before the day-7 cutoff date
      function sumDay7Plus(entries: any[]) {
        return entries
          .filter(e => byName(e) && (e.entryDate ?? '').split('T')[0] <= day7Str)
          .reduce((s: number, e: any) => s + (e.pipesCompleted ?? 0), 0)
      }

      function sumAll(entries: any[]) {
        return entries
          .filter(byName)
          .reduce((s: number, e: any) => s + (e.pipesCompleted ?? 0), 0)
      }

      return {
        pipeName,
        curing2Day5:  sumExact(c2Entries, day5Str),
        curing2Day6:  sumExact(c2Entries, day6Str),
        curing2Day7:  sumDay7Plus(c2Entries),
        finalTesting: sumAll(ftEntries),
      }
    })
  }, [curing2Data, finalData, day5Str, day6Str, day7Str])

  const filtered = rows.filter(r =>
    !search || r.pipeName.toLowerCase().includes(search.toLowerCase())
  )

  const totalDay5      = filtered.reduce((s, r) => s + r.curing2Day5,  0)
  const totalDay6      = filtered.reduce((s, r) => s + r.curing2Day6,  0)
  const totalDay7      = filtered.reduce((s, r) => s + r.curing2Day7,  0)
  const totalFinal     = filtered.reduce((s, r) => s + r.finalTesting, 0)

  // ── Vendor + site address data ───────────────────────────────────
  const { data: finishedPipeInventory = [] } = useQuery({
    queryKey: ['finished-pipe-inventory', outletId],
    queryFn: () => inventoryApi.getAllByOutlet(outletId, 'FINISHED_PIPE', 0, 500)
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    staleTime: 60_000,
  })
  const inventoryQtyMap = useMemo(() => {
    const map = new Map<string, number>()
    ;(finishedPipeInventory as any[]).forEach((inv: any) => {
      const name = inv.product?.name ?? inv.productName ?? ''
      if (name) map.set(name, Number(inv.quantityOnHand ?? 0))
    })
    return map
  }, [finishedPipeInventory])

  const { data: pipeConfigsRaw = [] } = useQuery({
    queryKey: ['pipe-configs-loading'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 500 }).then(r => r.data.data?.content ?? r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const pipeConfigs: { id: number; name: string; diameterMm: number; pressureClass: string; lengthM: number }[] = pipeConfigsRaw as any[]
  const pipeLengths: number[] = useMemo(() =>
    [...new Set(pipeConfigs.map(pc => pc.lengthM))].sort((a, b) => a - b),
    [pipeConfigs]
  )

  const { data: vendorData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.getAll().then(r => r.data.data?.content ?? r.data.data ?? []),
  })
  const { data: salesOrderData } = useQuery({
    queryKey: ['sales-orders-addresses'],
    queryFn: () => salesOrderApi.getAll({ size: 500 }).then(r => r.data.data?.content ?? r.data.data ?? []),
  })
  const { data: customerData } = useQuery({
    queryKey: ['customers-for-loading'],
    queryFn: () => customerApi.getAll({ size: 500 }).then(r => r.data.data?.content ?? r.data.data ?? []),
  })

  const vendorOptions: string[] = useMemo(() =>
    (vendorData ?? []).map((v: any) => v.name ?? v.companyName ?? '').filter(Boolean),
  [vendorData])

  const customerOptions: string[] = useMemo(() =>
    (customerData ?? []).map((c: any) => c.name ?? c.companyName ?? '').filter(Boolean).sort(),
  [customerData])

  // Build customer→addresses map and expose filtered siteOptions
  const { customerAddressMap, siteOptions } = useMemo(() => {
    const byCustomer = new Map<string, string[]>()
    const seen = new Set<string>()
    const all: string[] = []
    ;(salesOrderData ?? []).forEach((so: any) => {
      const parts = [so.shippingAddress, so.shippingCity, so.shippingState].filter(Boolean)
      if (!parts.length) return
      const full = parts.join(', ')
      if (!seen.has(full)) { seen.add(full); all.push(full) }
      const custName = (so.customer?.name ?? so.customerName ?? '').trim().toLowerCase()
      if (custName) {
        if (!byCustomer.has(custName)) byCustomer.set(custName, [])
        if (!byCustomer.get(custName)!.includes(full)) byCustomer.get(custName)!.push(full)
      }
    })
    return { customerAddressMap: byCustomer, siteOptions: all }
  }, [salesOrderData])

  // ── Curing Days modal state ──────────────────────────────────────
  const [showCuringModal,    setShowCuringModal]    = useState(false)

  // ── Loaded records history state ─────────────────────────────────
  const [recSearch, setRecSearch]         = useState('')
  const [challanRecord, setChallanRecord] = useState<any | null>(null)
  const [autoPrint,     setAutoPrint]     = useState(false)
  const [photoRecord,   setPhotoRecord]   = useState<any | null>(null)
  const [lightboxUrl,   setLightboxUrl]   = useState<string | null>(null)
  const [convertRecord, setConvertRecord] = useState<any | null>(null)

  function closeChallan() { setChallanRecord(null); setAutoPrint(false) }

  function patchRecord(updated: any) {
    queryClient.setQueryData(['loading-records', from, to], (old: any[] | undefined) =>
      old?.map(r => r.id === updated.id ? { ...r, ...updated } : r)
    )
  }

  const { data: loadedRecordsData, isLoading: loadingRecords } = useQuery({
    queryKey: ['loading-records', from, to],
    queryFn: () => loadingRecordApi.getAll({ from: from || undefined, to: to || undefined })
      .then(r => r.data.data ?? []),
  })
  const loadedRecords: any[] = (loadedRecordsData ?? []).filter((r: any) => {
    if (!recSearch.trim()) return true
    const q = recSearch.toLowerCase()
    return (
      (r.pipeName      ?? '').toLowerCase().includes(q) ||
      (r.vehicleNo     ?? '').toLowerCase().includes(q) ||
      (r.driverName    ?? '').toLowerCase().includes(q) ||
      (r.vendor        ?? '').toLowerCase().includes(q) ||
      (r.customerPoNo  ?? '').toLowerCase().includes(q)
    )
  })

  // ── Load Pipes modal state ────────────────────────────────────────
  interface PipeEntry { id: string; pipeName: string; lengthM: number; qty: string; pipeNo: string }
  const newEntry = (): PipeEntry => ({ id: Math.random().toString(36).slice(2), pipeName: '', lengthM: 5.25, qty: '', pipeNo: '' })

  const [showModal,    setShowModal]    = useState(false)
  const [pipeEntries,  setPipeEntries]  = useState<PipeEntry[]>([newEntry()])
  const [submitting,   setSubmitting]   = useState(false)

  const emptyForm = {
    vehicleNo: '', date: fmtDate(today), notes: '',
    driverName: '', driverContact: '', vendor: '', siteAddress: '', customerName: '',
    transportRate: '', rateType: 'per_trip',  // per_pipe | per_trip
    deliveryChallanNo: '',
  }
  const [form, setForm] = useState(emptyForm)

  const { data: nextDCData } = useQuery({
    queryKey: ['loading-next-dc'],
    queryFn: () => loadingRecordApi.nextDCNumber().then((r: any) => r.data.data?.nextNumber ?? ''),
    staleTime: 0,
  })


  const filteredSiteOptions: string[] = useMemo(() => {
    const selected = form.customerName.trim().toLowerCase()
    if (!selected) return siteOptions
    const exact = customerAddressMap.get(selected)
    if (exact?.length) return exact
    const partialKey = [...customerAddressMap.keys()].find(k => k.includes(selected) || selected.includes(k))
    return partialKey ? customerAddressMap.get(partialKey)! : siteOptions
  }, [siteOptions, customerAddressMap, form.customerName])

  function openModal()  { setForm({ ...emptyForm, deliveryChallanNo: nextDCData ?? '' }); setPipeEntries([newEntry()]); setShowModal(true) }
  function closeModal() { setShowModal(false) }

  function setField(k: keyof typeof emptyForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function addPipeEntry() {
    setPipeEntries(prev => [...prev, newEntry()])
  }
  function removePipeEntry(id: string) {
    setPipeEntries(prev => prev.filter(e => e.id !== id))
  }
  function updatePipeEntry(id: string, patch: Partial<PipeEntry>) {
    setPipeEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = pipeEntries.filter(pe => pe.pipeName && pe.qty)
    if (valid.length === 0) return
    for (const pe of valid) {
      const avail = inventoryQtyMap.get(pe.pipeName) ?? 0
      if (parseInt(pe.qty) > avail) {
        toast.error(`Only ${avail} ${pe.pipeName} available in inventory`)
        return
      }
    }
    setSubmitting(true)
    try {
      await Promise.all(valid.map(pe =>
        loadingRecordApi.create({
          pipeName:          pe.pipeName,
          lengthM:           pe.lengthM,
          quantity:          parseInt(pe.qty),
          pipeNo:            pe.pipeNo,
          vehicleNo:         form.vehicleNo,
          date:              form.date,
          notes:             form.notes,
          driverName:        form.driverName,
          driverContact:     form.driverContact,
          vendor:            form.vendor,
          customerName:      form.customerName,
          siteAddress:       form.siteAddress,
          transportRate:     form.transportRate,
          deliveryChallanNo: form.deliveryChallanNo || undefined,
          rateType:      form.rateType,
        })
      ))
      toast.success(valid.length > 1 ? `${valid.length} pipe types loaded successfully` : 'Pipes loaded successfully')
      queryClient.invalidateQueries({ queryKey: ['loading-records'] })
      closeModal()
    } catch {
      toast.error('Failed to save loading record')
    } finally {
      setSubmitting(false)
    }
  }

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
        <div className="relative px-8 pt-6 pb-4 space-y-4">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button
                onClick={() => navigate('/business')}
                className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
              >
                <ArrowLeft size={16} className="text-white" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
                <Truck size={26} className="text-amber-300" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Business</p>
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Loading</h1>
                <p className="text-sm text-blue-200 mt-0.5">Curing stage readiness &amp; final testing status by pipe type</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DateFilterDropdown
                from={from} to={to}
                onChange={(f, t) => { setFrom(f); setTo(t) }}
              />
              <button
                onClick={() => setShowCuringModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/40"
              >
                <Layers size={16} />
                Curing Days
              </button>
              <button
                onClick={() => navigate('/business/loading/diameter-view')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 bg-violet-600 border border-violet-500 text-white hover:bg-violet-700"
              >
                <Gauge size={16} />
                Diameter View
              </button>
              <button
                onClick={openModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-900 text-sm font-bold rounded-xl shadow-[0_4px_14px_rgba(251,191,36,0.45)] hover:shadow-[0_4px_20px_rgba(251,191,36,0.60)] transition-all active:scale-95"
              >
                <PackageCheck size={16} />
                Load Pipes
              </button>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          {[
            { label: 'Curing 2 — Day 5', value: totalDay5, sub: format(day5Date, 'dd/MM'),        warn: false },
            { label: 'Curing 2 — Day 6', value: totalDay6, sub: format(day6Date, 'dd/MM'),        warn: false },
            { label: 'Curing 2 — Day 7', value: totalDay7, sub: `≤ ${format(day7Date, 'dd/MM')}`, warn: false },
            { label: 'Final Testing',    value: totalFinal, sub: 'completed',                        warn: false },
          ].map(s => (
            <div key={s.label} className="px-6 py-3.5">
              <p className={`text-xl font-extrabold tabular-nums leading-none ${s.warn ? 'text-amber-300' : 'text-white'}`}>{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Loaded Pipes History (always visible) ────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(109,40,217,0.12),0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-teal-100">

        {/* Card header */}
        <div className="bg-gradient-to-r from-teal-600 to-blue-600">
          {/* Top row: title + search */}
          <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
            <div className="flex items-center gap-3.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <ClipboardList size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-wide">Loaded Pipes</h2>
            </div>
            <div className="relative flex-1 max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
              <input
                value={recSearch}
                onChange={e => setRecSearch(e.target.value)}
                placeholder="Search pipe, vehicle, driver, vendor, CH. NO…"
                className="w-full pl-8 pr-7 py-2 text-xs bg-white/15 border border-white/25 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 transition-colors"
              />
              {recSearch && (
                <button onClick={() => setRecSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="border-t border-white/10 grid grid-cols-3 divide-x divide-white/10">
            {[
              { label: 'Total Dispatches',   value: loadedRecords.length },
              { label: 'Pipes Loaded',       value: loadedRecords.reduce((s: number, r: any) => s + (r.quantity ?? 0), 0) },
              { label: 'Unique Pipe Types',  value: new Set(loadedRecords.map((r: any) => r.pipeName)).size },
            ].map(s => (
              <div key={s.label} className="px-6 py-2.5">
                <p className="text-base font-extrabold tabular-nums leading-none text-white">{s.value}</p>
                <p className="text-[10px] text-teal-100 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {loadingRecords ? (
          <div className="p-6 animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : loadedRecords.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {recSearch ? `No records match "${recSearch}"` : 'No loading records found for the selected period'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200">
                  {['Date', 'Pipe Name', 'Qty', 'Vehicle No', 'Vendor', 'Site Address', 'Delivery Challan', 'Photo', 'Invoice'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadedRecords.map((rec: any, idx: number) => (
                  <tr
                    key={rec.id}
                    onClick={() => navigate(`/business/loading/${rec.id}`)}
                    className={`border-t border-gray-100 hover:bg-teal-50/30 transition-colors cursor-pointer ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-medium tabular-nums">
                      {rec.date ? format(new Date(rec.date), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{rec.pipeName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                        {rec.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{rec.vehicleNo || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rec.vendor || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                      <span className="flex items-center gap-1.5" title={rec.siteAddress}>
                        <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                        {rec.siteAddress || '—'}
                      </span>
                    </td>
                    {/* Delivery Challan */}
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-gray-600">{rec.deliveryChallanNo || `DC-${String(rec.id).padStart(4, '0')}`}</span>
                        <button
                          onClick={() => { setAutoPrint(false); setChallanRecord(rec) }}
                          title="View Delivery Challan"
                          className="p-0.5 text-gray-400 hover:text-violet-600 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => { setAutoPrint(true); setChallanRecord(rec) }}
                          title="Print Challan"
                          className="p-0.5 text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </td>

                    {/* Photo */}
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {rec.challanPhotoUrl && (
                          <button
                            onClick={() => setLightboxUrl(rec.challanPhotoUrl)}
                            title="View challan photo"
                            className="p-0.5 text-gray-400 hover:text-emerald-600 transition-colors"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setPhotoRecord(rec)}
                          title={rec.challanPhotoUrl ? 'Replace / remove photo' : 'Attach received challan photo'}
                          className="p-0.5 text-gray-400 hover:text-violet-600 transition-colors"
                        >
                          <Camera size={16} />
                        </button>
                      </div>
                    </td>

                    {/* Invoice */}
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {rec.invoiceId ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-mono font-semibold">
                            <Receipt size={11} />
                            {rec.invoiceNumber}
                          </span>
                          <div className="flex items-center gap-1">
                            <a
                              href={`/invoice/${rec.invoiceNumber}`}
                              target="_blank" rel="noreferrer"
                              title="View Invoice"
                              className="w-6 h-6 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Eye size={11} className="text-emerald-600" />
                            </a>
                            <a
                              href={`/invoice/${rec.invoiceNumber}?print=1`}
                              target="_blank" rel="noreferrer"
                              title="Print Invoice"
                              className="w-6 h-6 rounded-md bg-teal-50 hover:bg-teal-100 border border-teal-200 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Printer size={11} className="text-teal-600" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConvertRecord(rec)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 text-emerald-700 text-[11px] font-semibold transition-all active:scale-95 whitespace-nowrap"
                        >
                          <Receipt size={12} />
                          Convert to Invoice
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-teal-200 bg-teal-50">
                  <td className="px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wide">Total</td>
                  <td />
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-extrabold text-teal-700 tabular-nums">
                      {loadedRecords.reduce((s: number, r: any) => s + (r.quantity ?? 0), 0)}
                    </span>
                  </td>
                  <td colSpan={7} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Delivery Challan Modal ───────────────────────────────────── */}
      {challanRecord && (
        <DeliveryChallanModal
          record={challanRecord}
          onClose={closeChallan}
          autoPrint={autoPrint}
          onSaved={updated => {
            patchRecord(updated)
            setChallanRecord((prev: any) => ({ ...prev, ...updated }))
          }}
        />
      )}

      {/* ── Photo lightbox ───────────────────────────────────────────── */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <X size={18} />
          </button>
          <img src={lightboxUrl} alt="Challan photo"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── Challan Photo Modal ──────────────────────────────────────── */}
      {photoRecord && (
        <ChallanPhotoModal
          record={photoRecord}
          onClose={() => setPhotoRecord(null)}
          onUpdated={updated => {
            patchRecord(updated)
            setPhotoRecord((prev: any) => ({ ...prev, challanPhotoUrl: updated.challanPhotoUrl }))
          }}
        />
      )}

      {/* ── Convert to Invoice Modal ─────────────────────────────────── */}
      {convertRecord && (
        <ConvertToInvoiceModal
          record={convertRecord}
          outletId={outletId}
          onClose={() => setConvertRecord(null)}
          onConverted={updated => {
            patchRecord(updated)
            setConvertRecord(null)
          }}
        />
      )}

      {/* ── Curing Days Modal ─────────────────────────────────────────── */}
      {showCuringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCuringModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[88vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600 flex-shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Layers size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Loading Readiness</h2>
                  <p className="text-xs text-blue-100 mt-0.5">{filtered.length} pipe type{filtered.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search pipe name…"
                    className="w-full pl-8 pr-7 py-2 text-xs bg-white/15 border border-white/25 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 transition-colors"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowCuringModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X size={15} className="text-white" />
                </button>
              </div>
            </div>

            {/* Stat strip */}
            <div className="border-b border-violet-100 grid grid-cols-4 divide-x divide-violet-100 bg-violet-50 flex-shrink-0">
              {[
                { label: 'Curing 2 — Day 5', value: totalDay5,  sub: format(day5Date, 'dd/MM') },
                { label: 'Curing 2 — Day 6', value: totalDay6,  sub: format(day6Date, 'dd/MM') },
                { label: 'Curing 2 — Day 7+', value: totalDay7, sub: `≤ ${format(day7Date, 'dd/MM')}` },
                { label: 'Final Testing',     value: totalFinal, sub: 'completed' },
              ].map(s => (
                <div key={s.label} className="px-6 py-3">
                  <p className="text-lg font-extrabold tabular-nums leading-none text-violet-700">{s.value}</p>
                  <p className="text-xs text-violet-500 mt-0.5">{s.label}</p>
                  <p className="text-[10px] text-violet-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-6 animate-pulse space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">No data found for the selected range</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Pipe Name</th>
                      <th className="text-center px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        <span className="block">Curing 2</span>
                        <span className="text-[10px] font-medium text-slate-400 normal-case tracking-normal">Day 5 · {format(day5Date, 'dd/MM')}</span>
                      </th>
                      <th className="text-center px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        <span className="block">Curing 2</span>
                        <span className="text-[10px] font-medium text-slate-400 normal-case tracking-normal">Day 6 · {format(day6Date, 'dd/MM')}</span>
                      </th>
                      <th className="text-center px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        <span className="block">Curing 2</span>
                        <span className="text-[10px] font-medium text-slate-400 normal-case tracking-normal">Day 7+ · ≤ {format(day7Date, 'dd/MM')}</span>
                      </th>
                      <th className="text-center px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Final Testing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, idx) => (
                      <tr key={row.pipeName} className={`border-t border-gray-100 hover:bg-violet-50/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                        <td className="px-6 py-3 font-semibold text-gray-800">{row.pipeName}</td>
                        <td className="px-6 py-3 text-center">
                          {row.curing2Day5 > 0
                            ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">{row.curing2Day5}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {row.curing2Day6 > 0
                            ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">{row.curing2Day6}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {row.curing2Day7 > 0
                            ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{row.curing2Day7}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {row.finalTesting > 0
                            ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">{row.finalTesting}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-violet-200 bg-violet-50">
                      <td className="px-6 py-3 text-xs font-bold text-violet-700 uppercase tracking-wide">Total</td>
                      {[totalDay5, totalDay6, totalDay7, totalFinal].map((v, i) => (
                        <td key={i} className="px-6 py-3 text-center">
                          <span className="text-sm font-extrabold text-violet-700 tabular-nums">{v || '—'}</span>
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Load Pipes modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[900px] overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <PackageCheck size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Load Pipes</h2>
                  <p className="text-xs text-blue-100 mt-0.5">Record pipe dispatch from curing yard</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wide whitespace-nowrap">Date</label>
                  <input
                    required type="date"
                    value={form.date}
                    min={fmtDate(subDays(today, 2))}
                    max={fmtDate(today)}
                    onChange={e => setField('date', e.target.value)}
                    className="px-3 py-1.5 text-sm border border-white/25 rounded-xl bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20 transition-all [color-scheme:dark]"
                  />
                </div>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X size={15} className="text-white" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="max-h-[78vh] overflow-y-auto">
              <div className="p-6 space-y-6">

                {/* ── Section 1: Pipe Details ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">Pipe Details</span>
                    <div className="flex-1 h-px bg-violet-100" />
                    <button type="button" onClick={addPipeEntry}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors">
                      <Plus size={11} /> Add Pipe Type
                    </button>
                  </div>

                  {/* Column headers */}
                  <div className="grid gap-4 mb-1.5 px-0.5" style={{ gridTemplateColumns: '1.8fr 90px 120px 1fr 32px' }}>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Pipe Name</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Length</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Quantity</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Pipe No.</span>
                    <span />
                  </div>

                  <div className="space-y-2">
                    {pipeEntries.map((pe, idx) => {
                      const avail = inventoryQtyMap.get(pe.pipeName) ?? 0
                      const qty   = parseInt(pe.qty || '0')
                      const over  = pe.pipeName && qty > avail
                      return (
                        <div key={pe.id} className="grid gap-3 items-start" style={{ gridTemplateColumns: '1.8fr 90px 120px 1fr 32px' }}>

                          {/* Pipe Name */}
                          <div>
                            <Autocomplete
                              value={pe.pipeName}
                              onChange={v => updatePipeEntry(pe.id, { pipeName: v })}
                              options={pipeConfigs.map(pc => pc.name).filter(n => (inventoryQtyMap.get(n) ?? 0) > 0)}
                              placeholder="Search pipe type…"
                              renderOption={opt => {
                                const qty = inventoryQtyMap.get(opt) ?? 0
                                return (
                                  <span className="flex items-center justify-between w-full">
                                    <span className="font-medium">{opt}</span>
                                    {qty > 0
                                      ? <span className="text-green-600 font-bold text-xs tabular-nums">{qty} avail.</span>
                                      : <span className="text-red-400 font-semibold text-xs">Out of stock</span>
                                    }
                                  </span>
                                )
                              }}
                            />
                            {idx === 0 && !pe.pipeName && (
                              <input required value="" onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden />
                            )}
                          </div>

                          {/* Pipe Length */}
                          <div>
                            <select
                              value={pe.lengthM}
                              onChange={e => updatePipeEntry(pe.id, { lengthM: parseFloat(e.target.value) })}
                              className="w-full px-2 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                            >
                              {(pipeLengths.length > 0 ? pipeLengths : [5.25, 6.5]).map(l => (
                                <option key={l} value={l}>{l}m</option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div>
                            <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${
                              over
                                ? 'border-red-400 ring-2 ring-red-200'
                                : 'border-gray-200 focus-within:ring-2 focus-within:ring-violet-300'
                            }`}>
                              <button type="button"
                                onClick={() => updatePipeEntry(pe.id, { qty: String(Math.max(0, qty - 1)) })}
                                className="px-2.5 py-2.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                                <Minus size={13} />
                              </button>
                              <input
                                required={idx === 0} type="number" min="1"
                                max={avail || undefined}
                                value={pe.qty}
                                onChange={e => updatePipeEntry(pe.id, { qty: e.target.value })}
                                placeholder="0"
                                className={`flex-1 text-center text-sm font-semibold text-gray-800 py-2.5 focus:outline-none w-0 bg-transparent ${NO_SPINNER}`}
                              />
                              <button type="button"
                                onClick={() => updatePipeEntry(pe.id, { qty: String(Math.min(avail || Infinity, qty + 1)) })}
                                className="px-2.5 py-2.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                                <Plus size={13} />
                              </button>
                            </div>
                            {over
                              ? <p className="text-[10px] text-red-500 mt-0.5">Only {avail} available, {qty - avail} short</p>
                              : pe.pipeName && avail > 0
                                ? <p className="text-[10px] text-gray-400 mt-0.5">{avail} available</p>
                                : null
                            }
                          </div>

                          {/* Pipe No. */}
                          <input type="text" value={pe.pipeNo} onChange={e => updatePipeEntry(pe.id, { pipeNo: e.target.value })}
                            placeholder="e.g. 1"
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />

                          {/* Remove */}
                          <button type="button"
                            onClick={() => removePipeEntry(pe.id)}
                            disabled={pipeEntries.length === 1}
                            className="mt-0.5 w-8 h-[42px] flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors disabled:opacity-25 disabled:pointer-events-none">
                            <X size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Section 2: Transport ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">Transport</span>
                    <div className="flex-1 h-px bg-violet-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vendor / Transporter</label>
                      <Autocomplete
                        value={form.vendor}
                        onChange={v => setField('vendor', v)}
                        options={vendorOptions}
                        placeholder="Search vendor…"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transport Rate</label>
                        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                          {(['per_pipe', 'per_trip'] as const).map(rt => (
                            <button
                              key={rt}
                              type="button"
                              onClick={() => setField('rateType', rt)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                form.rateType === rt
                                  ? 'bg-white text-violet-700 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              {rt === 'per_pipe' ? '₹ / Pipe' : '₹ / Trip'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₹</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={form.transportRate}
                          onChange={e => setField('transportRate', e.target.value)}
                          placeholder="0.00"
                          className={`w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`}
                        />
                      </div>
                      {form.transportRate && Number(form.transportRate) > 0 && (() => {
                        const totalQty = pipeEntries.reduce((s, pe) => s + (parseInt(pe.qty || '0') || 0), 0)
                        return totalQty > 0 ? (
                          <p className="text-xs text-gray-400 mt-1 tabular-nums">
                            {form.rateType === 'per_pipe'
                              ? `${totalQty} pipes × ₹${form.transportRate} = ₹${(totalQty * parseFloat(form.transportRate)).toLocaleString('en-IN')}`
                              : `Trip total = ₹${parseFloat(form.transportRate).toLocaleString('en-IN')}`
                            }
                          </p>
                        ) : null
                      })()}
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Vehicle & Driver ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">Vehicle &amp; Driver</span>
                    <div className="flex-1 h-px bg-violet-100" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vehicle Number</label>
                      <input type="text" value={form.vehicleNo} onChange={e => setField('vehicleNo', e.target.value)}
                        placeholder="MH 12 AB 1234"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Driver Name</label>
                      <input type="text" value={form.driverName} onChange={e => setField('driverName', e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Driver Contact</label>
                      <input type="tel" value={form.driverContact} onChange={e => setField('driverContact', e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                    </div>
                  </div>
                </div>

                {/* ── Section 4: Delivery ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">Delivery</span>
                    <div className="flex-1 h-px bg-violet-100" />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Customer Name</label>
                      <Autocomplete
                        value={form.customerName}
                        onChange={v => { setField('customerName', v); setField('siteAddress', '') }}
                        options={customerOptions}
                        placeholder="Search customer…"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Site / Shipping Address</label>
                      <Autocomplete
                        value={form.siteAddress}
                        onChange={v => setField('siteAddress', v)}
                        options={filteredSiteOptions}
                        placeholder="Search or type address…"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          Delivery Challan No.
                        </label>
                        <input type="text" value={form.deliveryChallanNo} onChange={e => setField('deliveryChallanNo', e.target.value)}
                          placeholder="DC-20260714-0001"
                          className="w-full px-3 py-2.5 text-sm border border-violet-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-violet-50/30 font-mono text-gray-700" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Notes <span className="text-gray-300 normal-case font-normal">(optional)</span>
                      </label>
                      <textarea rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)}
                        placeholder="Any additional remarks…"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                    </div>
                  </div>
                </div>

              </div>

              {/* ── Actions ── */}
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  <PackageCheck size={15} />
                  {submitting ? 'Saving…' : pipeEntries.filter(pe => pe.pipeName && pe.qty).length > 1 ? `Confirm ${pipeEntries.filter(pe => pe.pipeName && pe.qty).length} Loads` : 'Confirm Load'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
