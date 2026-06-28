import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Search, Package, ChevronLeft, ChevronRight,
  FileText, Building2, Loader2, X, Calendar, ChevronDown,
  Truck, Receipt, History,
  Banknote, CreditCard, SplitSquareHorizontal,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi, vendorApi, taxGroupApi, purchaseOrderApi, outletApi } from '@/services/api'
import { UOM_OPTIONS, ALL_UNITS } from '@/constants/units'
import { useAuthStore } from '@/store/authStore'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n: any, d = 2) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v) || v === 0) return '0'
  return v % 1 === 0 ? v.toLocaleString() : parseFloat(v.toFixed(d)).toLocaleString()
}
function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0.00'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden'

let _lineId = 1
function newLine(): LineItem {
  return { _id: _lineId++, product: null, qty: '', unitCost: '', taxRate: '', taxGroupOverride: null, uom: '' }
}

interface LineItem {
  _id: number
  product: any | null
  qty: number | ''
  unitCost: number | ''
  taxRate: number | ''
  taxGroupOverride: any | null
  uom: string
}

function lineCalc(line: LineItem, gstInclusive: boolean) {
  const qty      = parseFloat(String(line.qty)) || 0
  const unitCost = parseFloat(String(line.unitCost)) || 0
  const taxGroup = line.taxGroupOverride ?? line.product?.taxGroup
  const totalRate = Number(taxGroup?.totalRate) || 0
  const cgstRate  = Number(taxGroup?.cgstRate)  || 0
  const sgstRate  = Number(taxGroup?.sgstRate)  || 0
  const igstRate  = Number(taxGroup?.igstRate)  || 0
  const cessRate  = Number(taxGroup?.cessRate)  || 0

  const subtotal = gstInclusive
    ? qty * unitCost / (1 + totalRate / 100)
    : qty * unitCost
  const taxAmt   = subtotal * totalRate / 100
  const lineTotal = subtotal + taxAmt

  return { qty, unitCost, subtotal, taxAmt, lineTotal, totalRate, cgstRate, sgstRate, igstRate, cessRate, taxGroup }
}

// ─── Product Picker (portal dropdown) ────────────────────────────────────────
const NON_PURCHASABLE_NAMES = ['silo cement', 'loose cement', 'extra cement']

function ProductPicker({ onSelect }: { onSelect: (p: any) => void }) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => { const t = setTimeout(() => setDq(q), 200); return () => clearTimeout(t) }, [q])

  const { data: rawResults = [], isFetching } = useQuery({
    queryKey: ['product-search-dp', dq],
    queryFn: () => dq.trim() ? productApi.search(dq.trim()).then(r => r.data.data ?? []) : Promise.resolve([]),
    enabled: dq.trim().length > 0,
  })

  // Only show raw materials and store items — no finished pipes
  const results = (rawResults as any[]).filter((p: any) =>
    p.purchasable !== false &&
    p.itemType !== 'FINISHED_PIPE' &&
    !NON_PURCHASABLE_NAMES.includes(p.name?.toLowerCase())
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function updatePos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 300) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos) }
  }, [open])

  const showResults = open && q.trim() && results.length > 0
  const showEmpty   = open && q.trim() && !isFetching && results.length === 0 && dq === q

  const dropdown = pos && (showResults || showEmpty) ? createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        {showResults && (results as any[]).slice(0, 10).map((p: any) => (
          <button
            key={p.id}
            onMouseDown={e => { e.preventDefault(); onSelect(p); setQ(''); setOpen(false) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left border-b border-gray-50 last:border-0"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Package size={12} className="text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
              <p className="text-[10px] text-gray-400">{p.sku} · {p.unitOfMeasure}</p>
            </div>
          </button>
        ))}
        {showEmpty && (
          <div className="px-4 py-6 text-center">
            <Package size={20} className="mx-auto text-gray-300 mb-1" />
            <p className="text-sm text-gray-400">No products found</p>
          </div>
        )}
      </div>
    </div>, document.body
  ) : null

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search product…"
          className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
        />
        {isFetching && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-400" />}
      </div>
      {dropdown}
    </div>
  )
}

// ─── GST Picker (portal dropdown — shows % only) ─────────────────────────────
function GstPicker({ value, onChange }: { value: any; onChange: (tg: any | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const { data: groups = [] } = useQuery({
    queryKey: ['tax-groups-active'],
    queryFn: () => taxGroupApi.getAll(true).then(r => r.data.data ?? []),
  })

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  function updatePos() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 160) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos) }
  }, [open])

  const dropdown = open && pos ? createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="max-h-48 overflow-y-auto">
          <button onMouseDown={e => { e.preventDefault(); onChange(null); setOpen(false) }}
            className="w-full px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 text-left border-b border-gray-100">
            0%
          </button>
          {(groups as any[]).filter((g: any) => Number(g.totalRate) > 0).map((g: any) => (
            <button key={g.id} onMouseDown={e => { e.preventDefault(); onChange(g); setOpen(false) }}
              className={`w-full px-3 py-2.5 text-sm text-left hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 ${value?.id === g.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-800'}`}>
              {g.totalRate}%
            </button>
          ))}
        </div>
      </div>
    </div>, document.body
  ) : null

  return (
    <div ref={ref}>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:border-indigo-300 transition-colors text-left">
        <span className="text-sm font-semibold text-gray-700">
          {value ? `${value.totalRate}%` : '0%'}
        </span>
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  )
}

// ─── Line Row ─────────────────────────────────────────────────────────────────
function LineRow({ line, onChange, onRemove, gstInclusive }: {
  line: LineItem
  onChange: (p: Partial<LineItem>) => void
  onRemove: () => void
  gstInclusive: boolean
}) {
  const calc = line.product ? lineCalc(line, gstInclusive) : null

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      {/* Product */}
      <td className="px-4 py-3">
        {line.product ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Package size={11} className="text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{line.product.name}</p>
              <p className="text-[10px] text-gray-400">{line.product.sku}</p>
            </div>
            <button onClick={() => onChange({ product: null, qty: '', unitCost: '', taxGroupOverride: null, uom: '' })}
              className="text-gray-300 hover:text-red-400 transition-colors shrink-0 ml-1">
              <X size={12} />
            </button>
          </div>
        ) : (
          <ProductPicker onSelect={p => onChange({
            product: p,
            unitCost: p.costPrice ?? '',
            taxGroupOverride: null,
            uom: p.unitOfMeasure ?? '',
          })} />
        )}
      </td>

      {/* Qty */}
      <td className="px-3 py-3">
        <input
          type="number" min="0" step="any"
          value={line.qty}
          onChange={e => onChange({ qty: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          placeholder="0"
          className={`w-full text-right border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white ${NO_SPINNER}`}
        />
      </td>

      {/* Unit */}
      <td className="px-3 py-3">
        <select
          value={line.uom}
          onChange={e => onChange({ uom: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
        >
          <option value="">— Unit —</option>
          {line.uom && !ALL_UNITS.some(u => u.value === line.uom) && (
            <option value={line.uom}>{line.uom}</option>
          )}
          {UOM_OPTIONS.map(group => (
            <optgroup key={group.group} label={group.group}>
              {group.units.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </td>

      {/* Unit Cost */}
      <td className="px-3 py-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">₹</span>
          <input
            type="number" min="0" step="any"
            value={line.unitCost}
            onChange={e => onChange({ unitCost: e.target.value === '' ? '' : parseFloat(e.target.value) })}
            placeholder="0.00"
            className={`w-full pl-7 pr-3 py-2.5 text-right text-sm font-medium border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white ${NO_SPINNER}`}
          />
        </div>
      </td>

      {/* GST */}
      <td className="px-3 py-3">
        {line.product ? (
          <GstPicker
            value={line.taxGroupOverride ?? line.product?.taxGroup ?? null}
            onChange={tg => onChange({ taxGroupOverride: tg })}
          />
        ) : (
          <div className="px-3 py-2.5 text-sm text-gray-300 border border-dashed border-gray-200 rounded-xl text-center">—</div>
        )}
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-right">
        {calc && calc.qty > 0 && calc.unitCost > 0 ? (
          <div>
            <p className="text-sm font-bold text-gray-900">{fmtCur(calc.lineTotal)}</p>
            {calc.taxAmt > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {gstInclusive ? `incl. ${fmtCur(calc.taxAmt)} GST` : `+${fmtCur(calc.taxAmt)} GST`}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        )}
      </td>

      {/* Remove — always visible */}
      <td className="px-2 py-3 text-center">
        <button
          onClick={onRemove}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove row"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────
function isoDate(d: Date) { return d.toISOString().split('T')[0] }
function startOf(unit: 'week' | 'month' | 'quarter' | 'year', d = new Date()) {
  const r = new Date(d)
  if (unit === 'week') { const day = r.getDay() || 7; r.setDate(r.getDate() - day + 1) }
  else if (unit === 'month') r.setDate(1)
  else if (unit === 'quarter') r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0); return r
}
type PresetKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year'
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' }, { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' }, { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' }, { key: 'this_year', label: 'This Year' },
]
function resolvePreset(key: PresetKey): { from: string; to: string } {
  const today = new Date(); const to = isoDate(today)
  switch (key) {
    case 'today':        return { from: to, to }
    case 'yesterday':  { const y = new Date(today); y.setDate(y.getDate() - 1); const d = isoDate(y); return { from: d, to: d } }
    case 'this_week':    return { from: isoDate(startOf('week')), to }
    case 'last_week':  { const end = new Date(startOf('week')); end.setDate(end.getDate() - 1); const start = new Date(end); start.setDate(start.getDate() - 6); return { from: isoDate(start), to: isoDate(end) } }
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
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
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
  const activeLabel = preset ? PRESETS.find(p => p.key === preset)?.label
    : hasDate ? `${fromDate || '…'} → ${toDate || '…'}` : null
  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all ${
          hasDate ? 'bg-white/20 border-white/40 text-white backdrop-blur-sm'
                  : 'bg-white/10 border-white/20 text-white/90 hover:bg-white/20 hover:border-white/40 backdrop-blur-sm'
        }`}>
        <Calendar size={14} />
        <span>{activeLabel ?? 'Filter by Date'}</span>
        {hasDate
          ? <X size={13} onClick={e => { e.stopPropagation(); clear() }} className="ml-1 opacity-70 hover:opacity-100" />
          : <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>
      {open && (
        <div ref={ref} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 w-72">
          <div className="p-2">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => selectPreset(p.key)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  preset === p.key ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DirectPurchasePage() {
  const qc = useQueryClient()
  const { outletId } = useAuthStore()

  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(outletId)
  const effectiveOutletId = selectedOutletId

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })
  useEffect(() => {
    if (selectedOutletId || outlets.length === 0) return
    const main = (outlets as any[]).find((o: any) => o.name.toLowerCase().includes('main store')) ?? outlets[0]
    if (main) setSelectedOutletId((main as any).id)
  }, [outlets])

  // Supplier
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierOpen, setSupplierOpen] = useState(false)
  const supplierBtnRef = useRef<HTMLButtonElement>(null)
  const supplierRef = useRef<HTMLDivElement>(null)
  const [supplierPos, setSupplierPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: () => vendorApi.getAll().then(r => r.data.data?.content ?? r.data.data ?? []),
  })
  const selectedSupplier = (suppliers as any[]).find((s: any) => s.id === supplierId) ?? null
  const filteredSuppliers = (suppliers as any[]).filter((s: any) =>
    !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  useEffect(() => {
    const h = (e: MouseEvent) => { if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setSupplierOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  function updateSupplierPos() {
    if (supplierBtnRef.current) {
      const r = supplierBtnRef.current.getBoundingClientRect()
      setSupplierPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) })
    }
  }
  useEffect(() => {
    if (!supplierOpen) return
    updateSupplierPos()
    window.addEventListener('scroll', updateSupplierPos, true)
    window.addEventListener('resize', updateSupplierPos)
    return () => { window.removeEventListener('scroll', updateSupplierPos, true); window.removeEventListener('resize', updateSupplierPos) }
  }, [supplierOpen])

  const supplierDropdown = supplierOpen && supplierPos ? createPortal(
    <div style={{ position: 'fixed', top: supplierPos.top, left: supplierPos.left, width: supplierPos.width, zIndex: 9999 }}>
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-2 pt-2 pb-1">
          <input autoFocus value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
            placeholder="Search supplier…"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300" />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filteredSuppliers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No suppliers found</p>
          )}
          {filteredSuppliers.map((s: any) => (
            <button key={s.id} onMouseDown={e => { e.preventDefault(); setSupplierId(s.id); setSupplierOpen(false); setSupplierSearch('') }}
              className={`w-full px-3 py-2.5 text-left hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 ${supplierId === s.id ? 'bg-indigo-50' : ''}`}>
              <p className="text-sm font-semibold text-gray-800">{s.name}</p>
              {s.phone && <p className="text-[10px] text-gray-400">{s.phone}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>, document.body
  ) : null

  // Form state
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [invoiceNo, setInvoiceNo] = useState('')
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [gstInclusive, setGstInclusive] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'cash' | 'credit' | 'partial'>('cash')
  const [paidAmount, setPaidAmount] = useState('')
  const [saving, setSaving] = useState(false)

  // Slide panel state
  const [showForm, setShowForm]       = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)

  const [selectedPO, setSelectedPO] = useState<any>(null)

  // Date filter
  const [from, setFrom] = useState('')
  const [to, setTo]     = useState('')
  function handleDateChange(f: string, t: string) { setFrom(f); setTo(t); setHistPage(0) }

  // Search
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput); setHistPage(0) }, 300); return () => clearTimeout(t) }, [searchInput])

  // History
  const [histPage, setHistPage] = useState(0)
  const [showHist, setShowHist] = useState(true)
  const { data: histData } = useQuery({
    queryKey: ['purchase-orders', effectiveOutletId, histPage, from, to, search],
    queryFn: () => purchaseOrderApi.getByOutlet(effectiveOutletId!, {
      page: histPage, size: 10,
      ...(from   && { from }),
      ...(to     && { to }),
      ...(search && { q: search }),
    }).then(r => r.data.data),
    enabled: !!effectiveOutletId,
  })
  const history: any[]       = histData?.content ?? []
  const totalHistPages: number = histData?.totalPages ?? 1

  function updateLine(id: number, patch: Partial<LineItem>) {
    setLines(prev => prev.map(l => l._id === id ? { ...l, ...patch } : l))
  }
  function removeLine(id: number) {
    setLines(prev => prev.length > 1 ? prev.filter(l => l._id !== id) : [newLine()])
  }

  const totals = useMemo(() => {
    const taxBuckets: Record<string, { name: string; cgst: number; sgst: number; igst: number; cess: number; total: number; rate: number }> = {}
    let subtotal = 0, taxTotal = 0
    lines.forEach(line => {
      if (!line.product) return
      const c = lineCalc(line, gstInclusive)
      subtotal += c.subtotal
      taxTotal += c.taxAmt
      if (c.taxGroup) {
        const key = String(c.taxGroup.id ?? c.taxGroup.name)
        if (!taxBuckets[key]) taxBuckets[key] = { name: c.taxGroup.name, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0, rate: c.totalRate }
        taxBuckets[key].cgst  += c.subtotal * c.cgstRate / 100
        taxBuckets[key].sgst  += c.subtotal * c.sgstRate / 100
        taxBuckets[key].igst  += c.subtotal * c.igstRate / 100
        taxBuckets[key].cess  += c.subtotal * c.cessRate / 100
        taxBuckets[key].total += c.taxAmt
      }
    })
    const grandTotal = subtotal + taxTotal
    const roundedTotal = Math.round(grandTotal)
    const roundOff = parseFloat((roundedTotal - grandTotal).toFixed(2))
    return { subtotal, taxTotal, taxBuckets, grandTotal, roundedTotal, roundOff }
  }, [lines, gstInclusive])

  const validLines = lines.filter(l => l.product && (parseFloat(String(l.qty)) || 0) > 0)

  function resetForm() {
    setLines([newLine()])
    setSupplierId(null)
    setInvoiceNo('')
    setPurchaseDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setGstInclusive(false)
    setPaymentMode('cash')
    setPaidAmount('')
  }

  function openPanel() {
    resetForm()
    setShowForm(true)
  }

  function closePanel() {
    setPanelVisible(false)
    setTimeout(() => setShowForm(false), 300)
  }

  useEffect(() => {
    if (showForm) {
      const id = requestAnimationFrame(() => setPanelVisible(true))
      return () => cancelAnimationFrame(id)
    }
  }, [showForm])

  async function handleSubmit() {
    if (validLines.length === 0) { toast.error('Add at least one product with a quantity'); return }
    if (!effectiveOutletId)       { toast.error('Please select an outlet'); return }
    if (!supplierId)              { toast.error('Please select a supplier'); return }

    setSaving(true)
    try {
      const payload: any = {
        outletId:      effectiveOutletId,
        supplierId,
        invoiceNumber: invoiceNo || null,
        purchaseDate,
        notes:         notes || null,
        paymentMode,
        items: validLines.map(l => {
          const taxGroup = l.taxGroupOverride ?? l.product?.taxGroup
          return {
            productId: l.product.id,
            quantity:  parseFloat(String(l.qty)),
            unitCost:  parseFloat(String(l.unitCost)) || 0,
            taxRate:   parseFloat(taxGroup?.totalRate ?? l.taxRate ?? 0),
          }
        }),
      }
      if (paymentMode === 'partial' && paidAmount) {
        payload.paidAmount = parseFloat(paidAmount) || 0
      }

      const res = await purchaseOrderApi.createDirect(payload)
      const data = res.data.data
      const modeLabel = paymentMode === 'credit' ? ' · Bill created (unpaid)' : paymentMode === 'partial' ? ' · Bill created (partial)' : ''
      toast.success(`Purchase recorded! PO# ${data.poNumber}${modeLabel}`)

      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'all', effectiveOutletId] })
      qc.invalidateQueries({ queryKey: ['inventory', 'low-stock', effectiveOutletId] })
      closePanel()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-gray-50">

      {/* Hero Header */}
      <div className="p-6 pb-0">
        <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
            <div className="absolute inset-0 opacity-[0.15]"
              style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
          </div>
          <div className="relative flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-4">
              <Package size={26} className="text-amber-300" />
              <div>
                <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Purchases</p>
                <h1 className="text-white text-2xl font-bold tracking-tight">Direct Purchase</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none" />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search supplier or PO#..."
                  className="pl-8 pr-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-violet-300 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              <DateRangePicker fromDate={from} toDate={to} onChange={handleDateChange} />
              <button
                onClick={openPanel}
                className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 transition-all px-4 py-2 rounded-xl text-sm font-bold shadow-md active:scale-95"
              >
                <Plus size={16} /> Add Direct Purchase
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide-in Purchase Panel ── */}
      {showForm && createPortal(
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${panelVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closePanel}
          />

          {/* Sliding panel */}
          <div className={`fixed inset-y-0 right-0 left-[220px] z-50 transition-transform duration-300 ease-out ${panelVisible ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

              {/* Panel header */}
              <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                    <Package size={17} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900 leading-none">Add Direct Purchase</h2>
                    <p className="text-xs text-gray-400 mt-0.5">PO number assigned on save</p>
                  </div>
                </div>
                <button onClick={closePanel} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

                  {/* ── Purchase Details ── */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Purchase Details</p>

                    {/* Outlet */}
                    {(outlets as any[]).length > 1 && (
                      <div className="mb-6">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                          <Building2 size={12} /> Outlet
                        </label>
                        <select
                          value={selectedOutletId ?? ''}
                          onChange={e => setSelectedOutletId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                        >
                          {(outlets as any[]).map((o: any) => (
                            <option key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Payment Mode */}
                    <div className="mb-6">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-3">
                        <Banknote size={12} /> Payment Mode <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-3">
                        {([
                          { key: 'cash',    label: 'Cash / Paid',  Icon: Banknote,              desc: 'Paid immediately' },
                          { key: 'credit',  label: 'Credit',        Icon: CreditCard,            desc: 'Full amount owed' },
                          { key: 'partial', label: 'Partial',       Icon: SplitSquareHorizontal, desc: 'Part paid, rest owed' },
                        ] as const).map(({ key, label, Icon, desc }) => (
                          <button key={key} type="button" onClick={() => setPaymentMode(key)}
                            className={`flex-1 flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                              paymentMode === key
                                ? key === 'cash'    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : key === 'credit'  ? 'border-red-400 bg-red-50 text-red-700'
                                :                    'border-amber-400 bg-amber-50 text-amber-700'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                            }`}>
                            <Icon size={17} className="shrink-0" />
                            <div>
                              <p className="text-sm font-semibold">{label}</p>
                              <p className="text-[10px] opacity-60">{desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      {paymentMode === 'partial' && (
                        <div className="mt-4 flex items-center gap-3">
                          <label className="text-xs font-semibold text-gray-600 shrink-0">Amount Paid Now (₹)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                            placeholder={`Max ${totals.grandTotal.toFixed(2)}`}
                            className={`w-48 border border-amber-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 ${NO_SPINNER}`}
                          />
                          {paidAmount && totals.grandTotal > 0 && (
                            <span className="text-xs text-amber-700 font-semibold">
                              Balance due: ₹{Math.max(0, totals.grandTotal - (parseFloat(paidAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      {/* Supplier */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                          <Truck size={12} /> Supplier <span className="text-red-400">*</span>
                        </label>
                        <div ref={supplierRef}>
                          <button
                            ref={supplierBtnRef}
                            onClick={() => setSupplierOpen(o => !o)}
                            className={`w-full flex items-center justify-between gap-2 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-colors ${
                              selectedSupplier ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
                            }`}
                          >
                            <span className={`truncate ${selectedSupplier ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                              {selectedSupplier ? selectedSupplier.name : 'Select supplier…'}
                            </span>
                            {selectedSupplier
                              ? <button onMouseDown={e => { e.stopPropagation(); setSupplierId(null) }}><X size={13} className="text-gray-400 hover:text-red-400" /></button>
                              : <Search size={13} className="text-gray-400 shrink-0" />
                            }
                          </button>
                          {supplierDropdown}
                        </div>
                      </div>

                      {/* Invoice Number */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                          <FileText size={12} /> Invoice / Bill No.
                        </label>
                        <input
                          type="text" placeholder="e.g. BILL-2024-001"
                          value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>

                      {/* Purchase Date */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                          <Calendar size={12} /> Purchase Date
                        </label>
                        <input
                          type="date"
                          value={purchaseDate}
                          onChange={e => setPurchaseDate(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Line Items ── */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Products</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed">
                        <colgroup>
                          <col />{/* Product — flex */}
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '150px' }} />
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '44px' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Product</th>
                            <th className="px-3 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Qty</th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Unit</th>
                            <th className="px-3 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">
                              <div>Unit Cost</div>
                              <div className="text-[10px] font-normal text-violet-400 normal-case">{gstInclusive ? 'incl. GST' : 'excl. GST'}</div>
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">GST</th>
                            <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
                            <th className="px-2 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map(line => (
                            <LineRow
                              key={line._id}
                              line={line}
                              onChange={patch => updateLine(line._id, patch)}
                              onRemove={() => removeLine(line._id)}
                              gstInclusive={gstInclusive}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-6 py-4 border-t border-dashed border-gray-100">
                      <button
                        onClick={() => setLines(prev => [...prev, newLine()])}
                        className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        <Plus size={16} /> Add Another Product
                      </button>
                    </div>
                  </div>

                  {/* ── Notes + Bill Summary ── */}
                  <div className="grid grid-cols-5 gap-6">
                    <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Notes (optional)</label>
                      <textarea
                        rows={5}
                        placeholder="Any additional remarks…"
                        value={notes} onChange={e => setNotes(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>

                    <div className="col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-5">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bill Summary</p>
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                          <button
                            onClick={() => setGstInclusive(false)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!gstInclusive ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          >Excl. GST</button>
                          <button
                            onClick={() => setGstInclusive(true)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${gstInclusive ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          >Incl. GST</button>
                        </div>
                      </div>

                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Subtotal (excl. GST)</span>
                          <span className="font-semibold text-gray-900">{fmtCur(totals.subtotal)}</span>
                        </div>
                        {Object.values(totals.taxBuckets).map(bucket => (
                          <div key={bucket.name} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-800">GST ({bucket.rate}%)</span>
                              <span className="text-sm font-bold text-amber-700">{fmtCur(bucket.total)}</span>
                            </div>
                            {(bucket.cgst > 0 || bucket.sgst > 0 || bucket.igst > 0) && (
                              <div className="flex gap-4 text-xs text-amber-600">
                                {bucket.cgst > 0 && <span>CGST: {fmtCur(bucket.cgst)}</span>}
                                {bucket.sgst > 0 && <span>SGST: {fmtCur(bucket.sgst)}</span>}
                                {bucket.igst > 0 && <span>IGST: {fmtCur(bucket.igst)}</span>}
                                {bucket.cess > 0 && <span>Cess: {fmtCur(bucket.cess)}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                        {totals.taxTotal === 0 && (
                          <div className="text-xs text-gray-400 text-center py-1">No tax applicable</div>
                        )}
                        {totals.roundOff !== 0 && (
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>Round Off</span>
                            <span className="font-medium tabular-nums">{totals.roundOff > 0 ? '+' : ''}₹{totals.roundOff.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-200 pt-3 mt-1 flex items-center justify-between">
                          <span className="text-base font-bold text-gray-900">Grand Total (incl. GST)</span>
                          <span className="text-xl font-black text-indigo-700">
                            ₹{totals.roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Panel footer */}
              <div className="px-8 py-4 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
                <p className="text-xs text-gray-400">
                  {validLines.length} item{validLines.length !== 1 ? 's' : ''}
                  {totals.roundedTotal > 0 ? ` · ₹${totals.roundedTotal.toLocaleString('en-IN')}` : ''}
                </p>
                <div className="flex gap-3">
                  <button onClick={closePanel} disabled={saving}
                    className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || validLines.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-[.98]"
                  >
                    {saving
                      ? <><Loader2 size={15} className="animate-spin" /> Recording…</>
                      : <><Receipt size={15} /> Record Purchase{validLines.length > 1 ? ` (${validLines.length} items)` : ''}</>
                    }
                  </button>
                </div>
              </div>

            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── PO Detail Modal ── */}
      {selectedPO && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) setSelectedPO(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Package size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Purchase Order</p>
                  <p className="font-mono text-sm font-bold text-indigo-700">{selectedPO.poNumber}</p>
                </div>
                <span className={`ml-2 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  selectedPO.status === 'RECEIVED'  ? 'bg-emerald-100 text-emerald-700' :
                  selectedPO.status === 'PARTIAL'   ? 'bg-amber-100 text-amber-700' :
                  selectedPO.status === 'SENT'      ? 'bg-blue-100 text-blue-700' :
                  selectedPO.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{selectedPO.status}</span>
              </div>
              <button onClick={() => setSelectedPO(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Supplier</p>
                  <p className="text-sm font-bold text-gray-800">{selectedPO.supplier?.name ?? '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Date</p>
                  <p className="text-sm font-bold text-gray-800">{selectedPO.receivedDate ? fmtDate(selectedPO.receivedDate) : fmtDate(selectedPO.createdAt)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Items</p>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100">
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Product</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Qty</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Unit Cost</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Tax %</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(selectedPO.items ?? []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-800">{item.product?.name ?? `Product #${item.productId}`}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmtNum(item.receivedQuantity || item.orderedQuantity)} {item.product?.unitOfMeasure ?? ''}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmtCur(item.unitCost)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{parseFloat(item.taxRate) > 0 ? `${item.taxRate}%` : '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtCur(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>{fmtCur(selectedPO.subtotal)}</span>
                </div>
                {parseFloat(selectedPO.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax</span><span>{fmtCur(selectedPO.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                  <span>Total</span><span>{fmtCur(selectedPO.totalAmount)}</span>
                </div>
              </div>

              {selectedPO.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedPO.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="p-6">

        {/* ── Purchase History ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowHist(h => !h)}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History size={16} className="text-indigo-500" />
              <span className="font-bold text-gray-900">Purchase History</span>
              {histData?.totalElements != null && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {histData.totalElements} records
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">{showHist ? 'Hide ↑' : 'Show ↓'}</span>
          </button>

          {showHist && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">PO #</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Supplier</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Items</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Total</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                          No purchase history yet
                        </td>
                      </tr>
                    ) : history.map((po: any) => (
                      <tr key={po.id} onClick={() => setSelectedPO(po)} className="border-b border-gray-50 hover:bg-violet-50/50 cursor-pointer transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">{po.poNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{po.receivedDate ? fmtDate(po.receivedDate) : fmtDate(po.createdAt)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{po.supplier?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{po.items?.length ?? 0}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtCur(po.totalAmount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            po.status === 'RECEIVED'  ? 'bg-emerald-100 text-emerald-700' :
                            po.status === 'PARTIAL'   ? 'bg-amber-100 text-amber-700' :
                            po.status === 'SENT'      ? 'bg-blue-100 text-blue-700' :
                            po.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{po.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalHistPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                  <button disabled={histPage === 0} onClick={() => setHistPage(p => p - 1)}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className="text-xs text-gray-400">Page {histPage + 1} of {totalHistPages}</span>
                  <button disabled={histPage >= totalHistPages - 1} onClick={() => setHistPage(p => p + 1)}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed">
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
