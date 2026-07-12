import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, Minus, ShoppingBag, Loader2,
  ChevronDown, AlertCircle, Package, Info, Pipette, X, CheckCircle2,
  MapPin, Home, Building2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { salesOrderApi, customerApi, pipeConfigApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItem {
  type: 'pipe' | 'product'
  // pipe fields
  pipeConfigId?: number
  pipeConfigName?: string
  diameterMm?: number
  pressureClass?: string
  lengthM?: number
  meters?: number
  // product fields
  productId?: number
  productName: string
  sku?: string
  // common
  unitPrice: number
  quantity: number
  discountPercent: number
  taxRate: number
  lineTotal: number
}

const PAYMENT_TERMS = ['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance', 'Custom']

interface SiteAddress { label: string; address: string; city: string; state: string; pincode: string }
function parseSiteAddresses(raw: any): SiteAddress[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

function calcLine(item: Omit<LineItem, 'lineTotal'>): number {
  const qty = item.type === 'pipe' ? (item.meters ?? 0) : item.quantity
  const disc = item.unitPrice * (item.discountPercent / 100)
  const base = (item.unitPrice - disc) * qty
  const tax  = base * (item.taxRate / 100)
  return parseFloat((base + tax).toFixed(2))
}

// ── Customer search widget ────────────────────────────────────────────────────
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
        {value.creditLimit > 0 && (
          <p className="text-xs text-amber-700 font-medium mt-0.5">
            Credit: ₹{parseFloat(value.creditLimit).toLocaleString('en-IN')} · Due: ₹{parseFloat(value.outstandingDue).toLocaleString('en-IN')}
          </p>
        )}
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
                  <p className="text-xs text-gray-400">{c.phone} {c.gstin ? `· ${c.gstin}` : ''}</p>
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
    return (
      String(c.diameterMm).includes(q) ||
      (c.pressureClass ?? '').toLowerCase().includes(q) ||
      (c.name ?? '').toLowerCase().includes(q)
    )
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
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-violet-50 text-left transition-colors border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Pipette size={14} className="text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {pc.diameterMm}mm · {pc.pressureClass}
                    </p>
                    <p className="text-xs text-gray-400">{pc.name ?? `${pc.diameterMm}mm ${pc.pressureClass}`}</p>
                  </div>
                </div>
                <div className="text-right">
                  {pc.pipeWeightKgPerM && (
                    <p className="text-xs text-gray-500">{pc.pipeWeightKgPerM} kg/m</p>
                  )}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}



// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreateSalesOrderPage() {
  const navigate = useNavigate()
  const { outletId } = useAuthStore()

  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t) }, [])

  // Form state
  const [customer, setCustomer] = useState<any>(null)
  const [selectedAddressKey, setSelectedAddressKey] = useState<string>('primary')
  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
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
  const [placing, setPlacing] = useState(false)

  // Auto-fill shipping from customer primary address when customer is selected/changed
  useEffect(() => {
    if (!customer) return
    setSelectedAddressKey('primary')
    setShippingAddress(customer.address || '')
    setShippingCity(customer.city || '')
    setShippingState(customer.state || '')
  }, [customer])

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
        lengthM: pc.lengthM ?? 5.25,
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
        type: 'product',
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        unitPrice,
        quantity: 1,
        discountPercent: 0,
        taxRate,
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

  function updateMeters(idx: number, meters: number) {
    setItems(prev => {
      const updated = [...prev]
      const lengthM = updated[idx].lengthM ?? 5.25
      const qty = meters > 0 ? Math.ceil(meters / lengthM) : 1
      const item = { ...updated[idx], meters, quantity: qty }
      item.lineTotal = calcLine(item as LineItem)
      updated[idx] = item
      return updated
    })
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const subtotal    = items.reduce((s, i) => { const q = i.type === 'pipe' ? (i.meters ?? 0) : i.quantity; return s + i.unitPrice * q }, 0)
  const discountAmt = items.reduce((s, i) => { const q = i.type === 'pipe' ? (i.meters ?? 0) : i.quantity; return s + i.unitPrice * i.discountPercent / 100 * q }, 0)
  const taxAmt      = items.reduce((s, i) => { const q = i.type === 'pipe' ? (i.meters ?? 0) : i.quantity; return s + (i.unitPrice * (1 - i.discountPercent / 100) * q * i.taxRate / 100) }, 0)
  const shipping    = parseFloat(shippingAmount) || 0
  const advance     = parseFloat(advanceAmount) || 0
  const total       = subtotal - discountAmt + taxAmt + shipping
  const roundedTotal = Math.round(total)
  const roundOff     = parseFloat((roundedTotal - total).toFixed(2))
  const balanceDue   = total - advance

  const creditWarning = customer?.creditLimit > 0
    ? total > (parseFloat(customer.creditLimit) - parseFloat(customer.outstandingDue))
    : false

  const pipeItemCount = items.filter(i => i.type === 'pipe').length

  async function handleSubmit() {
    if (!customer) { toast.error('Please select a customer'); return }
    if (items.length === 0) { toast.error('Add at least one item'); return }
    if (creditWarning) { toast.error('Order exceeds customer credit limit'); return }

    setPlacing(true)
    try {
      const effectiveOutletId = outletId ?? 1
      const res = await salesOrderApi.create({
        customerId: customer.id,
        outletId: effectiveOutletId,
        customerPoNumber: customerPoNumber || undefined,
        orderDate: orderDate ? `${orderDate}T00:00:00Z` : undefined,
        requiredDate: requiredDate ? `${requiredDate}T00:00:00Z` : undefined,
        paymentTerms,
        shippingAddress: shippingAddress || undefined,
        shippingCity: shippingCity || undefined,
        shippingState: shippingState || undefined,
        shippingAmount: parseFloat(shippingAmount) || 0,
        advanceAmount: parseFloat(advanceAmount) || 0,
        notes: notes || undefined,
        termsConditions: termsConditions || undefined,
        items: items.map(i => ({
          productId: i.productId ?? null,
          pipeConfigId: i.pipeConfigId,
          productName: i.productName,
          sku: i.sku,
          quantity: i.type === 'pipe' ? (i.meters ?? 0) : i.quantity,
          unitPrice: i.unitPrice,
          discountPercent: i.discountPercent,
          taxRate: i.taxRate,
        })),
      })
      toast.success(`${res.data.data?.soNumber} created!`)
      navigate(`/sales-orders/${res.data.data?.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create sales order')
    } finally { setPlacing(false) }
  }

  return (
    <div className="min-h-full bg-[#f8f9fb]"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', transition: 'all 280ms cubic-bezier(0.22,1,0.36,1)' }}>

      {/* ── Sticky top bar ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <button onClick={() => navigate('/sales-orders')}
          className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
            <ShoppingBag size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">New Sales Order</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length === 0
                ? 'Add customer & items to get started'
                : `${items.length} item${items.length > 1 ? 's' : ''} · ₹${total.toFixed(2)}`}
            </p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate('/sales-orders')}
            className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors text-gray-600">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={placing || !customer || items.length === 0 || creditWarning}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-200 transition-all hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2">
            {placing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Create Sales Order
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-6 grid grid-cols-12 gap-5">

        {/* ── Left col ── */}
        <div className="col-span-8 space-y-5">

          {/* ── From / To ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* From */}
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

            {/* Bill To */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bill To</p>
              {customer ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 font-bold text-sm">
                    {customer.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{customer.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{customer.phone}{customer.gstin ? ` · ${customer.gstin}` : ''}</p>
                    {customer.creditLimit > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-0.5">
                        Credit: ₹{parseFloat(customer.creditLimit).toLocaleString('en-IN')} · Due: ₹{parseFloat(customer.outstandingDue).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => { setCustomer(null); setSelectedAddressKey('primary'); setShippingAddress(''); setShippingCity(''); setShippingState('') }}
                    className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <CustomerPicker value={null} onSelect={setCustomer} onClear={() => {}} />
              )}
            </div>
          </div>

          {/* ── Order metadata bar ── */}
          <div className="bg-white rounded-xl shadow-md">
            <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: '1fr 1fr 1fr 1.4fr 1fr' }}>
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">SO Number</p>
                <p className="text-sm text-gray-400 italic">Auto-assigned</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Order Date</p>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                  className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Delivery Date</p>
                <input type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)}
                  className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Payment Terms</p>
                <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                  className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none appearance-none cursor-pointer">
                  {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Customer PO #</p>
                <input type="text" value={customerPoNumber} onChange={e => setCustomerPoNumber(e.target.value)} placeholder="PO-001"
                  className="w-full text-sm text-gray-800 placeholder-gray-300 border-0 bg-transparent p-0 focus:outline-none" />
              </div>
            </div>
          </div>

          {creditWarning && (
            <div className="flex items-center gap-2 bg-red-50 rounded-xl px-4 py-3 text-sm text-red-700 shadow-md">
              <AlertCircle size={15} className="shrink-0" />
              Order total exceeds available credit limit
            </div>
          )}

          {/* ── Line Items (search + table combined) ── */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {/* Search */}
            <div className="px-5 py-4 border-b border-gray-100">
              <PipeConfigPicker onAdd={addPipeConfig} />
            </div>

            {/* Table header */}
            <div className="grid text-[11px] font-bold text-gray-800 tracking-wide border-b border-blue-100"
              style={{ gridTemplateColumns: '2.5fr 100px 90px 120px 72px 110px 36px', background: 'linear-gradient(to right, #eff6ff, #eef2ff)' }}>
              <div className="px-5 py-3">Item</div>
              <div className="px-3 py-3 text-right">Meters (m)</div>
              <div className="px-3 py-3 text-right">Qty</div>
              <div className="px-3 py-3 text-right">Price / m (₹)</div>
              <div className="px-3 py-3 text-right">GST %</div>
              <div className="px-3 py-3 text-right">Net Amount</div>
              <div />
            </div>

            {/* Rows */}
            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No items yet — search a pipe config above to add</div>
            ) : items.map((item, idx) => (
              <div key={idx}
                className={`grid items-center border-b border-gray-100 last:border-0 hover:bg-violet-50/20 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'}`}
                style={{ gridTemplateColumns: '2.5fr 100px 90px 120px 72px 110px 36px' }}>

                {/* Item name */}
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {item.type === 'pipe'
                      ? <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center shrink-0"><Pipette size={11} className="text-amber-600" /></div>
                      : <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0"><Package size={11} className="text-slate-500" /></div>
                    }
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                      {item.type === 'pipe'
                        ? <p className="text-[11px] text-amber-600 font-medium mt-0.5">{item.diameterMm}mm · {item.pressureClass}</p>
                        : <p className="text-[11px] text-gray-400 mt-0.5">{item.sku}</p>
                      }
                      {item.type === 'pipe' && (item.meters ?? 0) > 0 && item.unitPrice > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                          {item.meters}m × ₹{item.unitPrice}/m · ≈ {item.quantity} pipe{item.quantity !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meters */}
                <div className="px-2 py-2.5">
                  {item.type === 'pipe' ? (
                    <input type="number" min={0} step={0.01} value={item.meters || ''} placeholder="e.g. 100"
                      onChange={e => updateMeters(idx, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                  ) : <span className="text-gray-300 text-xs text-right block pr-2">—</span>}
                </div>

                {/* Qty (derived for pipes, editable for products) */}
                <div className="px-2 py-2.5">
                  {item.type === 'pipe' ? (
                    <p className="text-sm text-gray-500 text-right pr-2 tabular-nums">{item.quantity}</p>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))}
                        className="w-5 h-5 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center transition-colors shrink-0">
                        <Minus size={9} />
                      </button>
                      <input type="number" min={1} value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-10 text-center text-sm border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                      <button onClick={() => updateItem(idx, 'quantity', item.quantity + 1)}
                        className="w-5 h-5 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center transition-colors shrink-0">
                        <Plus size={9} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Price/m */}
                <div className="px-2 py-2.5">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">₹</span>
                    <input type="number" min={0} value={item.unitPrice}
                      onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full pl-5 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                  </div>
                </div>

                {/* GST % */}
                <div className="px-2 py-2.5">
                  <input type="number" min={0} max={100} value={item.taxRate || ''}
                    onChange={e => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                </div>

                {/* Net Amount */}
                <div className="px-3 py-2.5 text-right">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">₹{item.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>

                {/* Delete */}
                <div className="pr-2 flex items-center justify-center">
                  <button onClick={() => removeItem(idx)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}

            {/* Subtotals footer */}
            {items.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex justify-end gap-8 text-sm">
                <span className="text-gray-500">Subtotal: <span className="font-semibold text-gray-800 tabular-nums">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                {discountAmt > 0 && <span className="text-emerald-600">Discount: <span className="font-semibold tabular-nums">−₹{discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>}
                {taxAmt > 0 && <span className="text-gray-500">GST: <span className="font-semibold text-gray-800 tabular-nums">₹{taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>}
              </div>
            )}
          </div>

          {/* ── Notes & Terms ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Internal notes or instructions…"
                className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms &amp; Conditions</label>
              <textarea value={termsConditions} onChange={e => setTermsConditions(e.target.value)} rows={3}
                placeholder="Terms & conditions (printed on order document)…"
                className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
            </div>
          </div>
        </div>

        {/* ── Right col ── */}
        <div className="col-span-4 space-y-4">

          {/* Shipping */}
          <div className="bg-white rounded-xl shadow-md p-5 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shipping Details</p>

            {customer && (() => {
              const sites = parseSiteAddresses((customer as any).siteAddresses)
              const hasPrimary = customer.address || customer.city || customer.state
              if (!hasPrimary && sites.length === 0) return null
              return (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                    <MapPin size={11} /> Pick from saved addresses
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hasPrimary && (
                      <button type="button"
                        onClick={() => { setSelectedAddressKey('primary'); setShippingAddress(customer.address || ''); setShippingCity(customer.city || ''); setShippingState(customer.state || '') }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedAddressKey === 'primary' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'}`}>
                        <Home size={11} /> Primary
                      </button>
                    )}
                    {sites.map((site, i) => (
                      <button key={i} type="button"
                        onClick={() => { setSelectedAddressKey(`site-${i}`); setShippingAddress(site.address || ''); setShippingCity(site.city || ''); setShippingState(site.state || '') }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedAddressKey === `site-${i}` ? 'bg-violet-600 text-white border-violet-600' : 'bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-400'}`}>
                        <Building2 size={11} /> {site.label || `Site ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            <textarea value={shippingAddress} onChange={e => { setShippingAddress(e.target.value); setSelectedAddressKey('custom') }} rows={2}
              placeholder="Delivery address…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={shippingCity} onChange={e => { setShippingCity(e.target.value); setSelectedAddressKey('custom') }} placeholder="City"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
              <input value={shippingState} onChange={e => { setShippingState(e.target.value); setSelectedAddressKey('custom') }} placeholder="State"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Shipping Charges (₹)</label>
              <input type="number" min={0} value={shippingAmount} onChange={e => setShippingAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-right" />
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Order Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="tabular-nums font-medium">−₹{discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {taxAmt > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>GST</span>
                  <span className="tabular-nums font-medium">₹{taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {shipping > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="tabular-nums font-medium">₹{shipping.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Round Off</span>
                  <span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[15px] border-t border-gray-200 pt-3 mt-1">
                <span className="text-gray-900">Grand Total</span>
                <span className={`tabular-nums ${creditWarning ? 'text-red-600' : 'text-violet-700'}`}>₹{roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {/* Advance */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Advance Collected (₹)</label>
                  <input type="number" min={0} value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                    className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                {advance > 0 && (
                  <div className="flex justify-between font-semibold text-sm">
                    <span className="text-gray-600">Balance Due</span>
                    <span className={`tabular-nums ${balanceDue < 0 ? 'text-red-600' : 'text-amber-700'}`}>₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              {customer?.creditLimit > 0 && (
                <div className={`text-xs rounded-lg px-3 py-2 flex items-start gap-1.5 ${creditWarning ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  <Info size={12} className="mt-0.5 shrink-0" />
                  <span>Credit available: ₹{(parseFloat(customer.creditLimit) - parseFloat(customer.outstandingDue)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pipe items callout */}
          {pipeItemCount > 0 && (
            <div className="bg-amber-50 rounded-xl shadow-md p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Pipette size={15} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">{pipeItemCount} Pipe Item{pipeItemCount !== 1 ? 's' : ''} Ready</p>
                  <p className="text-xs text-amber-600 mt-0.5">After creating, convert pipe items to Production Orders from the order detail page.</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={placing || !customer || items.length === 0 || creditWarning}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md text-sm">
            {placing
              ? <><Loader2 size={15} className="animate-spin" /> Creating…</>
              : <><ShoppingBag size={15} /> Create Sales Order · ₹{roundedTotal.toLocaleString('en-IN')}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
