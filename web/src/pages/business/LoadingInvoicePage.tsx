import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ReceiptText, Calendar, ChevronDown, X, Search,
  Receipt, Building2, Send, FileText, Loader2, Trash2, Plus,
  Eye, Printer, Check,
} from 'lucide-react'
import { loadingRecordApi, invoiceApi, customerApi, taxGroupApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { format, addDays, subDays } from 'date-fns'
import toast from 'react-hot-toast'

const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden'

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }
function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = (iso.split('T')[0] ?? iso).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function startOf(unit: 'month' | 'year') {
  const r = new Date()
  if (unit === 'month') r.setDate(1)
  else { r.setMonth(0, 1) }
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfLastMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0); return d
}
function endOfLastMonth() {
  const d = new Date(); d.setDate(0); d.setHours(23, 59, 59, 999); return d
}

const PRESETS = [
  { label: 'Today',       from: () => fmtDate(new Date()),               to: () => fmtDate(new Date()) },
  { label: 'Yesterday',   from: () => fmtDate(subDays(new Date(), 1)),   to: () => fmtDate(subDays(new Date(), 1)) },
  { label: 'Last 7 Days', from: () => fmtDate(subDays(new Date(), 6)),   to: () => fmtDate(new Date()) },
  { label: 'Last 30 Days',from: () => fmtDate(subDays(new Date(), 29)),  to: () => fmtDate(new Date()) },
  { label: 'This Month',  from: () => fmtDate(startOf('month')),         to: () => fmtDate(new Date()) },
  { label: 'Last Month',  from: () => fmtDate(startOfLastMonth()),       to: () => fmtDate(endOfLastMonth()) },
  { label: 'This Year',   from: () => fmtDate(startOf('year')),          to: () => fmtDate(new Date()) },
]

// ── GstPicker ──────────────────────────────────────────────────────────────────

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

  const options = [{ label: 'No Tax / 0%', rate: 0 }, ...taxGroups.map((g: any) => {
    const r = Number(g.totalRate ?? g.rate ?? 0)
    return { label: `${g.name} / ${r}%`, rate: r }
  })]

  return (
    <>
      <button ref={ref} type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white tabular-nums">
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

// ── Invoice line item ─────────────────────────────────────────────────────────

interface InvLineItem {
  id: string
  productName: string
  lengthM: number
  meters: number
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRate: number
}

function calcLine(item: InvLineItem) {
  const base      = item.meters * item.unitPrice
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

// ── ConvertToInvoiceModal ─────────────────────────────────────────────────────

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
  const [customerSearch, setCustomerSearch] = useState(record.customerName ?? record.vendor ?? '')
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
  const [deliveryChallanNo, setDeliveryChallanNo] = useState(`DC-${String(record.id).padStart(4, '0')}`)
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

  useEffect(() => {
    const term = INV_PAYMENT_TERMS.find(t => t.value === paymentTerms)
    if (term && term.days !== null) {
      setDueDate(format(addDays(new Date(invoiceDate), term.days), 'yyyy-MM-dd'))
    }
  }, [paymentTerms, invoiceDate])

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
        poNumber:          poNumber || null,
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
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div className={`fixed inset-y-0 right-0 left-[220px] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <Receipt size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">Convert to Invoice</h2>
                <p className="text-xs text-gray-400 mt-0.5">DC-{String(record.id).padStart(4, '0')} · {record.pipeName} · {record.quantity} pipes</p>
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

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">

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

              <div className="bg-white rounded-xl shadow-md overflow-hidden">
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

                {items.map((item, idx) => {
                  const c = calcLine(item)
                  return (
                    <div key={item.id}
                      className={`grid items-center border-b border-gray-100 last:border-0 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'} hover:bg-violet-50/20`}
                      style={{ gridTemplateColumns: '2.5fr 90px 90px 120px 80px 80px 116px 36px' }}>
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
                      <div className="px-2 py-2.5">
                        <input type="number" min="0.01" step="0.01" value={item.meters || ''}
                          onChange={e => updateItem(item.id, { meters: parseFloat(e.target.value) || 0 })}
                          className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                      </div>
                      <div className="px-2 py-2.5">
                        <input type="number" min="1" step="1" value={item.quantity || ''}
                          onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                          className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                      </div>
                      <div className="px-2 py-2.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">₹</span>
                          <input type="number" min="0" step="0.01" value={item.unitPrice || ''}
                            onChange={e => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className={`w-full pl-5 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                        </div>
                      </div>
                      <div className="px-2 py-2.5">
                        <input type="number" min="0" max="100" step="0.5" value={item.discountPercent || ''}
                          onChange={e => updateItem(item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                          className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                      </div>
                      <div className="px-2 py-2.5">
                        <GstPicker value={item.taxRate} onChange={rate => updateItem(item.id, { taxRate: rate })} taxGroups={taxGroups} />
                      </div>
                      <div className="px-3 py-2.5 text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">{inr(c.total)}</p>
                        {c.disc > 0 && <p className="text-[10px] text-emerald-600 tabular-nums">−{inr(c.disc)} disc</p>}
                      </div>
                      <div className="pr-2 flex items-center justify-center">
                        <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {items.some(i => i.unitPrice > 0) && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex justify-end gap-8 text-sm">
                    <span className="text-gray-500">Subtotal: <span className="font-semibold text-gray-800 tabular-nums">{inr(lineTotals.subtotal)}</span></span>
                    {lineTotals.lineDisc > 0 && <span className="text-emerald-600">Discount: <span className="font-semibold tabular-nums">−{inr(lineTotals.lineDisc)}</span></span>}
                    <span className="text-gray-500">GST: <span className="font-semibold text-gray-800 tabular-nums">{inr(lineTotals.tax)}</span></span>
                  </div>
                )}

                <button type="button" onClick={addItem}
                  className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-violet-600 hover:bg-violet-50/50 transition-colors border-t border-dashed border-gray-200">
                  <Plus size={13} /> Add Line Item
                </button>
              </div>

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
                      {billDiscountPct > 0 && <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">−{inr(billDiscAmt)}</span>}
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
                      <span className="tabular-nums font-medium">{inr(lineTotals.subtotal)}</span>
                    </div>
                    {lineTotals.lineDisc > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Line Discounts</span>
                        <span className="tabular-nums font-medium">−{inr(lineTotals.lineDisc)}</span>
                      </div>
                    )}
                    {billDiscountPct > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Bill Discount ({billDiscountPct}%)</span>
                        <span className="tabular-nums font-medium">−{inr(billDiscAmt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>GST</span>
                      <span className="tabular-nums font-medium">{inr(lineTotals.tax)}</span>
                    </div>
                    {shippingAmount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Freight</span>
                        <span className="tabular-nums font-medium">{inr(shippingAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[15px] border-t border-gray-200 pt-3 mt-1 text-gray-900">
                      <span>Grand Total</span>
                      <span className="tabular-nums text-violet-700">{inr(roundedTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

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

          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400 tabular-nums">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {grandTotal > 0 ? ` · Total ${inr(roundedTotal)}` : ''}
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

// ── EditRecordModal ───────────────────────────────────────────────────────────

function EditRecordModal({ record, onClose, onSaved }: {
  record: any; onClose: () => void; onSaved: (updated: any) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    date:          typeof record.date === 'string' ? record.date.split('T')[0] : fmtDate(new Date()),
    pipeName:      record.pipeName      ?? '',
    quantity:      String(record.quantity ?? ''),
    vehicleNo:     record.vehicleNo     ?? '',
    driverName:    record.driverName    ?? '',
    driverContact: record.driverContact ?? '',
    vendor:        record.vendor        ?? '',
    customerName:  record.customerName  ?? '',
    siteAddress:   record.siteAddress   ?? '',
    customerPoNo:  record.customerPoNo  ?? '',
    pipeNo:        record.pipeNo        ?? '',
    notes:         record.notes         ?? '',
    transportRate: record.transportRate != null ? String(record.transportRate) : '',
    rateType:      record.rateType      ?? 'per_pipe',
  })
  const [saving, setSaving] = useState(false)

  function setField(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        ...record,
        date:          form.date ? new Date(form.date).toISOString() : record.date,
        pipeName:      form.pipeName,
        quantity:      parseInt(form.quantity) || record.quantity,
        vehicleNo:     form.vehicleNo     || null,
        driverName:    form.driverName    || null,
        driverContact: form.driverContact || null,
        vendor:        form.vendor        || null,
        customerName:  form.customerName  || null,
        siteAddress:   form.siteAddress   || null,
        customerPoNo:  form.customerPoNo  || null,
        pipeNo:        form.pipeNo        || null,
        notes:         form.notes         || null,
        transportRate: form.transportRate ? parseFloat(form.transportRate) : null,
        rateType:      form.rateType      || null,
      }
      const res = await loadingRecordApi.update(record.id, payload)
      queryClient.invalidateQueries({ queryKey: ['loading-records-invoice'] })
      onSaved(res.data.data)
      toast.success('Record updated')
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-gray-800 placeholder-gray-300'
  const lbl = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-600 to-teal-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <ReceiptText size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Edit Loading Record</h2>
              <p className="text-xs text-green-200 mt-0.5">DC-{String(record.id).padStart(4, '0')} · {record.pipeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
            <X size={14} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Date</label>
              <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Pipe Name</label>
              <input type="text" value={form.pipeName} onChange={e => setField('pipeName', e.target.value)} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Quantity (pipes)</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setField('quantity', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Vehicle No.</label>
              <input type="text" value={form.vehicleNo} onChange={e => setField('vehicleNo', e.target.value)} placeholder="MH12AB1234" className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Driver Name</label>
              <input type="text" value={form.driverName} onChange={e => setField('driverName', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Driver Contact</label>
              <input type="tel" value={form.driverContact} onChange={e => setField('driverContact', e.target.value)} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Customer / Vendor</label>
              <input type="text" value={form.vendor} onChange={e => setField('vendor', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Customer Name</label>
              <input type="text" value={form.customerName} onChange={e => setField('customerName', e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Site Address</label>
            <input type="text" value={form.siteAddress} onChange={e => setField('siteAddress', e.target.value)} placeholder="Delivery site address" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Challan No. (Customer PO)</label>
              <input type="text" value={form.customerPoNo} onChange={e => setField('customerPoNo', e.target.value)} placeholder="LOA/0615" className={inp} />
            </div>
            <div>
              <label className={lbl}>Pipe No.</label>
              <input type="text" value={form.pipeNo} onChange={e => setField('pipeNo', e.target.value)} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Transport Rate</label>
              <input type="number" min="0" step="0.01" value={form.transportRate} onChange={e => setField('transportRate', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Rate Type</label>
              <select value={form.rateType} onChange={e => setField('rateType', e.target.value)}
                className={inp + ' appearance-none cursor-pointer'}>
                <option value="per_pipe">Per Pipe</option>
                <option value="per_trip">Per Trip</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)}
              placeholder="Any additional notes…"
              className={inp + ' resize-none'} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DateFilterDropdown ────────────────────────────────────────────────────────

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
  const isCustom = !activePreset && !!(from || to)
  const label = activePreset ? activePreset.label : isCustom ? `${dmy(from)} – ${dmy(to)}` : 'All dates'

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
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-56">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Quick Range</p>
          <div className="space-y-0.5 mb-3">
            {PRESETS.map(p => {
              const active = from === p.from() && to === p.to()
              return (
                <button key={p.label} onClick={() => { onChange(p.from(), p.to()); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors font-medium ${
                    active ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'
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
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-700" />
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-700" />
              <div className="flex gap-2">
                <button onClick={() => { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }}
                  className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Clear
                </button>
                <button onClick={() => { if (tmpFrom && tmpTo) { onChange(tmpFrom, tmpTo); setOpen(false) } }} disabled={!tmpFrom || !tmpTo}
                  className="flex-1 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-green-600 to-teal-600 rounded-xl hover:from-green-700 hover:to-teal-700 disabled:opacity-40 transition-all">
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LoadingInvoicePage() {
  const navigate    = useNavigate()
  const { user, hasPermission } = useAuthStore()
  const outletId    = user?.outletId ?? 1
  const queryClient = useQueryClient()
  const canConvert  = hasPermission('CONVERT_LOADING_TO_INVOICE')

  const today = fmtDate(new Date())
  const [fromDate, setFromDate] = useState(fmtDate(subDays(new Date(), 29)))
  const [toDate,   setToDate]   = useState(today)
  const [search,   setSearch]   = useState('')

  const [editRecord,    setEditRecord]    = useState<any | null>(null)
  const [convertRecord, setConvertRecord] = useState<any | null>(null)

  const { data: recordsData, isLoading } = useQuery({
    queryKey: ['loading-records-invoice', fromDate, toDate],
    queryFn: () => loadingRecordApi.getAll({ from: fromDate || undefined, to: toDate || undefined })
      .then((r: any) => r.data.data ?? []),
    staleTime: 30_000,
  })

  const allRecords: any[] = recordsData ?? []
  const records = search.trim()
    ? allRecords.filter((r: any) =>
        (r.pipeName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.vehicleNo ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.customerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.vendor ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : allRecords

  function patchRecord(updated: any) {
    queryClient.setQueryData(['loading-records-invoice', fromDate, toDate], (old: any[] | undefined) =>
      (old ?? []).map((r: any) => r.id === updated.id ? { ...r, ...updated } : r)
    )
  }

  const invoiced = records.filter((r: any) => r.invoiceId).length
  const pending  = records.length - invoiced

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-teal-600 shadow-[0_8px_32px_rgba(22,163,74,0.25)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/business')}
              className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center hover:bg-white/25 transition-colors shrink-0"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <ReceiptText size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-200 uppercase tracking-widest mb-0.5">Business</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Loading + Invoice</h1>
              <p className="text-sm text-green-200 mt-0.5">View loaded pipe records and convert to invoices</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search pipe, vehicle, customer…"
                className="pl-8 pr-4 py-2.5 text-sm rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 w-64"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                  <X size={13} />
                </button>
              )}
            </div>
            <DateFilterDropdown
              from={fromDate} to={toDate}
              onChange={(f, t) => { setFromDate(f); setToDate(t) }}
            />
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/15 grid grid-cols-4 divide-x divide-white/15">
          {[
            { label: 'Total Records', value: records.length },
            { label: 'Invoiced',      value: invoiced },
            { label: 'Pending',       value: pending },
            { label: 'Pipes Loaded',  value: records.reduce((s: number, r: any) => s + (r.quantity ?? 0), 0) },
          ].map(s => (
            <div key={s.label} className="px-6 py-3">
              <p className="text-lg font-extrabold tabular-nums leading-none text-white">{s.value}</p>
              <p className="text-[10px] text-green-200 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
              <ReceiptText size={24} className="text-green-500" />
            </div>
            <p className="text-sm font-semibold text-gray-600">No loading records found</p>
            <p className="text-xs text-gray-400">
              {search ? `No records match "${search}"` : 'Try a different date range'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Date', 'Customer / Vendor', 'Pipe', 'Qty', 'Vehicle No', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((rec: any, idx: number) => (
                  <tr
                    key={rec.id}
                    onClick={() => setEditRecord(rec)}
                    className={`border-t border-gray-100 hover:bg-green-50/30 transition-colors cursor-pointer ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-medium tabular-nums">
                      {rec.date ? format(new Date(rec.date), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px]">
                      <p className="font-semibold truncate">{rec.customerName || rec.vendor || '—'}</p>
                      {rec.siteAddress && <p className="text-xs text-gray-400 truncate">{rec.siteAddress}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{rec.pipeName || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                        {rec.quantity ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{rec.vehicleNo || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {rec.invoiceId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                          <Receipt size={11} /> Invoiced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {rec.invoiceId ? (
                          <>
                            <a
                              href={`/invoice/${rec.invoiceNumber}`}
                              target="_blank" rel="noreferrer"
                              title="View Invoice"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-semibold transition-colors"
                            >
                              <Eye size={12} />
                              {rec.invoiceNumber}
                            </a>
                            <a
                              href={`/invoice/${rec.invoiceNumber}?print=1`}
                              target="_blank" rel="noreferrer"
                              title="Print Invoice"
                              className="w-7 h-7 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 flex items-center justify-center transition-colors"
                            >
                              <Printer size={13} className="text-teal-600" />
                            </a>
                          </>
                        ) : canConvert ? (
                          <button
                            onClick={() => setConvertRecord(rec)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 text-emerald-700 text-[11px] font-semibold transition-all active:scale-95 whitespace-nowrap"
                          >
                            <Receipt size={12} />
                            Convert to Invoice
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No permission</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-teal-200 bg-teal-50">
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wide">Total</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-extrabold text-teal-700 tabular-nums">
                      {records.reduce((s: number, r: any) => s + (r.quantity ?? 0), 0)}
                    </span>
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Record Modal ── */}
      {editRecord && (
        <EditRecordModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={updated => {
            patchRecord(updated)
            setEditRecord(null)
          }}
        />
      )}

      {/* ── Convert to Invoice Modal ── */}
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
    </div>
  )
}
