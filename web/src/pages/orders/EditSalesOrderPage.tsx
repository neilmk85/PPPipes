import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingBag, Loader2,
  User, FileText, Truck, ChevronDown, AlertCircle,
  Package, Tag, CalendarDays, Info, Save, Pipette, Layers, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { salesOrderApi, productApi, customerApi, pipeConfigApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItem {
  type: 'pipe' | 'product'
  pipeConfigId?: number
  pipeConfigName?: string
  diameterMm?: number
  pressureClass?: string
  productId?: number
  productName: string
  sku?: string
  unitPrice: number
  quantity: number
  discountPercent: number
  taxRate: number
  lineTotal: number
}

const PAYMENT_TERMS = ['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance', 'Custom']

function calcLine(item: Omit<LineItem, 'lineTotal'>): number {
  const disc = item.unitPrice * (item.discountPercent / 100)
  const base = (item.unitPrice - disc) * item.quantity
  return parseFloat((base + base * (item.taxRate / 100)).toFixed(2))
}

// ── Dark card header ──────────────────────────────────────────────────────────
function CardHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
        <Icon size={16} className="text-amber-400" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white leading-none">{title}</h3>
        {subtitle && <p className="text-xs text-blue-100 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Customer picker ───────────────────────────────────────────────────────────
function CustomerPicker({ value, onSelect, onClear }: { value: any; onSelect: (c: any) => void; onClear: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try { const r = await customerApi.search(query); setResults(r.data.data ?? []) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  if (value) return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {value.name?.[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{value.name}</p>
        <p className="text-xs text-gray-500">{value.phone} {value.gstin ? `· GSTIN: ${value.gstin}` : ''}</p>
      </div>
      <button onClick={onClear} className="text-gray-400 hover:text-red-500 shrink-0 text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Change</button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-amber-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-amber-100 transition-all">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          placeholder="Search customer by name or phone…"
          className="flex-1 text-sm bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none" />
        {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {results.length === 0 && !loading
            ? <p className="text-xs text-gray-400 text-center py-4">No customers found</p>
            : results.map((c: any) => (
              <button key={c.id} onMouseDown={() => { onSelect(c); setQuery(''); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs shrink-0">
                  {c.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.phone}</p>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

// ── Pipe Config Picker ────────────────────────────────────────────────────────
function PipeConfigPicker({ onAdd }: { onAdd: (pc: any) => void }) {
  const [allConfigs, setAllConfigs] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setLoading(true)
    pipeConfigApi.getAll({ active: true, size: 500 })
      .then(r => setAllConfigs(r.data.data?.content ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = allConfigs.filter(c => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return String(c.diameterMm).includes(q) || (c.pressureClass ?? '').toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q)
  })

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 hover:border-gray-300 focus-within:border-violet-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-100 transition-all">
        <Pipette size={15} className="text-gray-400 shrink-0" />
        <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          placeholder="Search pipe config by diameter or pressure class…"
          className="flex-1 text-sm bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none" />
        {loading ? <Loader2 size={14} className="animate-spin text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-auto">
          {filtered.length === 0
            ? <p className="text-xs text-gray-400 text-center py-4">No pipe configs found</p>
            : filtered.map((pc: any) => (
              <button key={pc.id} onMouseDown={() => { onAdd(pc); setQuery(''); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 text-left transition-colors border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Pipette size={14} className="text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{pc.diameterMm}mm · {pc.pressureClass}</p>
                  <p className="text-xs text-gray-400">{pc.name ?? `${pc.diameterMm}mm ${pc.pressureClass}`}</p>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

// ── Product search ────────────────────────────────────────────────────────────
function ProductSearch({ onAdd }: { onAdd: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try { const r = await productApi.search(query); setResults(r.data.data ?? []) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 bg-slate-50/40 hover:border-slate-400 focus-within:border-slate-500 focus-within:bg-white transition-all">
        <Search size={15} className="text-slate-400 shrink-0" />
        <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          placeholder="Search product by name or SKU…"
          className="flex-1 text-sm bg-transparent text-gray-700 placeholder-slate-400 focus:outline-none" />
        {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-auto">
          {results.map((p: any) => (
            <button key={p.id} onMouseDown={() => { onAdd(p); setQuery(''); inputRef.current?.focus() }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400">{p.sku}</p>
              </div>
              <span className="text-sm font-bold text-slate-700 ml-4">₹{parseFloat(p.sellingPrice).toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EditSalesOrderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { outletId } = useAuthStore()

  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t) }, [])

  const [customer, setCustomer] = useState<any>(null)
  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [requiredDate, setRequiredDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingAmount, setShippingAmount] = useState('0')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [notes, setNotes] = useState('')
  const [termsConditions, setTermsConditions] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [addMode, setAddMode] = useState<'pipe' | 'product'>('pipe')

  const { data: so, isLoading } = useQuery({
    queryKey: ['sales-order-edit', id],
    queryFn: () => salesOrderApi.getById(parseInt(id!)).then(r => r.data.data),
    enabled: !!id,
  })

  // Pre-fill from loaded SO
  useEffect(() => {
    if (!so || hydrated) return
    setCustomer(so.customer)
    setCustomerPoNumber(so.customerPoNumber ?? '')
    setOrderDate(so.orderDate?.split('T')[0] ?? '')
    setRequiredDate(so.requiredDate?.split('T')[0] ?? '')
    setPaymentTerms(so.paymentTerms ?? 'Net 30')
    setShippingAddress(so.shippingAddress ?? '')
    setShippingCity(so.shippingCity ?? '')
    setShippingState(so.shippingState ?? '')
    setShippingAmount(String(parseFloat(so.shippingAmount ?? '0')))
    setAdvanceAmount(String(parseFloat(so.advanceAmount ?? '0')))
    setNotes(so.notes ?? '')
    setTermsConditions(so.termsConditions ?? '')
    setItems(so.items.map((i: any) => {
      const isPipe = !!i.pipeConfigId
      const item: LineItem = {
        type: isPipe ? 'pipe' : 'product',
        pipeConfigId: i.pipeConfigId ?? undefined,
        pipeConfigName: i.pipeConfig ? `${i.pipeConfig.diameterMm}mm ${i.pipeConfig.pressureClass}` : undefined,
        diameterMm: i.pipeConfig?.diameterMm,
        pressureClass: i.pipeConfig?.pressureClass,
        productId: i.productId || undefined,
        productName: i.productName,
        sku: i.sku ?? undefined,
        unitPrice: parseFloat(i.unitPrice),
        quantity: parseFloat(i.quantity),
        discountPercent: parseFloat(i.discountPercent),
        taxRate: parseFloat(i.taxRate),
        lineTotal: parseFloat(i.lineTotal),
      }
      return item
    }))
    setHydrated(true)
  }, [so, hydrated])

  function addPipeConfig(pc: any) {
    setItems(prev => {
      const existing = prev.findIndex(i => i.type === 'pipe' && i.pipeConfigId === pc.id)
      if (existing >= 0) {
        const updated = [...prev]
        const item = { ...updated[existing], quantity: updated[existing].quantity + 1 }
        item.lineTotal = calcLine(item)
        updated[existing] = item
        return updated
      }
      const newItem: LineItem = {
        type: 'pipe',
        pipeConfigId: pc.id,
        pipeConfigName: pc.name ?? `${pc.diameterMm}mm ${pc.pressureClass}`,
        diameterMm: pc.diameterMm,
        pressureClass: pc.pressureClass,
        productName: pc.name ?? `${pc.diameterMm}mm ${pc.pressureClass}`,
        unitPrice: 0,
        quantity: 1,
        discountPercent: 0,
        taxRate: 18,
        lineTotal: 0,
      }
      return [...prev, newItem]
    })
  }

  function addProduct(p: any) {
    const taxRate = parseFloat(String(p.taxGroup?.totalRate ?? 0)) || 0
    const unitPrice = parseFloat(String(p.sellingPrice)) || 0
    setItems(prev => {
      const idx = prev.findIndex(i => i.type === 'product' && i.productId === p.id)
      if (idx >= 0) {
        const updated = [...prev]
        const item = { ...updated[idx], quantity: updated[idx].quantity + 1 }
        item.lineTotal = calcLine(item)
        updated[idx] = item
        return updated
      }
      const base: Omit<LineItem, 'lineTotal'> = {
        type: 'product', productId: p.id, productName: p.name, sku: p.sku,
        unitPrice, quantity: 1, discountPercent: 0, taxRate,
      }
      return [...prev, { ...base, lineTotal: calcLine(base) }]
    })
  }

  function updateItem(idx: number, field: keyof LineItem, val: number | string) {
    setItems(prev => {
      const updated = [...prev]
      const item = { ...updated[idx], [field]: val }
      item.lineTotal = calcLine(item as LineItem)
      updated[idx] = item
      return updated
    })
  }

  const subtotal    = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const discountAmt = items.reduce((s, i) => s + i.unitPrice * i.discountPercent / 100 * i.quantity, 0)
  const taxAmt      = items.reduce((s, i) => s + i.unitPrice * (1 - i.discountPercent / 100) * i.quantity * i.taxRate / 100, 0)
  const shipping    = parseFloat(shippingAmount) || 0
  const advance     = parseFloat(advanceAmount) || 0
  const total       = subtotal - discountAmt + taxAmt + shipping
  const balanceDue  = total - advance
  const pipeCount   = items.filter(i => i.type === 'pipe').length

  const creditWarning = customer?.creditLimit > 0
    ? total > (parseFloat(customer.creditLimit) - parseFloat(customer.outstandingDue))
    : false

  async function handleSave() {
    if (!customer) { toast.error('Please select a customer'); return }
    if (items.length === 0) { toast.error('Add at least one item'); return }
    if (creditWarning) { toast.error('Order exceeds customer credit limit'); return }
    setSaving(true)
    try {
      await salesOrderApi.update(parseInt(id!), {
        customerId: customer.id,
        customerPoNumber: customerPoNumber || undefined,
        orderDate: orderDate ? `${orderDate}T00:00:00Z` : undefined,
        requiredDate: requiredDate ? `${requiredDate}T00:00:00Z` : undefined,
        paymentTerms,
        shippingAddress: shippingAddress || undefined,
        shippingCity: shippingCity || undefined,
        shippingState: shippingState || undefined,
        shippingAmount: shipping,
        advanceAmount: advance,
        notes: notes || undefined,
        termsConditions: termsConditions || undefined,
        items: items.map(i => ({
          productId: i.productId ?? null,
          pipeConfigId: i.pipeConfigId,
          productName: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPercent: i.discountPercent,
          taxRate: i.taxRate,
        })),
      })
      toast.success('Sales Order updated!')
      navigate(`/sales-orders/${id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update sales order')
    } finally { setSaving(false) }
  }

  if (isLoading || !hydrated) return (
    <div className="flex items-center justify-center min-h-full">
      <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )

  if (so && so.status !== 'DRAFT') return (
    <div className="flex flex-col items-center justify-center min-h-full text-gray-400 gap-3">
      <ShoppingBag size={40} className="opacity-30" />
      <p className="font-medium text-gray-500">Only DRAFT orders can be edited</p>
      <button onClick={() => navigate(`/sales-orders/${id}`)}
        className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-violet-700 hover:to-blue-700">
        Back to Order
      </button>
    </div>
  )

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-slate-100/30 to-amber-50/20"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'all 280ms cubic-bezier(0.22,1,0.36,1)' }}>

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <button onClick={() => navigate(`/sales-orders/${id}`)}
          className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
            <ShoppingBag size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">
              Edit — <span className="font-mono text-violet-600">{so?.soNumber}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length === 0 ? 'Modify items and details below' : `${items.length} item${items.length > 1 ? 's' : ''} · ₹${total.toFixed(2)}`}
            </p>
          </div>
        </div>
        <div className="ml-4 flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-xs font-medium text-violet-700">Unsaved changes</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate(`/sales-orders/${id}`)}
            className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors text-gray-600">
            Discard
          </button>
          <button onClick={handleSave} disabled={saving || !customer || items.length === 0 || creditWarning}
            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-violet-200">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-5 gap-5">

        {/* ── Left col ── */}
        <div className="col-span-3 space-y-5">

          {/* Customer */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardHeader icon={User} title="Customer" />
            <div className="p-5 space-y-3">
              <CustomerPicker value={customer} onSelect={setCustomer} onClear={() => setCustomer(null)} />
              {creditWarning && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0" />
                  Order total exceeds available credit limit
                </div>
              )}
              <input value={customerPoNumber} onChange={e => setCustomerPoNumber(e.target.value)}
                placeholder="Customer PO Number (optional)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none" />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardHeader icon={Layers} title="Order Items" subtitle={`${pipeCount} pipe · ${items.length - pipeCount} product`} />
            <div className="p-5 space-y-4">

              {/* Mode toggle */}
              <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
                <button onClick={() => setAddMode('pipe')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${addMode === 'pipe' ? 'bg-white shadow-sm text-violet-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Pipette size={14} className={addMode === 'pipe' ? 'text-violet-500' : 'text-gray-400'} />
                  Pipe Item
                </button>
                <button onClick={() => setAddMode('product')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${addMode === 'product' ? 'bg-white shadow-sm text-slate-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Package size={14} className={addMode === 'product' ? 'text-slate-500' : 'text-gray-400'} />
                  Other Product
                </button>
              </div>

              {addMode === 'pipe' ? <PipeConfigPicker onAdd={addPipeConfig} /> : <ProductSearch onAdd={addProduct} />}

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                  <Layers size={32} className="mb-2 opacity-30" />
                  <p className="text-sm font-medium text-gray-500">No items</p>
                  <p className="text-xs text-gray-400 mt-1">Add pipe configs or products above</p>
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-bold">
                        <th className="px-4 py-2.5 text-left">Item</th>
                        <th className="px-3 py-2.5 text-center w-28">Qty</th>
                        <th className="px-3 py-2.5 text-right w-28">Unit Price (₹)</th>
                        <th className="px-3 py-2.5 text-center w-16">Disc%</th>
                        <th className="px-3 py-2.5 text-center w-16">Tax%</th>
                        <th className="px-3 py-2.5 text-right w-24">Total</th>
                        <th className="px-2 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-amber-50/20 transition-colors ${item.type === 'pipe' ? 'bg-amber-50/10' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {item.type === 'pipe'
                                ? <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center shrink-0"><Pipette size={11} className="text-amber-600" /></div>
                                : <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0"><Package size={11} className="text-slate-500" /></div>
                              }
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                                {item.type === 'pipe'
                                  ? <p className="text-xs text-amber-600 font-medium">{item.diameterMm}mm · {item.pressureClass}</p>
                                  : <p className="text-xs text-gray-400">{item.sku}</p>
                                }
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))}
                                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center transition-colors">
                                <Minus size={11} />
                              </button>
                              <input type="number" min={1} value={item.quantity}
                                onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-12 text-center text-sm border border-gray-200 rounded-lg py-0.5 focus:ring-1 focus:ring-amber-400 focus:outline-none" />
                              <button onClick={() => updateItem(idx, 'quantity', item.quantity + 1)}
                                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center transition-colors">
                                <Plus size={11} />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <input type="number" min={0} value={item.unitPrice}
                              onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full text-right text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-amber-400 focus:outline-none" />
                          </td>
                          <td className="px-3 py-3">
                            <input type="number" min={0} max={100} value={item.discountPercent}
                              onChange={e => updateItem(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                              className="w-full text-center text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-amber-400 focus:outline-none" />
                          </td>
                          <td className="px-3 py-3">
                            <input type="number" min={0} max={100} value={item.taxRate}
                              onChange={e => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                              className="w-full text-center text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-amber-400 focus:outline-none" />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-sm font-bold text-gray-900">₹{item.lineTotal.toFixed(2)}</span>
                          </td>
                          <td className="px-2 py-3">
                            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                              className="text-gray-300 hover:text-red-500 transition-colors">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-violet-50 border-t-2 border-violet-200">
                        <td colSpan={5} className="px-4 py-2.5 text-xs font-bold text-violet-700 uppercase tracking-wider">
                          {items.length} Item{items.length !== 1 ? 's' : ''} Total
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold text-gray-900">₹{total.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardHeader icon={FileText} title="Notes & Terms" />
            <div className="p-5 space-y-3">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Internal notes…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none resize-none" />
              <textarea value={termsConditions} onChange={e => setTermsConditions(e.target.value)} rows={2}
                placeholder="Terms & conditions…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none resize-none" />
            </div>
          </div>
        </div>

        {/* ── Right col ── */}
        <div className="col-span-2 space-y-4">

          {/* Order details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardHeader icon={CalendarDays} title="Order Details" />
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Order Date</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Required Delivery Date</label>
                <input type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Payment Terms</label>
                <div className="relative">
                  <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none appearance-none pr-8">
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardHeader icon={Truck} title="Shipping Details" />
            <div className="p-5 space-y-3">
              <textarea value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} rows={2}
                placeholder="Delivery address…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <input value={shippingCity} onChange={e => setShippingCity(e.target.value)} placeholder="City"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none" />
                <input value={shippingState} onChange={e => setShippingState(e.target.value)} placeholder="State"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Shipping Charges (₹)</label>
                <input type="number" min={0} value={shippingAmount} onChange={e => setShippingAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardHeader icon={Tag} title="Order Summary" />
            <div className="p-5 space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{discountAmt.toFixed(2)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>Tax (GST)</span><span>₹{taxAmt.toFixed(2)}</span></div>
              {shipping > 0 && <div className="flex justify-between text-gray-600"><span>Shipping</span><span>₹{shipping.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2.5 mt-1">
                <span>Total</span>
                <span className={creditWarning ? 'text-red-600' : 'text-gray-900'}>₹{total.toFixed(2)}</span>
              </div>
              <div className="border-t border-dashed border-gray-100 pt-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Advance Collected (₹)</label>
                  <input type="number" min={0} value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                    className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-amber-400 focus:outline-none" />
                </div>
                {advance > 0 && (
                  <div className="flex justify-between font-semibold text-sm">
                    <span className="text-gray-600">Balance Due</span>
                    <span className={balanceDue < 0 ? 'text-red-600' : 'text-amber-700'}>₹{balanceDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {customer?.creditLimit > 0 && (
                <div className={`text-xs rounded-xl px-3 py-2 flex items-start gap-1.5 ${creditWarning ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                  <Info size={12} className="mt-0.5 shrink-0" />
                  <span>Credit available: ₹{(parseFloat(customer.creditLimit) - parseFloat(customer.outstandingDue)).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Save button */}
          <button onClick={handleSave} disabled={saving || !customer || items.length === 0 || creditWarning}
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-200 hover:shadow-xl hover:-translate-y-0.5 text-sm">
            {saving
              ? <><Loader2 size={17} className="animate-spin" /> Saving…</>
              : <><Save size={17} /> Save Changes · ₹{total.toFixed(2)}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
