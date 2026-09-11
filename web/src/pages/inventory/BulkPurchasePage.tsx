import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Plus, Trash2, Search, Package, ChevronLeft, ChevronRight,
  ShoppingBag, ArrowRight, Truck, Tag, FileText,
  Building2, Loader2, CheckCircle2, X, Calendar, History,
  RefreshCw, ArrowRightLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi, bulkPurchaseApi, vendorApi, taxGroupApi, outletApi } from '@/services/api'

type ConversionStatus = 'NOT_CONVERTED' | 'PARTIALLY_CONVERTED' | 'CONVERTED'
const CONVERSION_CYCLE: ConversionStatus[] = ['NOT_CONVERTED', 'PARTIALLY_CONVERTED', 'CONVERTED']
const CONVERSION_LABELS: Record<ConversionStatus, string> = {
  NOT_CONVERTED:       'Not Converted',
  PARTIALLY_CONVERTED: 'Partially Converted',
  CONVERTED:           'Converted',
}
const CONVERSION_STYLES: Record<ConversionStatus, string> = {
  NOT_CONVERTED:       'bg-gray-100 text-gray-600 hover:bg-gray-200',
  PARTIALLY_CONVERTED: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  CONVERTED:           'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
}
function shortRef(ref: string) {
  // "BP-20240101-12345" → "BP-12345"
  const parts = ref.split('-')
  return parts.length >= 3 ? `${parts[0]}-${parts[parts.length - 1]}` : ref
}
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
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

let _lineId = 1
function newLine(): LineItem {
  return { _id: _lineId++, product: null, buyUnit: '', useBaseUnit: false, qty: '', rate: '', taxGroupOverride: null }
}

// ─── types ────────────────────────────────────────────────────────────────────
interface LineItem {
  _id: number
  product: any | null
  buyUnit: string           // free-text unit the user is entering qty in
  useBaseUnit: boolean      // true → qty is in baseUom; false → qty is in purchaseUom
  qty: number | ''
  rate: number | ''         // per unit, excl GST
  taxGroupOverride: any | null   // null → use product's default tax group
}

// derived per line
function lineCalc(line: LineItem, gstInclusiveOverride?: boolean) {
  const product        = line.product
  const qty            = parseFloat(String(line.qty)) || 0
  const rate           = parseFloat(String(line.rate)) || 0
  const purchaseFactor = parseFloat(product?.purchaseFactor ?? 1)
  const saleFactor     = parseFloat(product?.saleFactor ?? 1)
  const baseUom        = product?.unitOfMeasure ?? ''
  const purchaseUom    = product?.purchaseUom && purchaseFactor > 1 && product.purchaseUom !== baseUom
                           ? product.purchaseUom : baseUom
  const saleUom        = product?.saleUom && saleFactor > 1 && product.saleUom !== baseUom
                           ? product.saleUom : null

  // buyUnit: what the user typed. If it matches baseUom treat as base, else as purchase unit.
  const effectiveBuyUnit = line.buyUnit || purchaseUom
  const isBaseUnit   = line.useBaseUnit || effectiveBuyUnit === baseUom

  // qty in purchase units (what goes to the API)
  const purchaseQty  = isBaseUnit ? qty / purchaseFactor : qty
  // qty in base units (what gets added to stock)
  const stockQty     = isBaseUnit ? qty : qty * purchaseFactor
  // qty in sale units
  const saleQty      = saleUom ? stockQty / saleFactor : null

  const displayUnit  = effectiveBuyUnit

  // Tax from override or product's default taxGroup
  const taxGroup     = line.taxGroupOverride ?? product?.taxGroup
  const totalRate    = parseFloat(taxGroup?.totalRate ?? 0)
  const cgstRate     = parseFloat(taxGroup?.cgstRate ?? 0)
  const sgstRate     = parseFloat(taxGroup?.sgstRate ?? 0)
  const igstRate     = parseFloat(taxGroup?.igstRate ?? 0)
  const cessRate     = parseFloat(taxGroup?.cessRate ?? 0)
  const inclusive    = gstInclusiveOverride ?? taxGroup?.inclusive ?? false

  const subtotal     = inclusive
                         ? qty * rate / (1 + totalRate / 100)
                         : qty * rate
  const gstAmt       = subtotal * totalRate / 100
  const cgstAmt      = subtotal * cgstRate / 100
  const sgstAmt      = subtotal * sgstRate / 100
  const igstAmt      = subtotal * igstRate / 100
  const cessAmt      = subtotal * cessRate / 100
  const lineTotal    = subtotal + gstAmt

  return {
    purchaseQty, stockQty, saleQty, displayUnit, purchaseUom, baseUom, saleUom, purchaseFactor,
    subtotal, gstAmt, cgstAmt, sgstAmt, igstAmt, cessAmt, lineTotal,
    totalRate, cgstRate, sgstRate, igstRate, cessRate, inclusive,
    taxGroup,
  }
}

// ─── Inline Product Search ────────────────────────────────────────────────────
function ProductPicker({ onSelect }: { onSelect: (p: any) => void }) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Debounce the search query by 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200)
    return () => clearTimeout(t)
  }, [q])

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['product-search', debouncedQ],
    queryFn: () => debouncedQ.trim()
      ? productApi.search(debouncedQ.trim(), { purchasable: true }).then(r => r.data.data ?? [])
      : Promise.resolve([]),
    enabled: debouncedQ.trim().length > 0,
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Track input position for portal dropdown
  function updatePos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

  const showResults = open && q.trim() && results.length > 0
  const showEmpty   = open && q.trim() && !isFetching && results.length === 0 && debouncedQ === q

  const dropdown = dropPos && (showResults || showEmpty)
    ? createPortal(
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}>
          {showResults && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
              {(results as any[]).slice(0, 10).map((p: any) => (
                <button
                  key={p.id}
                  onMouseDown={() => { onSelect(p); setQ(''); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50 text-left border-b border-gray-50 last:border-0 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Package size={12} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sku || 'No SKU'} · {p.unitOfMeasure}</p>
                  </div>
                  {p.purchaseFactor > 1 && p.purchaseUom && (
                    <span className="flex-shrink-0 text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">
                      {p.purchaseUom}→{p.unitOfMeasure}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {showEmpty && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-3 text-sm text-gray-400">
              No products found
            </div>
          )}
        </div>,
        document.body
      )
    : null

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search product…"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => { if (q.trim()) setOpen(true) }}
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
        {isFetching && <Loader2 size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />}
      </div>
      {dropdown}
    </div>
  )
}

// ─── Vendor Search Picker ─────────────────────────────────────────────────────
function VendorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: () => vendorApi.getAll().then(r => r.data.data?.content ?? []),
  })

  const filtered = useMemo(() => {
    if (!q.trim()) return (vendors as any[]).slice(0, 8)
    const lo = q.toLowerCase()
    return (vendors as any[])
      .filter((v: any) =>
        v.name?.toLowerCase().includes(lo) ||
        v.contactPerson?.toLowerCase().includes(lo) ||
        v.phone?.toLowerCase().includes(lo)
      )
      .slice(0, 8)
  }, [q, vendors])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // keep local q in sync when parent clears
  useEffect(() => { setQ(value) }, [value])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search or type supplier…"
          value={q}
          onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
          {filtered.map((v: any) => (
            <button
              key={v.id}
              onMouseDown={() => { onChange(v.name); setQ(v.name); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50 text-left border-b border-gray-50 last:border-0 transition-colors"
            >
              <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={11} className="text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{v.name}</p>
                {v.phone && <p className="text-xs text-gray-400">{v.phone}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tax Group Picker ─────────────────────────────────────────────────────────
function TaxGroupPicker({ value, onChange }: { value: any | null; onChange: (tg: any | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const { data: taxGroups = [] } = useQuery({
    queryKey: ['tax-groups-all'],
    queryFn: () => taxGroupApi.getAll(true).then(r => r.data.data ?? []),
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function updatePos() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 200) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

  const dropdown = open && dropPos
    ? createPortal(
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}>
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            <button
              onMouseDown={() => { onChange(null); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-50 transition-colors"
            >
              <span className="text-xs text-gray-400 italic">No Tax</span>
            </button>
            {(taxGroups as any[]).map((tg: any) => (
              <button
                key={tg.id}
                onMouseDown={() => { onChange(tg); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-amber-50 text-left border-b border-gray-50 last:border-0 transition-colors ${value?.id === tg.id ? 'bg-amber-50' : ''}`}
              >
                <span className="text-xs font-semibold text-amber-800 truncate">{tg.name}</span>
                <span className="text-[10px] text-amber-600 flex-shrink-0">{tg.totalRate}%</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <div ref={ref}>
      <button
        ref={triggerRef}
        onClick={() => { updatePos(); setOpen(o => !o) }}
        className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
          value
            ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
        }`}
      >
        <span className="truncate font-semibold">{value ? value.name : 'No Tax'}</span>
        <span className="flex-shrink-0 text-[10px] opacity-60">▾</span>
      </button>
      {value && (
        <div className="flex gap-1 flex-wrap mt-0.5">
          {value.cgstRate > 0 && <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">CGST {value.cgstRate}%</span>}
          {value.sgstRate > 0 && <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">SGST {value.sgstRate}%</span>}
          {value.igstRate > 0 && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">IGST {value.igstRate}%</span>}
          {value.inclusive && <span className="text-[10px] text-gray-400 italic">incl.</span>}
        </div>
      )}
      {dropdown}
    </div>
  )
}

// ─── Unit Picker ──────────────────────────────────────────────────────────────
function UnitPicker({
  value, onChange, quickPick,
}: {
  value: string
  onChange: (u: string) => void
  quickPick?: { label: string; active: boolean; onPick: () => void }[]
}) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Filter grouped options by search query
  const filteredGroups = useMemo(() => {
    const lo = q.trim().toLowerCase()
    if (!lo) return UOM_OPTIONS
    return UOM_OPTIONS.map(g => ({
      ...g,
      units: g.units.filter(u =>
        u.value.toLowerCase().includes(lo) || u.label.toLowerCase().includes(lo)
      ),
    })).filter(g => g.units.length > 0)
  }, [q])

  // keep input in sync when parent sets a new value (e.g. product swap)
  useEffect(() => { setQ(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function updatePos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 200) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

  const totalMatches = filteredGroups.reduce((s, g) => s + g.units.length, 0)

  const dropdown = open && dropPos
    ? createPortal(
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}>
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden" style={{ maxHeight: 260 }}>
            <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
              {totalMatches === 0 ? (
                <div className="px-3 py-2.5 text-xs text-gray-400 italic">
                  No match — "{q}" will be used as a custom unit
                </div>
              ) : (
                filteredGroups.map(g => (
                  <div key={g.group}>
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                      {g.group}
                    </div>
                    {g.units.map(u => (
                      <button
                        key={u.value}
                        onMouseDown={() => { onChange(u.value); setQ(u.value); setOpen(false) }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-indigo-50 border-b border-gray-50 last:border-0 transition-colors ${
                          u.value === value ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700'
                        }`}
                      >
                        <span className="font-semibold">{u.value}</span>
                        <span className="text-gray-400">{u.label.replace(` (${u.value})`, '')}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <div ref={ref} className="space-y-1">
      <input
        ref={inputRef}
        type="text"
        value={q}
        placeholder="unit…"
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => { updatePos(); setOpen(true) }}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
      {quickPick && quickPick.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {quickPick.map(c => (
            <button
              key={c.label}
              onClick={() => { c.onPick(); setQ(c.label) }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                c.active
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {dropdown}
    </div>
  )
}

// ─── Line Row ─────────────────────────────────────────────────────────────────
function LineRow({
  line, onChange, onRemove, showRemove, gstInclusive,
}: {
  line: LineItem
  onChange: (patch: Partial<LineItem>) => void
  onRemove: () => void
  showRemove: boolean
  gstInclusive: boolean
}) {
  const calc = line.product ? lineCalc(line, gstInclusive) : null
  // Effective tax group (override or product default)
  const effectiveTaxGroup = line.taxGroupOverride ?? line.product?.taxGroup ?? null

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">

      {/* Product */}
      <td className="px-3 py-2.5">
        {line.product ? (
          <div className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Package size={12} className="text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-none">{line.product.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{line.product.sku || '—'}</p>
            </div>
            <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all ml-1 flex-shrink-0" title="Remove">
              <X size={13} />
            </button>
          </div>
        ) : (
          <ProductPicker onSelect={p => {
            const pUom = (p.purchaseFactor > 1 && p.purchaseUom && p.purchaseUom !== p.unitOfMeasure)
              ? p.purchaseUom : p.unitOfMeasure
            onChange({ product: p, buyUnit: pUom, useBaseUnit: false })
          }} />
        )}
      </td>

      {/* Unit — searchable picker */}
      <td className="px-3 py-2.5">
        {line.product && calc ? (
          <UnitPicker
            value={line.buyUnit}
            onChange={u => onChange({ buyUnit: u })}
          />
        ) : (
          <span className="text-xs text-gray-300 px-2">—</span>
        )}
      </td>

      {/* Qty */}
      <td className="px-3 py-2.5">
        <div className="relative">
          <input
            type="number" min="0.0001" step="any"
            placeholder="0"
            value={line.qty}
            onChange={e => onChange({ qty: e.target.value === '' ? '' : parseFloat(e.target.value) })}
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
            disabled={!line.product}
          />
        </div>
      </td>

      {/* Rate excl GST */}
      <td className="px-3 py-2.5">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">₹</span>
          <input
            type="number" min="0" step="0.01"
            placeholder="0.00"
            value={line.rate}
            onChange={e => onChange({ rate: e.target.value === '' ? '' : parseFloat(e.target.value) })}
            className="w-full border border-gray-200 rounded-lg pl-6 pr-2.5 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
            disabled={!line.product}
          />
        </div>
      </td>

      {/* Tax Group — editable */}
      <td className="px-3 py-2.5">
        {line.product ? (
          <TaxGroupPicker
            value={effectiveTaxGroup}
            onChange={tg => onChange({ taxGroupOverride: tg })}
          />
        ) : (
          <span className="text-xs text-gray-300 px-2">—</span>
        )}
      </td>

      {/* Amount */}
      <td className="px-3 py-2.5 text-right">
        {calc && (parseFloat(String(line.qty)) || 0) > 0 && (parseFloat(String(line.rate)) || 0) > 0 ? (
          <div>
            <p className="text-sm font-bold text-gray-900">{fmtCur(calc.lineTotal)}</p>
            {calc.gstAmt > 0 && (
              <p className="text-[10px] text-gray-400">
                {gstInclusive ? `incl. ${fmtCur(calc.gstAmt)} GST` : `+${fmtCur(calc.gstAmt)} GST`}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        )}
      </td>

      {/* Stock conversion preview */}
      <td className="px-3 py-2.5">
        {calc && (parseFloat(String(line.qty)) || 0) > 0 ? (
          <div className="space-y-1">
            {/* Stock addition */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={9} />
                +{fmtNum(calc.stockQty)} {calc.baseUom}
              </span>
            </div>
            {/* Selling unit breakdown */}
            {calc.saleUom && calc.saleQty && (
              <div className="flex items-center gap-1">
                <ArrowRight size={9} className="text-gray-300" />
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Tag size={9} />
                  {fmtNum(calc.saleQty)} {calc.saleUom}
                </span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Remove */}
      <td className="px-2 py-2.5 w-8 text-center">
        {showRemove && (
          <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Convert Modal ─────────────────────────────────────────────────────────────

function ConvertModal({ bp, outletId, onClose, onSuccess }: {
  bp: any
  outletId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()

  const baseUom    = bp.baseUom || bp.product?.unitOfMeasure || 'unit'
  const totalBase  = parseFloat(bp.baseQty ?? 0)
  const converted  = parseFloat(bp.convertedBaseQty ?? 0)
  const remaining  = Math.max(0, totalBase - converted)

  // target product — default to the same product
  const [targetProductId, setTargetProductId] = useState<number>(bp.product?.id)
  const [productSearch, setProductSearch]     = useState(bp.product?.name ?? '')
  const [showProductDrop, setShowProductDrop] = useState(false)

  // how many base units to take from this bulk purchase
  const [fromBaseQty, setFromBaseQty] = useState<string>(remaining.toString())
  // size of each sale unit in base units (e.g. 1 for 1kg, 0.5 for 500g)
  const [saleUnitSize, setSaleUnitSize] = useState<string>(
    bp.product?.saleFactor ? String(parseFloat(bp.product.saleFactor)) : '1'
  )
  // unit label
  const [saleUom, setSaleUom] = useState<string>(
    bp.product?.saleUom || bp.product?.unitOfMeasure || baseUom
  )
  const [notes, setNotes] = useState('')

  const fromBase  = parseFloat(fromBaseQty) || 0
  const unitSize  = parseFloat(saleUnitSize) || 1
  const saleQty   = unitSize > 0 ? Math.floor(fromBase / unitSize) : 0
  const leftover  = fromBase - saleQty * unitSize

  // Product search
  const { data: productData } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: () => productApi.getAll({ page: 0, size: 20, search: productSearch }).then(r => r.data.data?.content ?? []),
    enabled: showProductDrop && productSearch.length > 0,
  })
  const productResults: any[] = productData ?? []

  const convertMut = useMutation({
    mutationFn: () => bulkPurchaseApi.convert(bp.id, {
      targetProductId,
      fromBaseQty: fromBase,
      saleQty,
      saleUom: `${saleUnitSize} ${saleUom}`,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success(`Converted — ${saleQty} units added to stock`)
      qc.invalidateQueries({ queryKey: ['bulk-purchases'] })
      onSuccess()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Conversion failed'),
  })

  const canSubmit = fromBase > 0 && fromBase <= remaining && saleQty > 0 && targetProductId

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <ArrowRightLeft size={16} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Convert Bulk Stock</h2>
              <p className="text-xs text-gray-400 mt-0.5">{bp.product?.name} · {bp.referenceNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">

          {/* Availability bar */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Total purchased</span>
              <span className="font-semibold text-gray-700">{fmtNum(totalBase)} {baseUom}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Already converted</span>
              <span className="font-semibold text-amber-600">{fmtNum(converted)} {baseUom}</span>
            </div>
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Remaining available</span>
              <span className="font-bold text-emerald-600">{fmtNum(remaining)} {baseUom}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${totalBase > 0 ? Math.min(100, (remaining / totalBase) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Target product */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Target Product</label>
            <div className="relative">
              <input
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true) }}
                onFocus={() => setShowProductDrop(true)}
                placeholder="Search product to add stock to…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              {showProductDrop && productResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-gray-100 shadow-lg max-h-48 overflow-y-auto">
                  {productResults.map((p: any) => (
                    <button key={p.id} onMouseDown={() => {
                      setTargetProductId(p.id)
                      setProductSearch(p.name)
                      setSaleUom(p.saleUom || p.unitOfMeasure || baseUom)
                      setSaleUnitSize(p.saleFactor ? String(parseFloat(p.saleFactor)) : '1')
                      setShowProductDrop(false)
                    }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                      <Package size={13} className="text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.name}</p>
                        {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Conversion inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Qty to convert ({baseUom})
              </label>
              <input
                type="number" min="0" step="any"
                value={fromBaseQty}
                onChange={e => setFromBaseQty(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              {fromBase > remaining && (
                <p className="text-[11px] text-red-500 mt-1">Exceeds remaining {fmtNum(remaining)} {baseUom}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sale unit size ({baseUom})</label>
              <input
                type="number" min="0.001" step="any"
                value={saleUnitSize}
                onChange={e => setSaleUnitSize(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Unit label (shown on stock)</label>
            <input
              value={saleUom}
              onChange={e => setSaleUom(e.target.value)}
              placeholder="e.g. kg, pcs, 500g packet"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* Preview */}
          {fromBase > 0 && saleQty > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-violet-700">Conversion preview</p>
              <p className="text-sm text-violet-800">
                <span className="font-bold">{fmtNum(fromBase)} {baseUom}</span>
                {' '}→{' '}
                <span className="font-bold">{saleQty} units</span>
                {' '}of{' '}
                <span className="font-bold">{saleUnitSize} {saleUom}</span>
                {' '}each
              </p>
              {leftover > 0.001 && (
                <p className="text-xs text-violet-500">
                  {fmtNum(leftover, 4)} {baseUom} remainder (won't be converted)
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Repacked into 1kg packets"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-white">
            Cancel
          </button>
          <button
            disabled={!canSubmit || convertMut.isPending}
            onClick={() => convertMut.mutate()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {convertMut.isPending
              ? <><RefreshCw size={14} className="animate-spin" /> Converting…</>
              : <><ArrowRightLeft size={14} /> Convert {saleQty > 0 ? `→ ${saleQty} units` : ''}</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BulkPurchasePage() {
  const qc = useQueryClient()
  const { outletId } = useAuthStore()

  // Outlet selector — allows overriding the user's default outlet (for admins)
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(outletId)
  const effectiveOutletId = selectedOutletId

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })

  // Auto-select "Main Store" (or first outlet) once outlets load
  useEffect(() => {
    if (selectedOutletId || outlets.length === 0) return
    const mainStore = outlets.find((o: any) => o.name.toLowerCase().includes('main store')) ?? outlets[0]
    if (mainStore) setSelectedOutletId(mainStore.id)
  }, [outlets])

  // Bill state
  const [lines,        setLines]        = useState<LineItem[]>([newLine()])
  const [supplier,     setSupplier]     = useState('')
  const [invoiceNo,    setInvoiceNo]    = useState('')
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [notes,        setNotes]        = useState('')
  const [gstInclusive, setGstInclusive] = useState(false)
  const [saving,       setSaving]       = useState(false)

  // History
  const [histPage, setHistPage] = useState(0)
  const [showHist, setShowHist] = useState(true)

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['bulk-purchases', effectiveOutletId, histPage],
    queryFn: () => bulkPurchaseApi.getHistory(effectiveOutletId!, { page: histPage, size: 10 }).then(r => r.data.data),
    enabled: !!effectiveOutletId,
  })

  const history: any[]       = histData?.content ?? []
  const totalHistPages: number = histData?.totalPages ?? 1

  // Computed totals
  const totals = useMemo(() => {
    // taxGroupId → { name, cgst, sgst, igst, cess, total }
    const taxBuckets: Record<string, { name: string; cgst: number; sgst: number; igst: number; cess: number; total: number }> = {}
    let subtotal = 0
    let gstTotal = 0

    lines.forEach(line => {
      if (!line.product) return
      const c = lineCalc(line, gstInclusive)
      subtotal += c.subtotal
      gstTotal += c.gstAmt
      if (c.taxGroup) {
        const key = String(c.taxGroup.id ?? c.taxGroup.name)
        if (!taxBuckets[key]) taxBuckets[key] = { name: c.taxGroup.name, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 }
        taxBuckets[key].cgst  += c.cgstAmt
        taxBuckets[key].sgst  += c.sgstAmt
        taxBuckets[key].igst  += c.igstAmt
        taxBuckets[key].cess  += c.cessAmt
        taxBuckets[key].total += c.gstAmt
      }
    })

    const grandTotal = subtotal + gstTotal
    return { subtotal, gstTotal, taxBuckets, grandTotal }
  }, [lines, gstInclusive])

  function updateLine(id: number, patch: Partial<LineItem>) {
    setLines(prev => prev.map(l => l._id === id ? { ...l, ...patch } : l))
  }
  function removeLine(id: number) {
    setLines(prev => prev.length > 1 ? prev.filter(l => l._id !== id) : [newLine()])
  }
  function addLine() {
    setLines(prev => [...prev, newLine()])
  }

  async function handleSubmit() {
    const valid = lines.filter(l => l.product && (parseFloat(String(l.qty)) || 0) > 0)
    if (valid.length === 0) { toast.error('Add at least one product with a quantity'); return }
    if (!effectiveOutletId) { toast.error('Please select an outlet'); return }

    setSaving(true)
    let successCount = 0
    let failCount    = 0

    for (const line of valid) {
      const calc = lineCalc(line, gstInclusive)
      try {
        await bulkPurchaseApi.record({
          productId:     line.product.id,
          outletId:      effectiveOutletId,
          purchaseQty:   calc.purchaseQty,
          costPerUnit:   parseFloat(String(line.rate)) || null,
          supplier:      supplier || null,
          invoiceNumber: invoiceNo || null,
          purchaseDate:  purchaseDate,
          notes:         notes || null,
        })
        successCount++
      } catch (err: any) {
        failCount++
        toast.error(`${line.product.name}: ${err?.response?.data?.message ?? 'Failed'}`)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} item${successCount > 1 ? 's' : ''} recorded successfully`)
      setLines([newLine()])
      setSupplier('')
      setInvoiceNo('')
      setPurchaseDate(new Date().toISOString().slice(0, 10))
      setNotes('')
      qc.invalidateQueries({ queryKey: ['bulk-purchases'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'all', effectiveOutletId] })
      qc.invalidateQueries({ queryKey: ['inventory', 'low-stock', effectiveOutletId] })
    }
    setSaving(false)
  }

  const validLineCount = lines.filter(l => l.product && (parseFloat(String(l.qty)) || 0) > 0).length

  const { mutate: cycleStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ConversionStatus }) =>
      bulkPurchaseApi.updateConversionStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulk-purchases'] }),
    onError: () => toast.error('Failed to update status'),
  })

  const [convertingBp, setConvertingBp] = useState<any | null>(null)

  return (
    <div className="min-h-full bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <ShoppingBag size={26} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Inventory</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Bulk Purchase Entry</h1>
              <p className="text-sm text-blue-200 mt-0.5">Add products, select units, enter prices — stock updates automatically</p>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10 grid grid-cols-3 divide-x divide-white/10">
          {[
            { label: 'Current Lines',    value: lines.filter(l => l.product).length,                                                                  sub: 'items in bill'    },
            { label: 'Grand Total',      value: `₹${totals.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,                        sub: 'incl. GST'        },
            { label: 'Purchase History', value: history.length,                                                                                        sub: 'recent entries'   },
          ].map(s => (
            <div key={s.label} className="px-5 py-3.5">
              <p className="text-xl font-extrabold tabular-nums leading-none text-white">{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Invoice Header ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Invoice Details</p>
          {outlets.length > 1 && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Building2 size={11} /> Outlet
              </label>
              <select
                value={selectedOutletId ?? ''}
                onChange={e => setSelectedOutletId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Building2 size={11} /> Supplier / Vendor
              </label>
              <VendorPicker value={supplier} onChange={setSupplier} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <FileText size={11} /> Invoice Number
              </label>
              <input
                type="text" placeholder="e.g. INV-2024-001"
                value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Calendar size={11} /> Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
        </div>

        {/* ── Line Items ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Products</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                Unit selector: click to switch between purchase unit and base unit
              </span>
            </div>
          </div>

          <div>
            <table className="w-full table-fixed">
              <colgroup>
                <col />{/* Product — flex */}
                <col style={{ width: '110px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '108px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '32px' }} />
              </colgroup>
              <thead>
                <tr className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-2.5 text-left">Product</th>
                  <th className="px-3 py-2.5 text-left">
                    <div>Buy Unit</div>
                    <div className="text-[10px] font-normal text-gray-400 normal-case">click to switch</div>
                  </th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">
                    <div>Rate / unit</div>
                    <div className="text-[10px] font-normal text-gray-400 normal-case">{gstInclusive ? 'incl. GST' : 'excl. GST'}</div>
                  </th>
                  <th className="px-3 py-2.5 text-left">Tax Group</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-left">
                    <div>→ Stock Added</div>
                    <div className="text-[10px] font-normal text-gray-400 normal-case">sell units shown too</div>
                  </th>
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <LineRow
                    key={line._id}
                    line={line}
                    onChange={patch => updateLine(line._id, patch)}
                    onRemove={() => removeLine(line._id)}
                    showRemove={lines.length > 1}
                    gstInclusive={gstInclusive}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-dashed border-gray-100">
            <button
              onClick={addLine}
              className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Plus size={16} /> Add Another Product
            </button>
          </div>
        </div>

        {/* ── Bottom: Notes + Totals + Submit ── */}
        <div className="grid grid-cols-5 gap-5">

          {/* Notes */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Notes (optional)</label>
            <textarea
              rows={4}
              placeholder="Any additional remarks about this purchase…"
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* Totals + Submit */}
          <div className="col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bill Summary</p>
              {/* GST Inclusive / Exclusive toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setGstInclusive(false)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    !gstInclusive
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Excl. GST
                </button>
                <button
                  onClick={() => setGstInclusive(true)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    gstInclusive
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Incl. GST
                </button>
              </div>
            </div>

            {/* GST breakdown */}
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal (excl. GST)</span>
                <span className="font-semibold text-gray-900">{fmtCur(totals.subtotal)}</span>
              </div>

              {Object.values(totals.taxBuckets).map(bucket => (
                <div key={bucket.name} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">{bucket.name}</span>
                    <span className="text-sm font-bold text-amber-700">{fmtCur(bucket.total)}</span>
                  </div>
                  {(bucket.cgst > 0 || bucket.sgst > 0) && (
                    <div className="flex gap-3 text-xs text-amber-600">
                      {bucket.cgst > 0 && <span>CGST: {fmtCur(bucket.cgst)}</span>}
                      {bucket.sgst > 0 && <span>SGST: {fmtCur(bucket.sgst)}</span>}
                      {bucket.igst > 0 && <span>IGST: {fmtCur(bucket.igst)}</span>}
                      {bucket.cess > 0 && <span>Cess: {fmtCur(bucket.cess)}</span>}
                    </div>
                  )}
                </div>
              ))}

              {totals.gstTotal === 0 && (
                <div className="text-xs text-gray-400 text-center py-1">No tax applicable</div>
              )}

              <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">Grand Total (incl. GST)</span>
                <span className="text-xl font-black text-indigo-700">{fmtCur(totals.grandTotal)}</span>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving || validLineCount === 0}
              className="mt-5 w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all active:scale-[.98] flex items-center justify-center gap-2"
            >
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Recording…</>
                : <><ShoppingBag size={16} /> Record Purchase{validLineCount > 1 ? ` (${validLineCount} items)` : ''}</>
              }
            </button>

            {validLineCount === 0 && (
              <p className="mt-2 text-center text-xs text-gray-400">Add products above to enable submit</p>
            )}
          </div>
        </div>

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
                    <tr className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-4 py-3 text-left font-semibold">Ref #</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Product</th>
                      <th className="px-4 py-3 text-right font-semibold">Bought</th>
                      <th className="px-4 py-3 text-right font-semibold">Added to Stock</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold">Supplier / Invoice</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {histLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center">
                          <Loader2 size={22} className="animate-spin text-indigo-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">Loading…</p>
                        </td>
                      </tr>
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-14 text-center">
                          <ShoppingBag size={28} className="text-gray-200 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">No purchases recorded yet</p>
                        </td>
                      </tr>
                    ) : history.map((bp: any) => {
                      const factor = parseFloat(bp.purchaseFactor ?? 1)
                      const hasDual = factor > 1 && bp.purchaseUom !== bp.baseUom
                      const status: ConversionStatus = bp.conversionStatus ?? 'NOT_CONVERTED'
                      const nextStatus = CONVERSION_CYCLE[(CONVERSION_CYCLE.indexOf(status) + 1) % CONVERSION_CYCLE.length]
                      return (
                        <tr key={bp.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg"
                              title={bp.referenceNumber}>
                              {shortRef(bp.referenceNumber)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {bp.purchaseDate
                              ? new Date(bp.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : fmtDate(bp.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-800">{bp.product?.name}</p>
                            <p className="text-xs text-gray-400">{bp.product?.sku}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-bold text-blue-700">
                              {fmtNum(bp.purchaseQty)} <span className="font-normal text-blue-500">{bp.purchaseUom}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div>
                              <span className="text-sm font-bold text-emerald-700">
                                +{fmtNum(bp.baseQty)} <span className="font-normal text-emerald-500">{bp.baseUom}</span>
                              </span>
                              {hasDual && (
                                <p className="text-[10px] text-gray-400">
                                  ({fmtNum(bp.purchaseQty)} {bp.purchaseUom} × {fmtNum(factor)})
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-sm font-semibold text-gray-900">{fmtCur(bp.totalCost)}</p>
                            {bp.costPerUnit && (
                              <p className="text-[10px] text-gray-400">{fmtCur(bp.costPerUnit)}/{bp.purchaseUom}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-700">{bp.supplier || '—'}</p>
                            {bp.invoiceNumber && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <FileText size={9} /> {bp.invoiceNumber}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CONVERSION_STYLES[status]}`}>
                                {CONVERSION_LABELS[status]}
                              </span>
                              {status !== 'CONVERTED' && (
                                <button
                                  onClick={() => setConvertingBp(bp)}
                                  className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded-full transition-colors"
                                >
                                  <ArrowRightLeft size={9} /> Convert
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalHistPages > 1 && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-500">{histData?.totalElements ?? 0} total records</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHistPage(p => Math.max(0, p - 1))}
                      disabled={histPage === 0}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="text-xs font-medium text-gray-600">{histPage + 1} / {totalHistPages}</span>
                    <button
                      onClick={() => setHistPage(p => Math.min(totalHistPages - 1, p + 1))}
                      disabled={histPage >= totalHistPages - 1}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {convertingBp && (
        <ConvertModal
          bp={convertingBp}
          outletId={effectiveOutletId!}
          onClose={() => setConvertingBp(null)}
          onSuccess={() => {
            setConvertingBp(null)
            qc.invalidateQueries({ queryKey: ['bulk-purchases'] })
          }}
        />
      )}
    </div>
  )
}
