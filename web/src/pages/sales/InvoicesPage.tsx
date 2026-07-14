import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Search, FileText, X, Loader2, ChevronLeft, ChevronRight,
  Trash2, IndianRupee, Calendar, CheckCircle, Send, Ban,
  CreditCard, Clock, Printer, ShoppingCart, Percent, Truck,
  Hash, Edit2, AlertTriangle, ChevronDown, Mail, Receipt, Building2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { invoiceApi, productApi, variantApi, discountApi, integrationApi, taxGroupApi, pipeConfigApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import CustomerSearchInput from '@/components/CustomerSearchInput'
import { DEFAULT_INVOICE_TEMPLATE, InvoiceTemplateConfig } from '@/pages/settings/SettingsPage'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-50 text-blue-700',
  PAID:      'bg-green-50 text-green-700',
  PARTIAL:   'bg-yellow-50 text-yellow-700',
  OVERDUE:   'bg-red-50 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const STATUS_TAB_ACTIVE: Record<string, string> = {
  ALL:       'bg-gray-800 text-white shadow-md',
  DRAFT:     'bg-gray-500 text-white shadow-md',
  SENT:      'bg-blue-600 text-white shadow-md',
  PAID:      'bg-emerald-600 text-white shadow-md',
  PARTIAL:   'bg-amber-500 text-white shadow-md',
  OVERDUE:   'bg-red-500 text-white shadow-md',
  CANCELLED: 'bg-gray-400 text-white shadow-md',
}
const STATUS_TABS = ['ALL', 'DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED']

const PIE_COLORS: Record<string, string> = {
  DRAFT: '#9ca3af', SENT: '#3b82f6', PAID: '#10b981',
  PARTIAL: '#f59e0b', OVERDUE: '#ef4444', CANCELLED: '#d1d5db',
}

// ─── Date helpers + presets (matches LoadingPage) ────────────────────────────

function _fmtD(d: Date) { return d.toISOString().split('T')[0] }
function _dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
function _subDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() - n); return r }
function _startOf(unit: 'month' | 'year') { const r = new Date(); if (unit === 'month') r.setDate(1); else r.setMonth(0, 1); r.setHours(0,0,0,0); return r }
function _startOfWeekSun() { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d }
function _startOfLastMonth() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); d.setHours(0,0,0,0); return d }
function _endOfLastMonth() { const d = new Date(); d.setDate(0); d.setHours(0,0,0,0); return d }

const DATE_PRESETS_INV = [
  { label: 'Today',        from: () => _fmtD(new Date()),                  to: () => _fmtD(new Date()) },
  { label: 'Yesterday',    from: () => _fmtD(_subDays(new Date(), 1)),     to: () => _fmtD(_subDays(new Date(), 1)) },
  { label: 'Last 7 Days',  from: () => _fmtD(_subDays(new Date(), 6)),     to: () => _fmtD(new Date()) },
  { label: 'Last 15 Days', from: () => _fmtD(_subDays(new Date(), 14)),    to: () => _fmtD(new Date()) },
  { label: 'Last 30 Days', from: () => _fmtD(_subDays(new Date(), 29)),    to: () => _fmtD(new Date()) },
  { label: 'This Week',    from: () => _fmtD(_startOfWeekSun()),           to: () => _fmtD(new Date()) },
  { label: 'This Month',   from: () => _fmtD(_startOf('month')),           to: () => _fmtD(new Date()) },
  { label: 'Last Month',   from: () => _fmtD(_startOfLastMonth()),         to: () => _fmtD(_endOfLastMonth()) },
  { label: 'This Year',    from: () => _fmtD(_startOf('year')),            to: () => _fmtD(new Date()) },
]

function InvDateFilterDropdown({ from, to, onChange }: {
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

  const activePreset = DATE_PRESETS_INV.find(p => from === p.from() && to === p.to())
  const isCustom     = !activePreset && !!(from || to)

  function applyPreset(p: typeof DATE_PRESETS_INV[number]) { onChange(p.from(), p.to()); setOpen(false) }
  function applyCustom() { if (tmpFrom && tmpTo) { onChange(tmpFrom, tmpTo); setOpen(false) } }
  function clearFilter() { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }

  const label = activePreset ? activePreset.label : isCustom ? `${_dmy(from)} – ${_dmy(to)}` : 'All Dates'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setTmpFrom(from); setTmpTo(to); setOpen(v => !v) }}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all active:scale-95 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/40"
      >
        <Calendar size={14} />
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-60">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Quick Range</p>
          <div className="space-y-0.5 mb-3">
            {DATE_PRESETS_INV.map(p => {
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
                <button onClick={clearFilter}
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

// ─── Line item type ────────────────────────────────────────────────────────────

// Extract pipe length from product name — "PCCP 600mm 10kg 6.5m" → 6.5, fallback 5.25
function pipeLength(name: string): number {
  const m = name.match(/(\d+\.?\d+)m$/)
  return m ? parseFloat(m[1]) : 5.25
}
const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden'

// ─── GST Picker (portal dropdown) ────────────────────────────────────────────

function GstPicker({ value, onChange, taxGroups }: {
  value: number; onChange: (rate: number) => void; taxGroups: any[]
}) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (btnRef.current && !btnRef.current.closest('[data-gst-picker]')?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 160) })
    }
    setOpen(v => !v)
  }

  function pick(rate: number) { onChange(rate); setOpen(false) }

  return (
    <div data-gst-picker="">
      <button ref={btnRef} type="button" onClick={toggle}
        className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white flex items-center justify-end gap-1">
        <span className="tabular-nums">{value > 0 ? value : '0'}%</span>
        <ChevronDown size={11} className={`text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && pos && createPortal(
        <div className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-2xl py-1 overflow-y-auto max-h-52"
          style={{ top: pos.top, left: pos.left, width: pos.width }}>
          <button type="button" onMouseDown={() => pick(0)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${value === 0 ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
            No Tax / 0%
          </button>
          {taxGroups.map((tg: any) => {
            const rate = Number(tg.totalRate ?? tg.rate ?? 0)
            return (
              <button key={tg.id} type="button" onMouseDown={() => pick(rate)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${value === rate ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                {tg.name ?? `${rate}%`} — {rate}%
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

interface LineItem {
  id: string
  productId: number | null
  productName: string
  productSku: string
  lengthM: number
  meters: number
  quantity: number             // derived: Math.ceil(meters / lengthM)
  unitPrice: number            // price per meter
  discountPercent: number
  taxRate: number
  autoDiscountLabel?: string
}

function calcLine(item: LineItem) {
  const base = item.meters * item.unitPrice
  const disc = base * (item.discountPercent / 100)
  const afterDisc = base - disc
  const tax = afterDisc * (item.taxRate / 100)
  return { base, disc, tax, total: afterDisc + tax }
}

// ─── Product search dropdown ───────────────────────────────────────────────────

function ProductSearch({ onSelect }: { onSelect: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pickedProduct, setPickedProduct] = useState<any>(null)
  const [variants, setVariants] = useState<any[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const reset = () => { setOpen(false); setPickedProduct(null); setVariants([]); setQuery('') }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !dropRef.current?.contains(t)) { setOpen(false); setPickedProduct(null); setVariants([]) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open || !wrapRef.current) { if (!open) setDropRect(null); return }
    const update = () => {
      if (!wrapRef.current) return
      const r = wrapRef.current.getBoundingClientRect()
      setDropRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await productApi.search(query)
        const products = res.data.data ?? []

        // For every 5.25m product, also generate a synthetic 6.5m entry
        const expanded: any[] = []
        products.forEach((p: any) => {
          expanded.push(p)
          if ((p.name ?? '').includes('5.25m')) {
            expanded.push({
              ...p,
              _synthetic: true,
              name: p.name.replace(/5\.25m/g, '6.5m'),
              sku: p.sku ? p.sku.replace(/5\.25/g, '6.5') : p.sku,
              lengthM: 6.5,
            })
          }
        })

        const withDiscounts = await Promise.all(expanded.map(async (p: any) => {
          try {
            const unitPrice = p.sellingPrice ?? p.price ?? 0
            if (unitPrice > 0) {
              const dr = await discountApi.itemPreview(p.id, 1, unitPrice)
              const preview = dr.data.data
              if (preview && preview.discountPct > 0) {
                return { ...p, _offerLabel: preview.label, _offerPct: Number(preview.discountPct) }
              }
            }
          } catch { /* ignore */ }
          return p
        }))
        setResults(withDiscounts)
        setOpen(true)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  async function handleProductClick(p: any) {
    setVariantsLoading(true)
    try {
      const res = await variantApi.getAll(p.id)
      const vars = (res.data.data ?? []).filter((v: any) => v.active !== false)
      if (vars.length > 0) {
        setPickedProduct(p)
        setVariants(vars)
      } else {
        onSelect(p)
        reset()
      }
    } catch {
      onSelect(p)
      reset()
    } finally {
      setVariantsLoading(false)
    }
  }

  function handleVariantClick(v: any) {
    const basePrice = pickedProduct.sellingPrice ?? pickedProduct.price ?? 0
    const variantPrice = basePrice + Number(v.priceAdjustment ?? 0)
    onSelect({
      ...pickedProduct,
      name: v.name || pickedProduct.name,
      sku: v.sku ?? pickedProduct.sku,
      sellingPrice: variantPrice,
      price: variantPrice,
    })
    reset()
  }

  return (
    <div ref={wrapRef}>
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.14)] transition-shadow">
        <Search size={15} className="text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setPickedProduct(null); setVariants([]) }}
          placeholder="Search product to add…"
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
        />
        {(loading || variantsLoading) && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </div>
      {open && dropRect && createPortal(
        <div ref={dropRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
          style={{ top: dropRect.top, left: dropRect.left, width: dropRect.width }}>
          {pickedProduct ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                <button type="button" onMouseDown={() => { setPickedProduct(null); setVariants([]) }}
                  className="text-gray-400 hover:text-gray-600">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-gray-500 truncate">{pickedProduct.name}</span>
                <span className="text-xs text-gray-400 ml-auto shrink-0">Select length</span>
              </div>
              {variants.map(v => {
                const basePrice = pickedProduct.sellingPrice ?? pickedProduct.price ?? 0
                const vPrice = basePrice + Number(v.priceAdjustment ?? 0)
                const label = [v.attribute1Value, v.attribute2Value].filter(Boolean).join(' / ') || v.name
                return (
                  <button key={v.id} type="button"
                    onMouseDown={() => handleVariantClick(v)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      {v.sku && <p className="text-xs text-gray-400 mt-0.5">{v.sku}</p>}
                    </div>
                    <span className="text-sm font-semibold text-primary-600 shrink-0">₹{vPrice.toLocaleString('en-IN')}</span>
                  </button>
                )
              })}
            </>
          ) : results.length > 0 ? (
            results.map(p => {
              const price = p.sellingPrice ?? p.price ?? 0
              const hasOffer = p._offerPct > 0
              const discounted = hasOffer ? price * (1 - p._offerPct / 100) : price
              return (
                <button key={p.id} type="button"
                  onMouseDown={() => handleProductClick(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-gray-400">{p.sku}</p>
                      {hasOffer && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Percent size={8} /> {p._offerLabel || `${p._offerPct}% off`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {hasOffer ? (
                      <>
                        <p className="text-xs text-gray-400 line-through">₹{price.toLocaleString('en-IN')}</p>
                        <p className="text-sm font-semibold text-emerald-600">₹{discounted.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-primary-600">₹{price.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </button>
              )
            })
          ) : null}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Payment Terms ────────────────────────────────────────────────────────────

const PAYMENT_TERMS = [
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt', days: 0 },
  { value: 'NET_7',          label: 'Net 7',           days: 7 },
  { value: 'NET_15',         label: 'Net 15',          days: 15 },
  { value: 'NET_30',         label: 'Net 30',          days: 30 },
  { value: 'NET_45',         label: 'Net 45',          days: 45 },
  { value: 'NET_60',         label: 'Net 60',          days: 60 },
  { value: 'CUSTOM',         label: 'Custom Date',     days: null },
]

// ─── Create Invoice Panel ─────────────────────────────────────────────────────

function CreateInvoicePanel({ outletId, onClose, onCreated, editInvoice }: {
  outletId: number
  onClose: () => void
  onCreated: () => void
  editInvoice?: any
}) {
  const isEdit = !!editInvoice
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [issueDate, setIssueDate]           = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentTerms, setPaymentTerms]     = useState('NET_30')
  const [dueDate, setDueDate]               = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [notes, setNotes]                   = useState('')
  const [terms, setTerms]                   = useState('')
  const [items, setItems]                   = useState<LineItem[]>([])
  const [billDiscPct, setBillDiscPct]       = useState(0)
  const [poNumber, setPoNumber]             = useState('')
  const [shippingAmt, setShippingAmt]       = useState(0)
  const [advanceAmt, setAdvanceAmt]         = useState(0)
  const [deliveryChallanNo, setDeliveryChallanNo] = useState('')
  const [eWayBillNo, setEWayBillNo]         = useState('')
  const [eInvoiceNo, setEInvoiceNo]         = useState('')
  const [submitting, setSubmitting]         = useState(false)
  const [sendOnSave, setSendOnSave]         = useState(false)
  const initialized = useRef(false)

  const { data: nextNumberData } = useQuery({
    queryKey: ['invoice-next-number'],
    queryFn: () => invoiceApi.nextNumber().then((r: any) => r.data.data?.nextNumber ?? ''),
    enabled: !isEdit,
    staleTime: 0,
  })
  const nextInvoiceNumber: string = nextNumberData ?? ''

  const { data: taxGroupsData } = useQuery({
    queryKey: ['taxGroups'],
    queryFn: () => taxGroupApi.getAll(true).then((r: any) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const taxGroups: any[] = taxGroupsData ?? []

  const { data: pipeConfigsData } = useQuery({
    queryKey: ['pipeConfigs-active'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 200 }).then((r: any) => {
      const d = r.data.data
      return (d?.content ?? d ?? []) as any[]
    }),
    staleTime: 10 * 60 * 1000,
  })
  const pipeLengths: number[] = Array.from(new Set([
    5.25, 6.5,
    ...(pipeConfigsData ?? []).map((c: any) => Number(c.lengthM)).filter((l: number) => l > 0),
  ])).sort((a, b) => a - b)

  useEffect(() => {
    if (editInvoice && !initialized.current) {
      initialized.current = true
      setSelectedCustomer(editInvoice.customer ? { id: editInvoice.customer.id, name: editInvoice.customer.name, phone: editInvoice.customer.phone } : null)
      setIssueDate(editInvoice.issueDate ?? format(new Date(), 'yyyy-MM-dd'))
      setPaymentTerms(editInvoice.paymentTerms ?? 'CUSTOM')
      setDueDate(editInvoice.dueDate ?? '')
      setNotes(editInvoice.notes ?? '')
      setTerms(editInvoice.termsConditions ?? '')
      setBillDiscPct(editInvoice.billDiscountPct ?? 0)
      setPoNumber(editInvoice.poNumber ?? '')
      setShippingAmt(editInvoice.shippingAmount ?? 0)
      setAdvanceAmt(editInvoice.paidAmount ?? 0)
      setDeliveryChallanNo(editInvoice.deliveryChallanNo ?? '')
      setEWayBillNo(editInvoice.eWayBillNo ?? '')
      setEInvoiceNo(editInvoice.eInvoiceNo ?? '')
      setItems((editInvoice.items ?? []).map((it: any) => {
        const lm = pipeLength(it.productName ?? '')
        return {
          id: crypto.randomUUID(),
          productId: it.product?.id ?? null,
          productName: it.productName,
          productSku: it.productSku ?? '',
          lengthM: lm,
          meters: Number(it.quantity),
          quantity: Math.ceil(Number(it.quantity) / lm),
          unitPrice: Number(it.unitPrice),
          discountPercent: Number(it.discountPercent ?? 0),
          taxRate: Number(it.taxRate ?? 0),
        }
      }))
    }
  }, [editInvoice])

  useEffect(() => {
    if (!initialized.current && isEdit) return
    const term = PAYMENT_TERMS.find(t => t.value === paymentTerms)
    if (term && term.days !== null) {
      setDueDate(format(addDays(new Date(issueDate), term.days), 'yyyy-MM-dd'))
    }
  }, [paymentTerms, issueDate])

  async function addProduct(p: any) {
    const unitPrice = p.sellingPrice ?? p.price ?? 0
    const lm = p.lengthM ?? pipeLength(p.name ?? '')
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      productId: p.id,
      productName: p.name,
      productSku: p.sku ?? '',
      lengthM: lm,
      meters: lm,
      quantity: 1,
      unitPrice,
      discountPercent: 0,
      taxRate: p.taxGroup?.totalRate ?? 0,
    }
    try {
      const res = await discountApi.itemPreview(p.id, 1, unitPrice)
      const preview = res.data.data
      if (preview && preview.discountPct > 0) {
        newItem.discountPercent = Number(preview.discountPct)
        newItem.autoDiscountLabel = preview.label
      }
    } catch { /* no discount */ }
    setItems(prev => [...prev, newItem])
  }

  function updateItem(id: string, field: keyof LineItem, value: any) {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, [field]: value }
      if (field === 'meters')   updated.quantity = Math.ceil((value as number) / (it.lengthM ?? 5.25))
      if (field === 'quantity') updated.meters   = (value as number) * (it.lengthM ?? 5.25)
      if (field === 'lengthM')  updated.quantity = Math.ceil(it.meters / (value as number))
      return updated
    }))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const lineTotals = items.reduce((acc, it) => {
    const c = calcLine(it)
    return { subtotal: acc.subtotal + c.base, lineDisc: acc.lineDisc + c.disc, tax: acc.tax + c.tax }
  }, { subtotal: 0, lineDisc: 0, tax: 0 })

  const afterLineDisc    = lineTotals.subtotal - lineTotals.lineDisc
  const billDiscAmt      = afterLineDisc * (billDiscPct / 100)
  const grandTotal       = afterLineDisc - billDiscAmt + lineTotals.tax + shippingAmt
  const roundedGrandTotal = Math.round(grandTotal)
  const formRoundOff     = parseFloat((roundedGrandTotal - grandTotal).toFixed(2))
  const formTaxRates     = [...new Set(items.map(i => i.taxRate).filter(r => r > 0))]
  const formGstLabel     = formTaxRates.length === 1 ? `GST (${formTaxRates[0]}%)` : 'GST'

  async function handleSubmit(send: boolean) {
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSendOnSave(send)
    setSubmitting(true)
    try {
      const payload = {
        outletId,
        customerId: selectedCustomer?.id ?? undefined,
        issueDate: issueDate ? `${issueDate}T00:00:00Z` : undefined,
        dueDate: paymentTerms !== 'DUE_ON_RECEIPT' && dueDate ? `${dueDate}T00:00:00Z` : undefined,
        paymentTerms,
        billDiscountPct: billDiscPct > 0 ? billDiscPct : undefined,
        poNumber: poNumber || undefined,
        shippingAmount: shippingAmt > 0 ? shippingAmt : undefined,
        notes: notes || undefined,
        termsConditions: terms || undefined,
        deliveryChallanNo: deliveryChallanNo || undefined,
        eWayBillNo: eWayBillNo || undefined,
        eInvoiceNo: eInvoiceNo || undefined,
        items: items.map(it => ({
          productId: it.productId ?? undefined,
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.meters,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          taxRate: it.taxRate,
        })),
      }
      let invoiceId: number
      if (isEdit) {
        const res = await invoiceApi.update(editInvoice.id, payload)
        invoiceId = res.data.data.id
        const prevPaid = editInvoice.paidAmount ?? 0
        const delta = advanceAmt - prevPaid
        if (delta > 0) await invoiceApi.recordPayment(invoiceId, delta)
        if (send) await invoiceApi.updateStatus(invoiceId, 'SENT')
        toast.success(send ? 'Invoice updated & sent' : 'Invoice updated')
      } else {
        const res = await invoiceApi.create(payload)
        invoiceId = res.data.data.id
        if (advanceAmt > 0) await invoiceApi.recordPayment(invoiceId, advanceAmt)
        if (send) await invoiceApi.updateStatus(invoiceId, 'SENT')
        toast.success(send ? 'Invoice created & sent' : 'Invoice saved as draft')
      }
      onCreated()
      handleClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? (isEdit ? 'Failed to update invoice' : 'Failed to create invoice'))
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTerm = PAYMENT_TERMS.find(t => t.value === paymentTerms)

  return (
    <>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />

      {/* Sliding panel */}
      <div className={`fixed inset-y-0 right-0 left-[220px] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* ── Header ── */}
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <FileText size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">{isEdit ? `Edit · ${editInvoice.invoiceNumber}` : 'New Invoice'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{isEdit ? 'Editing invoice details' : 'Invoice number assigned on save'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClose} className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleSubmit(false)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-blue-400 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                {submitting && !sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                {isEdit ? 'Update Draft' : 'Save Draft'}
              </button>
              <button onClick={() => handleSubmit(true)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm">
                {submitting && sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {isEdit ? 'Update & Send' : 'Save & Send'}
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">

              {/* ── From / To ── */}
              <div className="grid grid-cols-2 gap-4">
                {/* From — static company info */}
                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">From</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 size={17} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">PP Pipes Products</p>
                      <p className="text-xs text-gray-400 mt-0.5">Outlet #{outletId}</p>
                    </div>
                  </div>
                </div>

                {/* To — customer picker */}
                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bill To</p>
                  {selectedCustomer ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 font-bold text-sm">
                        {selectedCustomer.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{selectedCustomer.name}</p>
                        {selectedCustomer.phone && <p className="text-xs text-gray-400 mt-0.5">{selectedCustomer.phone}</p>}
                      </div>
                      <button onClick={() => setSelectedCustomer(null)}
                        className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <CustomerSearchInput
                      label=""
                      value={selectedCustomer}
                      onSelect={setSelectedCustomer}
                      onClear={() => setSelectedCustomer(null)}
                      placeholder="Search customer by name or phone…"
                    />
                  )}
                </div>
              </div>

              {/* ── Invoice metadata bar ── */}
              <div className="bg-white rounded-xl shadow-md">
                <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: '1fr 1fr 1fr 1.4fr 1fr' }}>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Invoice No.</p>
                    {isEdit ? (
                      <p className="text-[13px] font-semibold tracking-wide text-gray-800">{editInvoice.invoiceNumber}</p>
                    ) : nextInvoiceNumber ? (
                      <p className="text-[13px] font-semibold tracking-wide text-blue-600">{nextInvoiceNumber}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Auto-assigned</p>
                    )}
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Issue Date</p>
                    <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                      className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Due Date</p>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                      className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Payment Terms</p>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none appearance-none cursor-pointer">
                      {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">PO Number</p>
                    <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-001"
                      className="w-full text-sm text-gray-800 placeholder-gray-300 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* ── Compliance: DC / EWay / EInvoice ── */}
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

              {/* ── Line Items (search + table combined) ── */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {/* Product search bar */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <ProductSearch onSelect={addProduct} />
                </div>

                {/* Table header */}
                <div className="grid text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-gray-200 border-b border-gray-200"
                  style={{ gridTemplateColumns: '2.5fr 120px 120px 80px 72px 116px 36px' }}>
                  <div className="px-5 py-3">Description</div>
                  <div className="px-3 py-3 text-right">Meters / Pipes</div>
                  <div className="px-3 py-3 text-right">Price / m (₹)</div>
                  <div className="px-3 py-3 text-right">Disc %</div>
                  <div className="px-3 py-3 text-right">GST %</div>
                  <div className="px-3 py-3 text-right">Net Amount</div>
                  <div />
                </div>

                {/* Item rows */}
                {items.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No items yet — search a product below to add</div>
                ) : items.map((it, idx) => {
                  const c = calcLine(it)
                  return (
                    <div key={it.id}
                      className={`grid items-center border-b border-gray-100 last:border-0 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'} hover:bg-blue-50/20`}
                      style={{ gridTemplateColumns: '2.5fr 120px 120px 80px 72px 116px 36px' }}>

                      {/* Description */}
                      <div className="px-5 py-3">
                        <p className="text-sm font-semibold text-gray-900">{it.productName}</p>
                        {it.productSku && <p className="text-[11px] text-gray-400 mt-0.5">{it.productSku}</p>}
                        {it.autoDiscountLabel && it.discountPercent > 0 && (
                          <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Percent size={8} /> {it.autoDiscountLabel}
                          </span>
                        )}
                      </div>

                      {/* Meters + Pipes dual input */}
                      <div className="px-2 py-2 flex flex-col gap-1">
                        <div className="relative">
                          <input type="number" min="0.01" step="0.01" value={it.meters || ''}
                            onChange={e => updateItem(it.id, 'meters', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 pr-5 py-1 text-xs text-right border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white ${NO_SPINNER}`} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 pointer-events-none">m</span>
                        </div>
                        <div className="relative">
                          <input type="number" min="1" step="1" value={it.quantity || ''}
                            onChange={e => updateItem(it.id, 'quantity', parseInt(e.target.value) || 0)}
                            className={`w-full px-2 pr-8 py-1 text-xs text-right border border-blue-200 bg-blue-50/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 ${NO_SPINNER}`} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-blue-400 pointer-events-none">pipes</span>
                        </div>
                        {pipeLengths.length > 0 && (
                          <select value={it.lengthM}
                            onChange={e => updateItem(it.id, 'lengthM', parseFloat(e.target.value))}
                            className="w-full mt-1 px-2 py-1 text-[10px] text-center border border-gray-200 rounded-md bg-white text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer">
                            {pipeLengths.map(l => (
                              <option key={l} value={l}>{l}m</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Price/m */}
                      <div className="px-2 py-2.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">₹</span>
                          <input type="number" min="0" step="0.01" value={it.unitPrice || ''}
                            onChange={e => updateItem(it.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={`w-full pl-5 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white ${NO_SPINNER}`} />
                        </div>
                      </div>

                      {/* Disc % */}
                      <div className="px-2 py-2.5">
                        <input type="number" min="0" max="100" step="0.5" value={it.discountPercent || ''}
                          onChange={e => updateItem(it.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white ${NO_SPINNER}`} />
                      </div>

                      {/* GST % */}
                      <div className="px-2 py-2.5">
                        <GstPicker value={it.taxRate} onChange={rate => updateItem(it.id, 'taxRate', rate)} taxGroups={taxGroups} />
                      </div>

                      {/* Net Amount */}
                      <div className="px-3 py-2.5 text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">₹{c.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        {c.disc > 0 && <p className="text-[10px] text-emerald-600 tabular-nums">−₹{c.disc.toLocaleString('en-IN', { minimumFractionDigits: 2 })} disc</p>}
                      </div>

                      {/* Delete */}
                      <div className="pr-2 flex items-center justify-center">
                        <button type="button" onClick={() => removeItem(it.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Subtotals row */}
                {items.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex justify-end gap-8 text-sm">
                    <span className="text-gray-500">Subtotal: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                    {lineTotals.lineDisc > 0 && <span className="text-emerald-600">Discount: <span className="font-semibold tabular-nums">−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>}
                    <span className="text-gray-500">{formGstLabel}: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                  </div>
                )}
              </div>

              {/* ── Adjustments + Summary ── */}
              <div className="grid grid-cols-2 gap-5">

                {/* Adjustments */}
                <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adjustments</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Bill Discount (%)</label>
                      <input type="number" min="0" max="100" step="0.5" value={billDiscPct || ''}
                        onChange={e => setBillDiscPct(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-right ${NO_SPINNER}`} />
                      {billDiscPct > 0 && <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Freight (₹)</label>
                      <input type="number" min="0" step="0.01" value={shippingAmt || ''}
                        onChange={e => setShippingAmt(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-right ${NO_SPINNER}`} />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Advance Received (₹)</label>
                      <input type="number" min="0" step="0.01" value={advanceAmt || ''}
                        onChange={e => setAdvanceAmt(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-right ${NO_SPINNER}`} />
                    </div>
                  </div>
                </div>

                {/* Summary */}
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
                    {billDiscPct > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Bill Discount ({billDiscPct}%)</span>
                        <span className="tabular-nums font-medium">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>{formGstLabel}</span>
                      <span className="tabular-nums font-medium">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {shippingAmt > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Freight</span>
                        <span className="tabular-nums font-medium">₹{shippingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {formRoundOff !== 0 && (
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Round Off</span>
                        <span>{formRoundOff > 0 ? '+' : ''}₹{formRoundOff.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[15px] border-t border-gray-200 pt-3 mt-1 text-gray-900">
                      <span>Grand Total</span>
                      <span className="tabular-nums text-blue-700">₹{roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {advanceAmt > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600 font-medium">
                        <span>Advance</span>
                        <span className="tabular-nums">−₹{advanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {advanceAmt > 0 && advanceAmt < grandTotal && (
                      <div className="flex justify-between text-sm font-bold text-red-500">
                        <span>Balance Due</span>
                        <span className="tabular-nums">₹{(grandTotal - advanceAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {paymentTerms !== 'DUE_ON_RECEIPT' && dueDate && (
                      <p className="text-[11px] text-gray-400 text-right pt-1">Due on {dueDate}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Notes & Terms ── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={`Payment due ${selectedTerm?.days === 0 ? 'on receipt' : selectedTerm?.days ? `within ${selectedTerm.days} days` : '…'}`}
                    className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms &amp; Conditions</label>
                  <textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)}
                    placeholder="Late payment charges, return policy…"
                    className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none" />
                </div>
              </div>

            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400 tabular-nums">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {grandTotal > 0 ? ` · Total ₹${roundedGrandTotal.toLocaleString('en-IN')}` : ''}
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleClose} disabled={submitting}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-blue-400 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                {submitting && !sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                {isEdit ? 'Update Draft' : 'Save Draft'}
              </button>
              <button onClick={() => handleSubmit(true)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm">
                {submitting && sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {isEdit ? 'Update & Send' : 'Save & Send'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ invoice, onClose, onDone }: {
  invoice: any
  onClose: () => void
  onDone: () => void
}) {
  const balance = (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0)
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > balance) { toast.error(`Cannot exceed balance ₹${balance.toFixed(2)}`); return }
    setSubmitting(true)
    try {
      await invoiceApi.recordPayment(invoice.id, amt)
      toast.success('Payment recorded')
      onDone()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Record Payment</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Invoice Total</span>
              <span className="font-medium text-gray-800">₹{(invoice.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Paid So Far</span>
              <span className="font-medium text-green-600">₹{(invoice.paidAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-1 text-gray-800">
              <span>Balance Due</span>
              <span>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Payment Amount</label>
            <div className="flex items-center border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500">
              <IndianRupee size={14} className="text-gray-400 mr-1.5" />
              <input type="number" min="0.01" step="0.01" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 text-sm outline-none text-gray-800" />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Date formatter ───────────────────────────────────────────────────────────
// Converts ISO date string (yyyy-MM-dd or yyyy-MM-ddT...) → dd/mm/yyyy
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const clean = d.substring(0, 10)   // strip any time component
  const [y, m, day] = clean.split('-')
  if (!y || !m || !day) return d
  return `${day}/${m}/${y}`
}

function fmtTime(d: string | null | undefined) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '' }
}

// ─── View Invoice Modal ────────────────────────────────────────────────────────

function ViewInvoiceModal({ id, onClose, onUpdated, onEdit }: {
  id: number
  onClose: () => void
  onUpdated: () => void
  onEdit?: (inv: any) => void
}) {
  const [showPayment, setShowPayment]   = useState(false)
  const [updating, setUpdating]         = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const { outletId } = useAuthStore()
  const printRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await invoiceApi.getById(id)
      return res.data.data
    },
  })

  async function changeStatus(status: string) {
    setUpdating(true)
    try {
      await invoiceApi.updateStatus(id, status)
      toast.success(`Invoice marked as ${status.toLowerCase()}`)
      refetch(); onUpdated()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update status')
    } finally { setUpdating(false) }
  }

  async function handleSendEmail() {
    setEmailSending(true)
    try {
      await integrationApi.sendInvoiceEmail(id, outletId!)
      const inv = data
      toast.success(`Email sent to ${inv?.customer?.email}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to send email')
    } finally { setEmailSending(false) }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this draft invoice? This cannot be undone.')) return
    setDeleting(true)
    try {
      await invoiceApi.delete(id)
      toast.success('Draft deleted')
      onUpdated()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to delete invoice')
    } finally { setDeleting(false) }
  }

  // Parse invoice template from outlet settings
  const invTpl: InvoiceTemplateConfig = (() => {
    try {
      if (data?.outlet?.invoiceTemplate) {
        return { ...DEFAULT_INVOICE_TEMPLATE, ...JSON.parse(data.outlet.invoiceTemplate) }
      }
    } catch { /* use default */ }
    return DEFAULT_INVOICE_TEMPLATE
  })()

  function handlePrint() {
    const content = printRef.current
    if (!content || !inv) return
    const win = window.open('', '_blank', 'width=720,height=900')
    if (!win) return
    const pc = invTpl.primaryColor
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:13px;color:#111;background:#fff;max-width:700px;margin:0 auto}
        .inv-header{background:${pc};color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start}
        .inv-header h1{font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px}
        .inv-header .sub{font-size:12px;color:rgba(255,255,255,0.7);margin-top:3px}
        .badge{display:inline-flex;background:#ecfdf5;color:#15803d;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid #bbf7d0}
        .badge.partial{background:#fefce8;color:#a16207;border-color:#fde68a}
        .badge.overdue{background:#fef2f2;color:#dc2626;border-color:#fecaca}
        .badge.draft,.badge.cancelled{background:#f3f4f6;color:#4b5563;border-color:#e5e7eb}
        .meta{display:grid;grid-template-columns:${invTpl.showIssueDate !== false ? '1fr 1fr 1fr' : '1fr 1fr'};border-bottom:1px solid #e5e7eb;font-size:12px}
        .meta-cell{padding:12px 20px;border-right:1px solid #e5e7eb}
        .meta-cell:last-child{border-right:none}
        .meta-cell label{color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:2px}
        .meta-cell p{font-weight:600;color:#111}
        .body{padding:24px 32px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{background:#f9fafb;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:.05em;border-bottom:2px solid #e5e7eb}
        td{padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151}
        .num{text-align:right}.cen{text-align:center}
        .totals-wrap{display:flex;justify-content:flex-end}
        .totals{width:260px;font-size:13px}
        .totals .row{display:flex;justify-content:space-between;padding:4px 0;color:#6b7280}
        .totals .grand{display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:15px;border-top:2px solid #111;margin-top:4px}
        .totals .paid{display:flex;justify-content:space-between;padding:4px 0;color:#16a34a;font-weight:600}
        .totals .balance{display:flex;justify-content:space-between;padding:4px 0;color:#dc2626;font-weight:600}
        .section{padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px}
        .section h4{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:6px}
        .sig-box{border-top:1px solid #9ca3af;padding-top:6px;text-align:center;width:160px;margin-left:auto;font-size:11px;color:#6b7280}
        .footer-bar{text-align:center;padding:16px 32px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
        @media print{@page{margin:10mm}}
      </style></head><body>${content.innerHTML}
      <script>window.onload=function(){window.print();window.close()}</script>
      </body></html>`)
    win.document.close()
  }

  const inv     = data
  const balance = inv ? (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0) : 0
  const isPOS   = !!inv?.order

  const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Cash', CARD: 'Card', UPI: 'UPI', WALLET: 'Wallet',
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">Invoice Details</h3>
              {isPOS && (
                <span className="flex items-center gap-1 text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-full">
                  <ShoppingCart size={10} /> POS
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {inv && (
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-700 text-white rounded-lg transition-colors">
                  <Printer size={13} /> Print
                </button>
              )}
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : inv ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* ── Printable content ── */}
              <div ref={printRef}>

                {/* Invoice header (template-colored, used in print) */}
                <div className="inv-header rounded-xl mb-3 px-5 py-4 flex items-start justify-between" style={{ background: invTpl.primaryColor }}>
                  <div>
                    {invTpl.showLogo && invTpl.logoUrl && <img src={invTpl.logoUrl} alt="Logo" className="h-8 object-contain mb-1" />}
                    <div className="text-white font-black text-xl tracking-tight">
                      {invTpl.layout === 'classic' ? 'TAX INVOICE' : 'INVOICE'}
                    </div>
                    <div className="sub text-white/70 text-xs mt-0.5">{inv.invoiceNumber}</div>
                    {data?.outlet?.name && <div className="sub text-white/60 text-xs">{data.outlet.name}</div>}
                  </div>
                  <span className={`badge text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'} ${inv.status.toLowerCase()}`}>
                    {inv.status}
                  </span>
                </div>

                {/* Meta grid */}
                <div className="meta grid grid-cols-3 gap-3 text-sm mb-3">
                  <div className="meta-cell bg-gray-50 rounded-lg p-3">
                    <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Invoice #</label>
                    <p className="font-mono font-bold text-gray-900">{inv.invoiceNumber}</p>
                  </div>
                  {invTpl.showIssueDate !== false && (
                    <div className="meta-cell bg-gray-50 rounded-lg p-3">
                      <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Issue Date</label>
                      <p className="text-gray-800">{fmtDate(inv.issueDate)}</p>
                      {invTpl.showTime && <p className="text-[11px] text-gray-400 mt-0.5">{fmtTime(inv.createdAt ?? inv.issueDate)}</p>}
                    </div>
                  )}
                  <div className="meta-cell bg-gray-50 rounded-lg p-3">
                    <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Customer</label>
                    <p className="text-gray-800">{inv.customer?.name ?? <span className="italic text-gray-400">Walk-in</span>}</p>
                    {inv.customer?.phone && <p className="text-[11px] text-gray-400">{inv.customer.phone}</p>}
                  </div>
                  {inv.dueDate && (
                    <div className="meta-cell bg-gray-50 rounded-lg p-3">
                      <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Due Date</label>
                      <p className="text-gray-800">{fmtDate(inv.dueDate)}</p>
                    </div>
                  )}
                  {inv.paymentTerms && (
                    <div className="meta-cell bg-gray-50 rounded-lg p-3">
                      <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Payment Terms</label>
                      <p className="text-gray-800 text-sm font-medium">{inv.paymentTerms.replace(/_/g, ' ')}</p>
                    </div>
                  )}
                  {inv.poNumber && (
                    <div className="meta-cell bg-gray-50 rounded-lg p-3">
                      <label className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">PO Number</label>
                      <p className="font-mono text-gray-800 font-semibold">{inv.poNumber}</p>
                    </div>
                  )}
                  {inv.order && (
                    <div className="meta-cell bg-primary-50 rounded-lg p-3 border border-primary-100">
                      <label className="text-[11px] text-primary-400 uppercase tracking-wide mb-0.5">POS Order #</label>
                      <p className="font-mono text-primary-700 font-semibold">{inv.order.orderNumber}</p>
                    </div>
                  )}
                </div>

                {/* Line items */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price</th>
                          <th className="px-3 py-2 text-center">Disc%</th>
                          <th className="px-3 py-2 text-center">Tax%</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(inv.items ?? []).map((it: any) => (
                          <tr key={it.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800">{it.productName}</p>
                              {it.productSku && <p className="text-xs text-gray-400">{it.productSku}</p>}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">{it.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-600">₹{(it.unitPrice ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-center text-gray-500">
                              {(it.discountPercent ?? 0) > 0
                                ? <span className="text-green-600 font-medium">{it.discountPercent}%</span>
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-500">
                              {(it.taxRate ?? 0) > 0
                                ? <span className="text-blue-600 font-medium">{it.taxRate}%</span>
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">
                              ₹{(it.lineTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals + payment breakdown side by side */}
                <div className="flex gap-4">
                  {/* Payment breakdown (POS orders have order.payments) */}
                  {inv.order?.payments?.length > 0 && (
                    <div className="flex-1 bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Breakdown</p>
                      <div className="space-y-1.5 text-sm">
                        {inv.order.payments.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-gray-600">
                            <span>{PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod}
                              {p.referenceNumber ? <span className="text-gray-400 text-xs ml-1">({p.referenceNumber})</span> : ''}
                            </span>
                            <span className="font-medium">₹{(p.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        {(inv.order.changeAmount ?? 0) > 0 && (
                          <div className="flex justify-between text-blue-600 font-semibold border-t pt-1.5 mt-1">
                            <span>Change Returned</span>
                            <span>₹{(inv.order.changeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="flex-1 bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>₹{(inv.subtotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {(inv.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>−₹{(inv.discountAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {(inv.billDiscountAmt ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Trade Discount ({inv.billDiscountPct}%)</span>
                        <span>−₹{(inv.billDiscountAmt ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {(inv.taxAmount ?? 0) > 0 && (() => {
                      const invItemsArr: any[] = inv.items ?? []
                      const invRates = [...new Set(invItemsArr.map((it: any) => Number(it.taxRate ?? 0)).filter((r: number) => r > 0))]
                      const invGstLbl = invRates.length === 1 ? `GST (${invRates[0]}%)` : 'GST'
                      return (
                        <div className="flex justify-between text-gray-500">
                          <span>{invGstLbl}</span>
                          <span>+₹{(inv.taxAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )
                    })()}
                    {(inv.shippingAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Freight / Shipping</span>
                        <span>+₹{(inv.shippingAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {(() => {
                      const invTotal = Number(inv.totalAmount ?? 0)
                      const invRounded = Math.round(invTotal)
                      const invRoundOff = parseFloat((invRounded - invTotal).toFixed(2))
                      if (invRoundOff === 0) return null
                      return (
                        <div className="flex justify-between text-gray-400 text-xs">
                          <span>Round Off</span>
                          <span>{invRoundOff > 0 ? '+' : ''}₹{invRoundOff.toFixed(2)}</span>
                        </div>
                      )
                    })()}
                    <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t">
                      <span>Total</span>
                      <span>₹{Math.round(inv.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {(inv.paidAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600 font-semibold">
                        <span>{isPOS ? 'Paid' : 'Advance Collected'}</span>
                        <span>−₹{(inv.paidAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {balance > 0 && (
                      <div className="flex justify-between font-semibold text-red-600">
                        <span>Balance Due</span>
                        <span>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {inv.notes && (
                  <div className="section bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{inv.notes}</p>
                  </div>
                )}

                {/* ── Template-driven sections ── */}
                {(invTpl.bankDetails || invTpl.showSignatureLine) && (
                  <div className="section flex gap-6 pt-4 border-t border-gray-100">
                    {invTpl.bankDetails && (
                      <div className="flex-1">
                        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Bank Details</h4>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{invTpl.bankDetails}</p>
                      </div>
                    )}
                    {invTpl.showSignatureLine && (
                      <div className="flex flex-col items-end justify-end shrink-0">
                        <div className="sig-box border-t border-gray-400 pt-2 text-center w-40">
                          <p className="text-xs text-gray-500">For {data?.outlet?.name}</p>
                          <p className="text-[10px] text-gray-400 mt-1">Authorised Signatory</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {invTpl.terms && (
                  <div className="section pt-3 border-t border-gray-100">
                    <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Terms & Conditions</h4>
                    <p className="text-xs text-gray-500 whitespace-pre-wrap">{invTpl.terms}</p>
                  </div>
                )}

                {/* Footer bar */}
                <div className="footer-bar mt-4 text-center border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400">{invTpl.thankYouMessage || 'Thank you for your business!'}</p>
                  {invTpl.footerNote && <p className="text-[10px] text-gray-400 mt-0.5">{invTpl.footerNote}</p>}
                </div>

              </div>
              {/* ── End printable content ── */}

            </div>
          ) : isError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
              <FileText size={32} className="opacity-40" />
              <p className="text-sm">Failed to load invoice. Please try again.</p>
              <button onClick={() => refetch()} className="text-xs text-primary-600 hover:underline">Retry</button>
            </div>
          ) : null}

          {/* Action buttons */}
          {inv && (
            <div className="px-6 py-4 border-t bg-gray-50 flex flex-wrap gap-2 shrink-0">
              {onEdit && (
                <button onClick={() => { onEdit(inv); onClose() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  <Edit2 size={13} /> Edit
                </button>
              )}
              {inv.status === 'DRAFT' && (
                <button disabled={updating} onClick={() => changeStatus('SENT')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Send size={13} /> Send Invoice
                </button>
              )}
              {inv.customer?.email && (
                <button disabled={emailSending} onClick={handleSendEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  title={`Send email to ${inv.customer.email}`}>
                  {emailSending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                  Send Email
                </button>
              )}
              {(inv.status === 'SENT' || inv.status === 'PARTIAL' || inv.status === 'OVERDUE') && balance > 0 && (
                <button onClick={() => setShowPayment(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <CreditCard size={13} /> Record Payment
                </button>
              )}
              {inv.status === 'SENT' && (
                <button disabled={updating} onClick={() => changeStatus('OVERDUE')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                  <Clock size={13} /> Mark Overdue
                </button>
              )}
              {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                <button disabled={updating} onClick={() => changeStatus('CANCELLED')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100">
                  <Ban size={13} /> Cancel
                </button>
              )}
              {inv.status === 'DRAFT' && (
                <button disabled={deleting} onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 ml-auto">
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete Draft
                </button>
              )}
              {inv.status === 'PAID' && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-700 bg-green-50 rounded-lg">
                  <CheckCircle size={13} /> Fully Paid
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {showPayment && inv && (
        <RecordPaymentModal
          invoice={inv}
          onClose={() => setShowPayment(false)}
          onDone={() => { refetch(); onUpdated() }}
        />
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const outletId = useAuthStore(s => s.user?.outletId ?? 1)
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab]                       = useState<'summary' | 'transactions'>('summary')
  const [statusTab, setStatusTab]           = useState('ALL')
  const [search, setSearch]                 = useState('')
  const [page, setPage]                     = useState(0)
  const [showCreate, setShowCreate]         = useState(false)
  const [editInvoice, setEditInvoice]       = useState<any | null>(null)
  const [collectInvoice, setCollectInvoice] = useState<any | null>(null)
  const [fromDate, setFromDate]             = useState(_fmtD(_startOf('month')))
  const [toDate,   setToDate]               = useState(_fmtD(new Date()))
  const [viewId, setViewId]                 = useState<number | null>(() => {
    const id = searchParams.get('invoiceId')
    return id ? parseInt(id) : null
  })
  const PAGE_SIZE = 15

  // Clear the ?invoiceId param once the modal opens so the URL stays clean
  useEffect(() => {
    if (viewId && searchParams.has('invoiceId')) {
      setSearchParams({}, { replace: true })
    }
  }, [viewId])

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', outletId, statusTab, page, fromDate, toDate],
    queryFn: async () => {
      const res = await invoiceApi.getByOutlet(outletId, {
        status: statusTab === 'ALL' ? undefined : statusTab,
        fromDate: fromDate || undefined,
        toDate:   toDate   || undefined,
        page,
        size: PAGE_SIZE,
        sort: 'issueDate,desc',
      })
      return res.data.data
    },
  })

  // Separate large-page fetch for chart data (same filters, no pagination limit)
  const { data: chartRaw } = useQuery({
    queryKey: ['invoices-chart', outletId, fromDate, toDate],
    queryFn: async () => {
      const res = await invoiceApi.getByOutlet(outletId, {
        fromDate: fromDate || undefined,
        toDate:   toDate   || undefined,
        page: 0,
        size: 500,
        sort: 'issueDate,asc',
      })
      return (res.data.data?.content ?? []) as any[]
    },
  })

  const invoices: any[]   = data?.content ?? []
  const totalPages: number = data?.totalPages ?? 0
  const totalElements: number = data?.totalElements ?? 0

  const filtered = search.trim()
    ? invoices.filter(inv =>
        inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
        inv.customer?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : invoices

  function fmt(amt: number) {
    return '₹' + (amt ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
  }

  function shortNum(num: string) {
    if (!num) return '—'
    const parts = num.split('-')
    return parts[0] + '-…-' + parts[parts.length - 1]
  }

  function isOverdue(inv: any) {
    if (!inv.dueDate) return false
    if (inv.status !== 'SENT' && inv.status !== 'PARTIAL') return false
    return new Date(inv.dueDate) < new Date(new Date().toDateString())
  }

  // Summary KPIs (from chart raw data = all invoices for period, not just current page)
  const kpiSource      = chartRaw ?? invoices
  const totalInvoiced  = kpiSource.reduce((s: number, i: any) => s + parseFloat(String(i.totalAmount ?? 0)), 0)
  const totalPaid      = kpiSource.reduce((s: number, i: any) => s + parseFloat(String(i.paidAmount ?? 0)), 0)
  const totalOutstanding = kpiSource.reduce((s: number, i: any) => s + Math.max(0, parseFloat(String(i.totalAmount ?? 0)) - parseFloat(String(i.paidAmount ?? 0))), 0)
  const overdueCount   = kpiSource.filter((i: any) => i.status === 'OVERDUE' || isOverdue(i)).length

  // Bar chart: group by issueDate
  const barData = (() => {
    if (!chartRaw?.length) return []
    const map = new Map<string, { invoiced: number; paid: number }>()
    for (const inv of chartRaw) {
      const d = (inv.issueDate ?? '').substring(0, 10)
      if (!d) continue
      const cur = map.get(d) ?? { invoiced: 0, paid: 0 }
      cur.invoiced += parseFloat(String(inv.totalAmount ?? 0))
      cur.paid     += parseFloat(String(inv.paidAmount  ?? 0))
      map.set(d, cur)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => {
        const [y, m, dd] = date.substring(0, 10).split('-')
        return { date: `${dd}/${m}/${y}`, ...v }
      })
  })()

  // Pie chart: status distribution
  const pieData = (() => {
    if (!chartRaw?.length) return []
    const map = new Map<string, number>()
    for (const inv of chartRaw) {
      const s = inv.status ?? 'DRAFT'
      map.set(s, (map.get(s) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  })()

  return (
    <div className="p-6 space-y-4">
      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-2">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>

        {/* Top row — title + all controls inline */}
        <div className="relative flex items-center gap-3 px-8 py-5 flex-wrap">
          <div className="flex items-center gap-4 shrink-0">
            <Receipt size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Sales</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Invoices</h1>
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 bg-white/10 rounded-full p-1 shrink-0">
            {(['summary', 'transactions'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
                  tab === t ? 'bg-white text-violet-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Status chips */}
          <div className="flex gap-1 bg-white/10 rounded-xl p-1 flex-wrap">
            {STATUS_TABS.map(s => (
              <button key={s} onClick={() => { setStatusTab(s); setPage(0); if (tab !== 'transactions') setTab('transactions') }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  statusTab === s && tab === 'transactions'
                    ? STATUS_TAB_ACTIVE[s]
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}>
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-52 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <input value={search} onChange={e => { setSearch(e.target.value); if (tab !== 'transactions') setTab('transactions') }}
              placeholder="Search…"
              className="pl-9 pr-4 py-2 bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl w-full text-sm focus:outline-none focus:bg-white/20 focus:border-white/40 transition-colors" />
          </div>

          {/* Date filter + New Invoice pushed to end */}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            <InvDateFilterDropdown
              from={fromDate} to={toDate}
              onChange={(f, t) => { setFromDate(f); setToDate(t); setPage(0) }}
            />
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors">
              <Plus size={16} /> New Invoice
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{fmt(totalInvoiced)}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Invoiced</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-emerald-300 text-xl font-bold">{fmt(totalPaid)}</p>
            <p className="text-violet-200 text-xs mt-0.5">Amount Received</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-amber-300' : 'text-white'}`}>{fmt(totalOutstanding)}</p>
            <p className="text-violet-200 text-xs mt-0.5">Outstanding</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className={`text-xl font-bold ${overdueCount > 0 ? 'text-red-300' : 'text-white'}`}>{overdueCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Overdue</p>
          </div>
        </div>

      </div>

      {/* ── Summary Tab ── */}
      {tab === 'summary' && (<>
        {/* Charts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 bg-white rounded-2xl border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Invoiced vs Collected</p>
            {barData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-gray-300 text-sm">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={barData} barCategoryGap="30%">
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [`₹${Number(v).toLocaleString('en-IN')}`, name === 'invoiced' ? 'Invoiced' : 'Collected']}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid"     fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Status Breakdown</p>
            {pieData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-gray-300 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: string) => [v, name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </>)}

      {/* ── Transactions Tab ── */}
      {tab === 'transactions' && (<>
        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Issue Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <Loader2 size={24} className="animate-spin text-gray-300 mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <FileText size={36} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No invoices found</p>
                </td></tr>
              ) : filtered.map(inv => {
                const balance = (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0)
                return (
                  <tr key={inv.id} onClick={() => setViewId(inv.id)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <span title={inv.invoiceNumber} className="font-mono text-xs font-semibold text-primary-600">{shortNum(inv.invoiceNumber)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{inv.customer?.name ?? <span className="text-gray-400 italic">Walk-in</span>}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{inv.items?.length ?? 0}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">{fmt(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-green-600">{fmt(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {balance > 0
                        ? (inv.status === 'SENT' || inv.status === 'PARTIAL' || inv.status === 'OVERDUE')
                          ? <button onClick={e => { e.stopPropagation(); setCollectInvoice(inv) }}
                              className="text-red-500 hover:text-green-700 hover:underline transition-colors"
                              title="Click to collect payment">
                              {fmt(balance)}
                            </button>
                          : <span className="text-red-500">{fmt(balance)}</span>
                        : <span className="text-green-500">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{fmtDate(inv.issueDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {inv.status}
                        </span>
                        {isOverdue(inv) && (
                          <span title="Past due date" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
                            <AlertTriangle size={9} /> Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status === 'DRAFT' && (
                          <button onClick={e => { e.stopPropagation(); setEditInvoice(inv) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Edit draft">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {balance > 0 && (inv.status === 'SENT' || inv.status === 'PARTIAL' || inv.status === 'OVERDUE') && (
                          <button onClick={e => { e.stopPropagation(); setCollectInvoice(inv) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
                            title="Collect balance payment">
                            <CreditCard size={11} /> Collect
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <span className="text-xs text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </>)}

      {showCreate && (
        <CreateInvoicePanel
          outletId={outletId}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['invoices'] })}
        />
      )}
      {editInvoice && (
        <CreateInvoicePanel
          outletId={outletId}
          editInvoice={editInvoice}
          onClose={() => setEditInvoice(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['invoices'] })}
        />
      )}
      {viewId !== null && (
        <ViewInvoiceModal
          id={viewId}
          onClose={() => setViewId(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['invoices'] })}
          onEdit={inv => { setViewId(null); setEditInvoice(inv) }}
        />
      )}
      {collectInvoice && (
        <RecordPaymentModal
          invoice={collectInvoice}
          onClose={() => setCollectInvoice(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); setCollectInvoice(null) }}
        />
      )}
    </div>
  )
}
