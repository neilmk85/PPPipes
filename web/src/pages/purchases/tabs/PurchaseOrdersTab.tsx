import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Search, ShoppingBag, Loader2, Eye, CheckCircle, Send,
  X, Package, Trash2, Tag, Building2, Truck, Calendar, FileText,
  Mail, Printer, FileDown, PackageCheck, RotateCcw, Ban, Receipt,
  CheckSquare, Square, Pencil,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchaseOrderApi, purchaseBillApi, outletApi, vendorApi, productApi, taxGroupApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0.00'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-100 text-blue-600',
  PARTIAL:   'bg-yellow-100 text-yellow-700',
  RECEIVED:  'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

// ─── Line item types ───────────────────────────────────────────────────────────
let _lid = 1
function newLine(isCustom = false): POLine {
  return { _id: _lid++, isCustom, product: null, description: '', qty: '', unitCost: '', taxRate: '', taxGroupOverride: null }
}
interface POLine {
  _id: number
  isCustom: boolean
  product: any | null
  description: string
  qty: number | ''
  unitCost: number | ''
  taxRate: number | ''
  taxGroupOverride: any | null
}
function lineCalc(line: POLine) {
  const qty      = parseFloat(String(line.qty)) || 0
  const unitCost = parseFloat(String(line.unitCost)) || 0
  let rate: number
  if (line.isCustom) {
    rate = parseFloat(String(line.taxRate)) || 0
  } else {
    const tg = line.taxGroupOverride ?? line.product?.taxGroup
    rate = parseFloat(tg?.totalRate ?? 0)
  }
  const subtotal = qty * unitCost
  const tax      = subtotal * rate / 100
  return { qty, unitCost, subtotal, tax, lineTotal: subtotal + tax, rate }
}

// ─── Product Picker ────────────────────────────────────────────────────────────
function ProductPicker({ onSelect }: { onSelect: (p: any) => void }) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => { const t = setTimeout(() => setDq(q), 200); return () => clearTimeout(t) }, [q])

  // Names that are internal inventory states — never purchased from vendors
  const NON_PURCHASABLE_NAMES = ['silo cement', 'loose cement', 'extra cement']

  const { data: rawResults = [], isFetching } = useQuery({
    queryKey: ['product-search-po', dq],
    queryFn: () => dq.trim() ? productApi.search(dq.trim()).then(r => r.data.data ?? []) : Promise.resolve([]),
    enabled: dq.trim().length > 0,
  })

  const results = (() => {
    const filtered = (rawResults as any[]).filter((p: any) =>
      p.purchasable !== false &&
      !NON_PURCHASABLE_NAMES.includes(p.name?.toLowerCase())
    )
    const expanded: any[] = []
    filtered.forEach(p => {
      expanded.push(p)
      if ((p.name ?? '').includes('5.25m')) {
        expanded.push({ ...p, _synthetic: true, name: p.name.replace(/5\.25m/g, '6.5m'), sku: p.sku?.replace(/5\.25/g, '6.5') ?? p.sku, lengthM: 6.5 })
      }
    })
    return expanded
  })()

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  function updatePos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos) }
  }, [open])

  const showResults = open && q.trim() && (results as any[]).length > 0
  const showEmpty   = open && q.trim() && !isFetching && (results as any[]).length === 0 && dq === q

  const dropdown = pos && (showResults || showEmpty) ? createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}>
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        {showResults && (results as any[]).slice(0, 10).map((p: any) => (
          <button key={p.id}
            onMouseDown={e => { e.preventDefault(); onSelect(p); setQ(''); setOpen(false) }}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 text-left border-b border-gray-50 last:border-0">
            <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
              <Package size={10} className="text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
              <p className="text-[10px] text-gray-400">{p.sku} · {p.unitOfMeasure}</p>
            </div>
            {p.costPrice != null && <span className="text-xs font-bold text-indigo-600 shrink-0">{fmtCur(p.costPrice)}</span>}
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
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input ref={inputRef} value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search product…"
          className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50" />
        {isFetching && <Loader2 size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-indigo-400" />}
      </div>
      {dropdown}
    </div>
  )
}

// ─── Tax Group Picker ──────────────────────────────────────────────────────────
function TaxGroupPicker({ value, onChange }: { value: any; onChange: (tg: any | null) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
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
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos) }
  }, [open])

  const filtered = (groups as any[]).filter((g: any) => !q || g.name.toLowerCase().includes(q.toLowerCase()))

  const dropdown = open && pos ? createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}>
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-2 pt-2 pb-1">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search tax…"
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300" />
        </div>
        <div className="max-h-44 overflow-y-auto">
          <button onMouseDown={e => { e.preventDefault(); onChange(null); setOpen(false) }}
            className="w-full px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 text-left border-b border-gray-50">
            No Tax (0%)
          </button>
          {filtered.map((g: any) => (
            <button key={g.id} onMouseDown={e => { e.preventDefault(); onChange(g); setOpen(false) }}
              className={`w-full px-3 py-2 text-left hover:bg-indigo-50 border-b border-gray-50 last:border-0 ${value?.id === g.id ? 'bg-indigo-50' : ''}`}>
              <p className="text-xs font-semibold text-gray-800">{g.name}</p>
              <p className="text-[10px] text-gray-400">{g.totalRate}%</p>
            </button>
          ))}
        </div>
      </div>
    </div>, document.body
  ) : null

  return (
    <div ref={ref}>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:border-indigo-300 text-left">
        <span className="text-xs font-semibold text-gray-700 truncate">
          {value ? `${value.name} (${value.totalRate}%)` : 'No Tax'}
        </span>
        <Tag size={10} className="text-gray-400 shrink-0" />
      </button>
      {dropdown}
    </div>
  )
}

// ─── PO Form Drawer (create + edit) ───────────────────────────────────────────
function POFormDrawer({ onClose, outletId: defaultOutletId, editPo }: {
  onClose: () => void
  outletId: number | null
  editPo?: any
}) {
  const qc = useQueryClient()
  const isEdit = !!editPo

  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(defaultOutletId)

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })
  useEffect(() => {
    if (selectedOutletId || (outlets as any[]).length === 0) return
    const main = (outlets as any[]).find((o: any) => o.name.toLowerCase().includes('main store')) ?? (outlets as any[])[0]
    if (main) setSelectedOutletId((main as any).id)
  }, [outlets])

  // Supplier
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierOpen, setSupplierOpen] = useState(false)
  const supplierRef = useRef<HTMLDivElement>(null)
  const supplierBtnRef = useRef<HTMLButtonElement>(null)
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
      setSupplierPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 240) })
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
    <div style={{ position: 'fixed', top: supplierPos.top, left: supplierPos.left, width: supplierPos.width, zIndex: 99999 }}>
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-2 pt-2 pb-1">
          <input autoFocus value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
            placeholder="Search supplier…"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300" />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filteredSuppliers.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No suppliers found</p>}
          {filteredSuppliers.map((s: any) => (
            <button key={s.id} onMouseDown={e => { e.preventDefault(); setSupplierId(s.id); setSupplierOpen(false); setSupplierSearch('') }}
              className={`w-full px-3 py-2.5 text-left hover:bg-indigo-50 border-b border-gray-50 last:border-0 ${supplierId === s.id ? 'bg-indigo-50' : ''}`}>
              <p className="text-sm font-semibold text-gray-800">{s.name}</p>
              {s.phone && <p className="text-[10px] text-gray-400">{s.phone}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>, document.body
  ) : null

  // Form state
  const [lines, setLines] = useState<POLine[]>([newLine()])
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [prePopulated, setPrePopulated] = useState(false)

  // Fetch full PO for edit pre-population
  const { data: fullEditPo } = useQuery({
    queryKey: ['po-detail', editPo?.poNumber],
    queryFn: () => purchaseOrderApi.getByPoNumber(editPo!.poNumber).then(r => r.data.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!fullEditPo || prePopulated) return
    setSupplierId(fullEditPo.supplier?.id ?? null)
    setExpectedDate(fullEditPo.expectedDate ?? '')
    setNotes(fullEditPo.notes ?? '')
    if (fullEditPo.items?.length > 0) {
      setLines(fullEditPo.items.map((item: any) => ({
        _id: _lid++,
        isCustom: !item.product && !!item.description,
        product: item.product,
        description: item.description ?? '',
        qty: parseFloat(item.orderedQuantity),
        unitCost: parseFloat(item.unitCost),
        taxRate: parseFloat(item.taxRate),
        taxGroupOverride: null,
      })))
    }
    setPrePopulated(true)
  }, [fullEditPo])

  function updateLine(id: number, patch: Partial<POLine>) {
    setLines(prev => prev.map(l => l._id === id ? { ...l, ...patch } : l))
  }
  function removeLine(id: number) {
    setLines(prev => prev.length > 1 ? prev.filter(l => l._id !== id) : [newLine()])
  }

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0
    lines.forEach(l => {
      const hasContent = l.isCustom ? l.description.trim() : l.product
      if (!hasContent) return
      const c = lineCalc(l); subtotal += c.subtotal; tax += c.tax
    })
    return { subtotal, tax, grand: subtotal + tax }
  }, [lines])

  const validLines = lines.filter(l =>
    (l.isCustom ? l.description.trim() : l.product) &&
    (parseFloat(String(l.qty)) || 0) > 0
  )

  const { mutate: submit, isPending: saving } = useMutation({
    mutationFn: (payload: any) =>
      isEdit ? purchaseOrderApi.update(editPo.id, payload) : purchaseOrderApi.create(payload),
    onSuccess: (res) => {
      const d = res.data.data
      toast.success(isEdit ? `PO updated! #${d.poNumber}` : `PO created! #${d.poNumber}`)
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      if (isEdit) qc.invalidateQueries({ queryKey: ['po-detail', editPo.poNumber] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? (isEdit ? 'Failed to update PO' : 'Failed to create PO')),
  })

  function handleSubmit() {
    if (!supplierId)          { toast.error('Please select a supplier'); return }
    if (!selectedOutletId)    { toast.error('Please select an outlet'); return }
    if (validLines.length === 0) { toast.error('Add at least one product with a quantity'); return }

    submit({
      outletId:     selectedOutletId,
      supplierId,
      expectedDate: expectedDate || null,
      notes:        notes || null,
      items: validLines.map(l => {
        if (l.isCustom) {
          return { description: l.description, qty: parseFloat(String(l.qty)), unitCost: parseFloat(String(l.unitCost)) || 0, taxRate: parseFloat(String(l.taxRate)) || 0 }
        }
        const tg = l.taxGroupOverride ?? l.product?.taxGroup
        return { productId: l.product.id, qty: parseFloat(String(l.qty)), unitCost: parseFloat(String(l.unitCost)) || 0, taxRate: parseFloat(tg?.totalRate ?? 0) }
      }),
    })
  }

  return createPortal(
    <div className="fixed top-0 bottom-0 right-0 z-[9000] flex" style={{ left: 220 }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full bg-white h-full flex flex-col shadow-2xl animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? `Edit PO: ${editPo.poNumber}` : 'New Purchase Order'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEdit ? 'Update supplier, items, and details' : 'Creates a DRAFT PO — no stock update'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* PO Details */}
          <div className="grid grid-cols-2 gap-4">
            {/* Outlet (only if >1) */}
            {(outlets as any[]).length > 1 && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                  <Building2 size={11} /> Outlet
                </label>
                <select value={selectedOutletId ?? ''}
                  onChange={e => setSelectedOutletId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {(outlets as any[]).map((o: any) => (
                    <option key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Supplier */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Truck size={11} /> Supplier <span className="text-red-400">*</span>
              </label>
              <div ref={supplierRef}>
                <button ref={supplierBtnRef} onClick={() => setSupplierOpen(o => !o)}
                  className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-colors ${selectedSupplier ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}>
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

            {/* Expected Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Calendar size={11} /> Expected Delivery
              </label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <FileText size={11} /> Notes
              </label>
              <input type="text" placeholder="Optional remarks…" value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Products</p>
            </div>
            <table className="w-full table-fixed">
              <colgroup>
                <col />{/* Product */}
                <col style={{ width: '80px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '28px' }} />
              </colgroup>
              <thead>
                <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Product / Description</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Qty</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Unit Cost</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">GST %</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const hasContent = line.isCustom ? line.description.trim() : line.product
                  const calc = hasContent ? lineCalc(line) : null
                  return (
                    <tr key={line._id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${line.isCustom ? 'bg-orange-50/30' : ''}`}>
                      <td className="px-3 py-2">
                        {line.isCustom ? (
                          <input
                            type="text"
                            value={line.description}
                            onChange={e => updateLine(line._id, { description: e.target.value })}
                            placeholder="Item description…"
                            className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                          />
                        ) : line.product ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                                <Package size={9} className="text-indigo-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-800 truncate">{line.product.name}</p>
                                <p className="text-[10px] text-gray-400">{line.product.sku}</p>
                              </div>
                              <button onClick={() => updateLine(line._id, { product: null, qty: '', unitCost: '', taxGroupOverride: null })}
                                className="text-gray-300 hover:text-red-400 shrink-0"><X size={11} /></button>
                            </div>
                            <input
                              type="text"
                              value={line.description}
                              onChange={e => updateLine(line._id, { description: e.target.value })}
                              placeholder="Description (optional)…"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-gray-50"
                            />
                          </div>
                        ) : (
                          <ProductPicker onSelect={p => updateLine(line._id, { product: p, unitCost: p.costPrice ?? '', taxGroupOverride: null })} />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="any" value={line.qty}
                          onChange={e => updateLine(line._id, { qty: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          placeholder="0"
                          className="w-full text-right border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">₹</span>
                          <input type="number" min="0" step="any" value={line.unitCost}
                            onChange={e => updateLine(line._id, { unitCost: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            placeholder="0.00"
                            className="w-full pl-4 pr-2 py-1 text-right text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {line.isCustom ? (
                          <div className="relative">
                            <input type="number" min="0" max="100" step="any" value={line.taxRate}
                              onChange={e => updateLine(line._id, { taxRate: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                              placeholder="0"
                              className="w-full pr-5 py-1.5 text-right text-xs border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                          </div>
                        ) : line.product ? (
                          <TaxGroupPicker value={line.taxGroupOverride ?? line.product?.taxGroup ?? null}
                            onChange={tg => updateLine(line._id, { taxGroupOverride: tg })} />
                        ) : <span className="text-xs text-gray-300 px-2">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calc && calc.qty > 0 && calc.unitCost > 0 ? (
                          <div>
                            <p className="text-xs font-bold text-gray-900">{fmtCur(calc.lineTotal)}</p>
                            {calc.tax > 0 && <p className="text-[10px] text-gray-400">+{fmtCur(calc.tax)} tax</p>}
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {lines.length > 1 && (
                          <button onClick={() => removeLine(line._id)} className="text-gray-300 hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-dashed border-gray-100 flex items-center gap-4">
              <button onClick={() => setLines(prev => [...prev, newLine(false)])}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                <Plus size={13} /> Add Product
              </button>
              <button onClick={() => setLines(prev => [...prev, newLine(true)])}
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-800">
                <Plus size={13} /> Add Custom Item
              </button>
            </div>
          </div>

          {/* Bill Summary */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Summary</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">{fmtCur(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax</span>
              <span className="font-semibold">{fmtCur(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-900">Total</span>
              <span className="text-indigo-700">{fmtCur(totals.grand)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || validLines.length === 0}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> {isEdit ? 'Updating…' : 'Creating…'}</>
              : <><FileText size={15} /> {isEdit ? 'Update PO' : 'Create PO'}</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── View PO Drawer ───────────────────────────────────────────────────────────
function ViewPODrawer({ po, onClose, onEdit }: { po: any; onClose: () => void; onEdit: () => void }) {
  const { data: fullPo, isLoading } = useQuery({
    queryKey: ['po-detail', po.poNumber],
    queryFn: () => purchaseOrderApi.getByPoNumber(po.poNumber).then(r => r.data.data),
  })

  const items: any[] = fullPo?.items ?? []

  return createPortal(
    <div className="fixed top-0 bottom-0 right-0 z-[9000] flex" style={{ left: 220 }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-white h-full flex flex-col shadow-2xl animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold font-mono text-gray-900">{po.poNumber}</h2>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {po.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Purchase Order Details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Meta */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Supplier</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{fullPo?.supplier?.name ?? po.supplier?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Expected Delivery</p>
                <p className="text-sm text-gray-700 mt-1">{fullPo?.expectedDate ?? po.expectedDate ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Created</p>
                <p className="text-sm text-gray-700 mt-1">{po.createdAt ? new Date(po.createdAt).toLocaleDateString('en-IN') : '—'}</p>
              </div>
            </div>

            {fullPo?.notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Notes</p>
                <p className="text-sm text-amber-900 mt-1">{fullPo.notes}</p>
              </div>
            )}

            {/* Items */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Items ({items.length})</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Product</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Qty</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Unit Cost</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Tax %</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No items on this PO</td></tr>
                  ) : items.map((item: any, i: number) => (
                    <tr key={item.id ?? i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">{item.product?.name ?? item.description ?? '—'}</p>
                        {item.product
                          ? <p className="text-[10px] text-gray-400">{item.product.sku} · {item.product.unitOfMeasure}</p>
                          : <p className="text-[10px] text-orange-400">Custom item</p>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{parseFloat(item.orderedQuantity)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{fmtCur(item.unitCost)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{parseFloat(item.taxRate)}%</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtCur(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal (excl. tax)</span>
                <span className="font-semibold">{fmtCur(fullPo?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-semibold">{fmtCur(fullPo?.taxAmount ?? 0)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-900">Grand Total</span>
                <span className="text-indigo-700">{fmtCur(fullPo?.totalAmount ?? po.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
            Close
          </button>
          {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
            <button onClick={onEdit}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
              <Pencil size={15} /> Edit PO
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Convert to Bill Modal ─────────────────────────────────────────────────────
function ConvertToBillModal({ pos, onClose, onDone }: {
  pos: any[]        // array of POs to convert
  onClose: () => void
  onDone: () => void
}) {
  const qc = useQueryClient()
  const [vendorBillNumber, setVendorBillNumber] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [supplyType, setSupplyType] = useState<'INTRA_STATE' | 'INTER_STATE'>('INTRA_STATE')
  const [vendorGstin, setVendorGstin] = useState(pos[0]?.supplier?.gstin ?? '')

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      for (const po of pos) {
        await purchaseBillApi.convertFromPO(po.id, {
          vendorBillNumber: vendorBillNumber || null,
          billDate,
          dueDate: dueDate || null,
          notes: notes || null,
          supplyType,
          vendorGstin: vendorGstin || null,
        })
      }
    },
    onSuccess: () => {
      toast.success(pos.length === 1 ? `Bill created for ${pos[0].poNumber}` : `${pos.length} bills created`)
      qc.invalidateQueries({ queryKey: ['purchase-bills'] })
      onDone()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to convert to bill'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Convert to Bill</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {pos.length === 1 ? pos[0].poNumber : `${pos.length} purchase orders`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {pos.length === 1 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Vendor</span>
                <span className="font-medium">{pos[0].supplier?.name}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-600">PO Amount</span>
                <span className="font-semibold text-blue-700">₹{Number(pos[0].totalAmount ?? 0).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Bill # <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={vendorBillNumber} onChange={e => setVendorBillNumber(e.target.value)}
              placeholder="e.g. INV-2026-001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supply Type</label>
            <div className="flex gap-2">
              {[
                { value: 'INTRA_STATE', label: 'Intra-State (CGST + SGST)' },
                { value: 'INTER_STATE', label: 'Inter-State (IGST)' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setSupplyType(opt.value as any)}
                  className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                    supplyType === opt.value
                      ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor GSTIN <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={vendorGstin} onChange={e => setVendorGstin(e.target.value)}
              placeholder="e.g. 27AAAAA0000A1Z5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none" />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => mutate()} disabled={isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
            {isPending ? 'Creating…' : 'Create Bill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Action Bar ───────────────────────────────────────────────────────────────
function ActionBar({ selected, orders, onClear, onDone, onConvertBill }: {
  selected: Set<number>
  orders: any[]
  onClear: () => void
  onDone: () => void
  onConvertBill: (pos: any[]) => void
}) {
  const qc = useQueryClient()
  const count = selected.size

  const { mutate: doStatus, isPending: statusBusy } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      purchaseOrderApi.updateStatus(id, status),
  })
  const { mutate: doDelete, isPending: deleteBusy } = useMutation({
    mutationFn: (id: number) => purchaseOrderApi.delete(id),
  })

  function bulkStatus(status: string, label: string) {
    const ids = Array.from(selected)
    let done = 0
    ids.forEach(id =>
      doStatus({ id, status }, {
        onSuccess: () => { done++; if (done === ids.length) { toast.success(`${ids.length} order(s) marked ${label}`); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); onDone() } },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Action failed'),
      })
    )
  }

  function bulkDelete() {
    if (!confirm(`Delete ${count} purchase order(s)? This cannot be undone.`)) return
    const ids = Array.from(selected)
    let done = 0
    ids.forEach(id =>
      doDelete(id, {
        onSuccess: () => { done++; if (done === ids.length) { toast.success(`${ids.length} order(s) deleted`); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); onDone() } },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
      })
    )
  }

  const busy = statusBusy || deleteBusy

  const btn = (icon: React.ReactNode, label: string, onClick: () => void, cls = 'text-gray-700 hover:text-indigo-700') =>
    <button onClick={onClick} disabled={busy} title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-white transition-colors disabled:opacity-40 ${cls}`}>
      {icon}{label}
    </button>

  function handleConvertToBill() {
    const selectedPos = orders.filter(o => selected.has(o.id))
    onConvertBill(selectedPos)
  }

  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl mb-3 flex-wrap">
      <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 mr-1 shrink-0">
        <CheckSquare size={14} />{count} selected
      </span>
      <div className="h-4 w-px bg-indigo-200 shrink-0" />

      {btn(<Mail size={13} />,        'Send Email',    () => toast('Send to email — coming soon'))}
      {btn(<Printer size={13} />,     'Print',         () => toast('Print — coming soon'))}
      {btn(<FileDown size={13} />,    'Export PDF',    () => toast('Export PDF — coming soon'))}

      <div className="h-4 w-px bg-indigo-200 shrink-0" />

      {btn(<PackageCheck size={13} />, 'Mark Received',   () => bulkStatus('RECEIVED',  'received'),   'text-green-700 hover:text-green-800')}
      {btn(<RotateCcw size={13} />,    'Mark Unreceived', () => bulkStatus('DRAFT',     'unreceived'), 'text-yellow-700 hover:text-yellow-800')}
      {btn(<Ban size={13} />,          'Cancel',          () => bulkStatus('CANCELLED', 'cancelled'),  'text-orange-700 hover:text-orange-800')}
      {btn(<Receipt size={13} />,      'Convert to Bill', handleConvertToBill,                         'text-blue-700 hover:text-blue-800')}

      <div className="h-4 w-px bg-indigo-200 shrink-0" />

      {btn(<Trash2 size={13} />, 'Delete', bulkDelete, 'text-red-700 hover:text-red-800')}

      <button onClick={onClear} className="ml-auto p-1 text-gray-400 hover:text-gray-600 shrink-0" title="Clear selection">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Main Tab ──────────────────────────────────────────────────────────────────
export default function PurchaseOrdersTab() {
  const { outletId } = useAuthStore()
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(outletId)
  const [search, setSearch] = useState('')
  const [showNewPO, setShowNewPO] = useState(false)
  const [page, setPage] = useState(0)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [viewPo, setViewPo] = useState<any | null>(null)
  const [editPo, setEditPo] = useState<any | null>(null)
  const [convertBillPos, setConvertBillPos] = useState<any[] | null>(null)

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })
  useEffect(() => {
    if (selectedOutletId || (outlets as any[]).length === 0) return
    const main = (outlets as any[]).find((o: any) => o.name.toLowerCase().includes('main store')) ?? (outlets as any[])[0]
    if (main) setSelectedOutletId((main as any).id)
  }, [outlets])

  const effectiveOutletId = selectedOutletId

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['purchase-orders', effectiveOutletId, page],
    queryFn: () => purchaseOrderApi.getByOutlet(effectiveOutletId!, { page, size: 20, isDirect: false }).then(r => r.data.data),
    enabled: !!effectiveOutletId,
  })

  const orders: any[] = ordersData?.content ?? []
  const totalPages: number = ordersData?.totalPages ?? 1

  const filtered = orders.filter((o: any) =>
    o.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const allChecked = filtered.length > 0 && filtered.every((o: any) => checkedIds.has(o.id))
  const someChecked = filtered.some((o: any) => checkedIds.has(o.id))

  function toggleAll() {
    if (allChecked) {
      setCheckedIds(prev => { const next = new Set(prev); filtered.forEach((o: any) => next.delete(o.id)); return next })
    } else {
      setCheckedIds(prev => { const next = new Set(prev); filtered.forEach((o: any) => next.add(o.id)); return next })
    }
  }
  function toggleOne(id: number) {
    setCheckedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function clearChecked() { setCheckedIds(new Set()) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div />
        <div className="flex items-center gap-3">
          {(outlets as any[]).length > 1 && (
            <select value={selectedOutletId ?? ''}
              onChange={e => { setSelectedOutletId(e.target.value ? Number(e.target.value) : null); setPage(0); clearChecked() }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {(outlets as any[]).map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowNewPO(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New PO
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by PO number or vendor…"
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {/* Action bar — shown when any row checked */}
      {checkedIds.size > 0 && (
        <ActionBar
          selected={checkedIds}
          orders={filtered}
          onClear={clearChecked}
          onDone={clearChecked}
          onConvertBill={pos => setConvertBillPos(pos)}
        />
      )}

      {!effectiveOutletId ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
          <p>Select an outlet to view purchase orders.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'No purchase orders match your search' : 'No purchase orders yet.'}</p>
          {!search && (
            <button onClick={() => setShowNewPO(true)}
              className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Plus size={14} /> Create your first PO
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                  <th className="px-4 py-3 w-8">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-primary-600 transition-colors">
                      {allChecked
                        ? <CheckSquare size={15} className="text-primary-600" />
                        : someChecked
                          ? <CheckSquare size={15} className="text-primary-400" />
                          : <Square size={15} />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">PO Number</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Vendor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Expected</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o: any) => {
                  const checked = checkedIds.has(o.id)
                  return (
                    <tr key={o.id} className={`hover:bg-gray-50 transition-colors ${checked ? 'bg-indigo-50/50' : ''}`}>
                      <td className="py-3 pr-3 w-8">
                        <button onClick={() => toggleOne(o.id)} className="text-gray-300 hover:text-primary-600 transition-colors">
                          {checked
                            ? <CheckSquare size={15} className="text-primary-600" />
                            : <Square size={15} />}
                        </button>
                      </td>
                      <td className="py-3 font-mono font-medium text-primary-700">{o.poNumber}</td>
                      <td className="py-3 text-gray-800">{o.supplier?.name ?? '—'}</td>
                      <td className="py-3 text-gray-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="py-3 text-gray-500">{o.expectedDate ?? '—'}</td>
                      <td className="py-3 text-right font-semibold">₹{Number(o.totalAmount ?? 0).toLocaleString()}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setViewPo(o)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="View">
                            <Eye size={15} />
                          </button>
                          {o.status !== 'CANCELLED' && (
                            <button onClick={() => setConvertBillPos([o])} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Convert to Bill">
                              <Receipt size={15} />
                            </button>
                          )}
                          {o.status !== 'CANCELLED' && o.status !== 'RECEIVED' && (
                            <button onClick={() => setEditPo(o)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit">
                              <Pencil size={15} />
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

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                ← Prev
              </button>
              <span className="text-gray-500">Page {page + 1} of {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {showNewPO && (
        <POFormDrawer outletId={effectiveOutletId} onClose={() => setShowNewPO(false)} />
      )}
      {editPo && (
        <POFormDrawer editPo={editPo} outletId={effectiveOutletId} onClose={() => setEditPo(null)} />
      )}
      {viewPo && (
        <ViewPODrawer po={viewPo} onClose={() => setViewPo(null)} onEdit={() => { setViewPo(null); setEditPo(viewPo) }} />
      )}
      {convertBillPos && (
        <ConvertToBillModal
          pos={convertBillPos}
          onClose={() => setConvertBillPos(null)}
          onDone={() => setConvertBillPos(null)}
        />
      )}
    </div>
  )
}
