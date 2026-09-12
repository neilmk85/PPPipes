import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Search, Package, FileText, Building2, Loader2, X,
  Calendar, ChevronDown, Truck, Receipt, Banknote, CreditCard,
  SplitSquareHorizontal, Pencil, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi, vendorApi, taxGroupApi, purchaseOrderApi, outletApi } from '@/services/api'
import { UOM_OPTIONS, ALL_UNITS } from '@/constants/units'
import { useAuthStore } from '@/store/authStore'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0'
  return '₹' + Math.round(v).toLocaleString('en-IN')
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

// ─── Product Picker ───────────────────────────────────────────────────────────
const NON_PURCHASABLE_NAMES = ['loose cement', 'extra cement']

function ProductPicker({ onSelect }: { onSelect: (p: any) => void }) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => { const t = setTimeout(() => setDq(q), 200); return () => clearTimeout(t) }, [q])

  const { data: rawResults = [], isFetching } = useQuery({
    queryKey: ['product-search-dpf', dq],
    queryFn: () => dq.trim() ? productApi.search(dq.trim(), { purchasable: true }).then(r => r.data.data ?? []) : Promise.resolve([]),
    enabled: dq.trim().length > 0,
  })

  const results = (rawResults as any[]).filter((p: any) =>
    p.purchasable !== false &&
    p.itemType !== 'FINISHED_PIPE' &&
    !NON_PURCHASABLE_NAMES.includes(p.name?.toLowerCase()) &&
    !p.name?.toLowerCase().startsWith('silo ')
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

// Sentinel: user explicitly chose 0% tax
const NO_TAX = { id: -1, name: 'No Tax', totalRate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cessRate: 0 }

// ─── GST Picker ───────────────────────────────────────────────────────────────
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
          <button onMouseDown={e => { e.preventDefault(); onChange(NO_TAX); setOpen(false) }}
            className={`w-full px-3 py-2.5 text-sm text-left border-b border-gray-100 ${value?.id === -1 || (value && Number(value.totalRate) === 0) ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}>
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

      <td className="px-3 py-3">
        <input
          type="number" min="0" step="any"
          value={line.qty}
          onChange={e => onChange({ qty: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          placeholder="0"
          className={`w-full text-right border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white ${NO_SPINNER}`}
        />
      </td>

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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DirectPurchaseFormPage() {
  const navigate = useNavigate()
  const { poNumber } = useParams<{ poNumber?: string }>()
  const isEdit = !!poNumber
  const qc = useQueryClient()
  const { outletId } = useAuthStore()

  // Fetch PO for edit mode
  const { data: editingPO, isLoading: loadingPO } = useQuery({
    queryKey: ['po-edit', poNumber],
    queryFn: () => purchaseOrderApi.getByPoNumber(poNumber!).then(r => r.data.data),
    enabled: isEdit,
  })

  // Outlets
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(outletId)
  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })
  useEffect(() => {
    if (selectedOutletId || (outlets as any[]).length === 0) return
    const main = (outlets as any[]).find((o: any) => o.name.toLowerCase().includes('main store')) ?? (outlets as any[])[0]
    if (main) setSelectedOutletId((main as any).id)
  }, [outlets])

  // Supplier dropdown
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
            <button key={s.id} onMouseDown={e => { e.preventDefault(); setSupplierId(s.id); setSupplierOpen(false); setSupplierSearch(''); markDirty() }}
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
  const [gstInclusive, setGstInclusive] = useState(true)
  const [paymentMode, setPaymentMode] = useState<'cash' | 'credit' | 'partial'>('cash')
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [paidAmount, setPaidAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const dpfDataLoadedRef = useRef(false)
  const markDirty = () => setIsDirty(true)
  const { isBlocked: dpfIsBlocked, confirmLeave: dpfConfirmLeave, cancelLeave: dpfCancelLeave } = useUnsavedChanges(isDirty)

  // Populate form when editing PO loads
  useEffect(() => {
    if (!editingPO) return
    setSupplierId(editingPO.supplierId ?? null)
    setInvoiceNo(editingPO.sourceBills?.[0]?.vendorBillNumber ?? '')
    const dateStr = editingPO.receivedDate
      ? new Date(editingPO.receivedDate).toISOString().slice(0, 10)
      : new Date(editingPO.createdAt).toISOString().slice(0, 10)
    setPurchaseDate(dateStr)
    setNotes(editingPO.notes ?? '')
    setGstInclusive(true)
    setPaymentMode('cash')
    setPaymentMethod('CASH')
    setPaidAmount('')
    const prefilledLines: LineItem[] = (editingPO.items ?? []).map((item: any) => ({
      _id: _lineId++,
      product: item.product ?? { id: item.productId, name: `Product #${item.productId}`, sku: '', unitOfMeasure: '' },
      qty: parseFloat(item.receivedQuantity || item.orderedQuantity) || '',
      unitCost: parseFloat(item.unitCost) || '',
      taxRate: parseFloat(item.taxRate) || '',
      taxGroupOverride: null,
      uom: item.product?.unitOfMeasure ?? '',
    }))
    setLines(prefilledLines.length > 0 ? prefilledLines : [newLine()])
    requestAnimationFrame(() => { dpfDataLoadedRef.current = true })
  }, [editingPO])

  function updateLine(id: number, patch: Partial<LineItem>) {
    setLines(prev => prev.map(l => l._id === id ? { ...l, ...patch } : l))
    if (!isEdit || dpfDataLoadedRef.current) markDirty()
  }
  function removeLine(id: number) {
    setLines(prev => prev.length > 1 ? prev.filter(l => l._id !== id) : [newLine()])
    if (!isEdit || dpfDataLoadedRef.current) markDirty()
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
  const effectiveOutletId = selectedOutletId

  async function handleSubmit() {
    if (validLines.length === 0) { toast.error('Add at least one product with a quantity'); return }
    if (!effectiveOutletId)       { toast.error('Please select an outlet'); return }
    if (!supplierId)              { toast.error('Please select a supplier'); return }

    setSaving(true)
    try {
      const itemsPayload = validLines.map(l => {
        const taxGroup = l.taxGroupOverride ?? l.product?.taxGroup
        return {
          productId: l.product.id,
          quantity:  parseFloat(String(l.qty)),
          unitCost:  parseFloat(String(l.unitCost)) || 0,
          taxRate:   parseFloat(taxGroup?.totalRate ?? l.taxRate ?? 0),
        }
      })

      if (editingPO) {
        await purchaseOrderApi.updateDirect(editingPO.id, {
          supplierId,
          purchaseDate,
          notes: notes || null,
          items: itemsPayload,
        })
        toast.success(`Purchase updated — PO# ${editingPO.poNumber}`)
      } else {
        const payload: any = {
          outletId:      effectiveOutletId,
          supplierId,
          invoiceNumber: invoiceNo || null,
          purchaseDate,
          notes:         notes || null,
          paymentMode,
          paymentMethod: paymentMode !== 'credit' ? paymentMethod : undefined,
          items: itemsPayload,
        }
        if (paymentMode === 'partial' && paidAmount) {
          payload.paidAmount = parseFloat(paidAmount) || 0
        }
        const res = await purchaseOrderApi.createDirect(payload)
        const data = res.data.data
        const modeLabel = paymentMode === 'credit' ? ' · Bill created (unpaid)' : paymentMode === 'partial' ? ' · Bill created (partial)' : ''
        toast.success(`Purchase recorded! PO# ${data.poNumber}${modeLabel}`)
      }

      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      navigate('/purchases/direct')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && loadingPO) {
    return (
      <div className="min-h-full bg-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-white flex flex-col">

      {/* ── Page Header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/purchases/direct')}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <Package size={17} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Purchases · Direct Purchase
              </p>
              <h1 className="text-[15px] font-bold text-gray-900 leading-none mt-0.5">
                {editingPO ? `Edit Purchase — ${editingPO.poNumber}` : 'Add Direct Purchase'}
              </h1>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {editingPO ? 'Inventory will be adjusted on save' : 'PO number assigned on save'}
        </p>
      </div>

      {/* ── Scrollable Form Body ── */}
      <div className="flex-1">
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

          {/* ── Purchase Details ── */}
          <div className="bg-white rounded-2xl border border-violet-100 shadow-[0_4px_24px_rgba(109,40,217,0.10)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Purchase Details</p>
            </div>
            <div className="p-6">

              {/* Outlet — only if multiple outlets */}
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

              {/* Payment Mode — new purchases only */}
              {!editingPO && (
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
                      <button key={key} type="button" onClick={() => { setPaymentMode(key); markDirty() }}
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
                        value={paidAmount} onChange={e => { setPaidAmount(e.target.value); markDirty() }}
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
                  {paymentMode !== 'credit' && (
                    <div className="mt-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                        Payment Method
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {([
                          { key: 'CASH',          label: 'Cash' },
                          { key: 'UPI',           label: 'UPI' },
                          { key: 'CHEQUE',        label: 'Cheque' },
                          { key: 'BANK_TRANSFER', label: 'Bank Transfer' },
                        ] as const).map(({ key, label }) => (
                          <button key={key} type="button" onClick={() => { setPaymentMethod(key); markDirty() }}
                            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                              paymentMethod === key
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={`grid gap-6 ${editingPO ? 'grid-cols-2' : 'grid-cols-3'}`}>
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
                        ? <button onMouseDown={e => { e.stopPropagation(); setSupplierId(null); markDirty() }}><X size={13} className="text-gray-400 hover:text-red-400" /></button>
                        : <Search size={13} className="text-gray-400 shrink-0" />
                      }
                    </button>
                    {supplierDropdown}
                  </div>
                </div>

                {/* Invoice Number — new purchases only */}
                {!editingPO && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                      <FileText size={12} /> Invoice / Bill No.
                    </label>
                    <input
                      type="text" placeholder="e.g. BILL-2024-001"
                      value={invoiceNo} onChange={e => { setInvoiceNo(e.target.value); markDirty() }}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                )}

                {/* Purchase Date */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                    <Calendar size={12} /> Purchase Date
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => { setPurchaseDate(e.target.value); markDirty() }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Line Items ── */}
          <div className="bg-white rounded-2xl border border-violet-100 shadow-[0_4px_24px_rgba(109,40,217,0.10)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3.5">
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
                  <tr className="bg-gray-100 border-y border-gray-200">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-900 uppercase tracking-widest">Product</th>
                    <th className="px-3 py-3 text-right text-[11px] font-bold text-gray-900 uppercase tracking-widest">Qty</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-900 uppercase tracking-widest">Unit</th>
                    <th className="px-3 py-3 text-right text-[11px] font-bold text-gray-900 uppercase tracking-widest">
                      <div>Unit Cost</div>
                      <div className="text-[10px] font-normal text-gray-500 normal-case">{gstInclusive ? 'incl. GST' : 'excl. GST'}</div>
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-900 uppercase tracking-widest">GST</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-900 uppercase tracking-widest">Amount</th>
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
                onClick={() => { setLines(prev => [...prev, newLine()]); markDirty() }}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <Plus size={16} /> Add Another Product
              </button>
            </div>
          </div>

          {/* ── Notes + Bill Summary ── */}
          <div className="grid grid-cols-5 gap-6">
            <div className="col-span-2 bg-white rounded-2xl border border-violet-100 shadow-[0_4px_24px_rgba(109,40,217,0.10)] overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-3.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Notes (optional)</p>
              </div>
              <div className="p-6">
                <textarea
                  rows={5}
                  placeholder="Any additional remarks…"
                  value={notes} onChange={e => { setNotes(e.target.value); markDirty() }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            <div className="col-span-3 bg-white rounded-2xl border border-violet-100 shadow-[0_4px_24px_rgba(109,40,217,0.10)] overflow-hidden flex flex-col">
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-3.5 flex items-center justify-between shrink-0">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Bill Summary</p>
                <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-0.5">
                  <button
                    onClick={() => { setGstInclusive(false); markDirty() }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!gstInclusive ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >Excl. GST</button>
                  <button
                    onClick={() => { setGstInclusive(true); markDirty() }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${gstInclusive ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >Incl. GST</button>
                </div>
              </div>
              <div className="p-6 flex flex-col flex-1">
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
      </div>

      {/* ── Sticky Footer ── */}
      <div className="sticky bottom-0 z-10 px-8 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {validLines.length} item{validLines.length !== 1 ? 's' : ''}
          {totals.roundedTotal > 0 ? ` · ₹${totals.roundedTotal.toLocaleString('en-IN')}` : ''}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/purchases/direct')}
            disabled={saving}
            className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || validLines.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-[.98]"
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> {editingPO ? 'Updating…' : 'Recording…'}</>
              : editingPO
                ? <><Pencil size={15} /> Update Purchase</>
                : <><Receipt size={15} /> Record Purchase{validLines.length > 1 ? ` (${validLines.length} items)` : ''}</>
            }
          </button>
        </div>
      </div>
      <UnsavedChangesDialog open={dpfIsBlocked} onConfirm={dpfConfirmLeave} onCancel={dpfCancelLeave} />
    </div>
  )
}
