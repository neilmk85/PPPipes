import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, FileText, X, Loader2, ChevronLeft, ChevronRight,
  Trash2, CheckCircle, Send, Ban,
  ArrowRightCircle, Eye, Mail, ClipboardList,
  Building2, Percent,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { quotationApi, productApi, discountApi, integrationApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import CustomerSearchInput from '@/components/CustomerSearchInput'
import { createPortal } from 'react-dom'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-50 text-blue-700',
  ACCEPTED:  'bg-green-50 text-green-700',
  REJECTED:  'bg-red-50 text-red-600',
  EXPIRED:   'bg-orange-50 text-orange-600',
  CONVERTED: 'bg-purple-50 text-purple-700',
}
const STATUS_TABS = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']

// ─── Constants ────────────────────────────────────────────────────────────────

const METERS_PER_PIPE = 5.25

// ─── Line item type ────────────────────────────────────────────────────────────

interface LineItem {
  id: string
  productId: number | null
  productName: string
  productSku: string
  meters: number
  quantity: number
  unitPrice: number
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
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !dropRef.current?.contains(t)) setOpen(false)
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
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [open])

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await productApi.search(query)
        const products = res.data.data ?? []
        const withDiscounts = await Promise.all(products.map(async (p: any) => {
          try {
            const unitPrice = p.sellingPrice ?? p.price ?? 0
            if (unitPrice > 0) {
              const dr = await discountApi.itemPreview(p.id, 1, unitPrice)
              const preview = dr.data.data
              if (preview && preview.discountPct > 0) return { ...p, _offerLabel: preview.label, _offerPct: Number(preview.discountPct) }
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

  return (
    <div ref={wrapRef}>
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.14)] transition-shadow">
        <Search size={15} className="text-gray-400 shrink-0" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search product to add…"
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400" />
        {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </div>
      {open && results.length > 0 && dropRect && createPortal(
        <div ref={dropRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-2xl max-h-52 overflow-y-auto"
          style={{ top: dropRect.top, left: dropRect.left, width: dropRect.width }}>
          {results.map(p => {
            const price = p.sellingPrice ?? p.price ?? 0
            const hasOffer = p._offerPct > 0
            const discounted = hasOffer ? price * (1 - p._offerPct / 100) : price
            return (
              <button key={p.id} type="button"
                onMouseDown={() => { onSelect(p); setQuery(''); setOpen(false) }}
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
                    <span className="text-sm font-semibold text-violet-600">₹{price.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Create Quotation Panel ────────────────────────────────────────────────────

function CreateQuotationPanel({ outletId, onClose, onCreated }: {
  outletId: number
  onClose: () => void
  onCreated: () => void
}) {
  const [visible, setVisible]               = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [sendOnSave, setSendOnSave]         = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [quoteDate, setQuoteDate]           = useState(format(new Date(), 'yyyy-MM-dd'))
  const [validUntil, setValidUntil]         = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [poNumber, setPoNumber]             = useState('')
  const [billDiscPct, setBillDiscPct]       = useState(0)
  const [shippingAmt, setShippingAmt]       = useState(0)
  const [notes, setNotes]                   = useState('')
  const [terms, setTerms]                   = useState('Prices are valid till the validity date mentioned above.\nGST as applicable.\nSubject to local jurisdiction.')
  const [items, setItems]                   = useState<LineItem[]>([])

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  async function addProduct(p: any) {
    const unitPrice = p.sellingPrice ?? p.price ?? 0
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      productId: p.id,
      productName: p.name,
      productSku: p.sku ?? '',
      meters: METERS_PER_PIPE,
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
      if (field === 'meters') updated.quantity = Math.ceil((value as number) / METERS_PER_PIPE)
      return updated
    }))
  }

  function removeItem(id: string) { setItems(prev => prev.filter(it => it.id !== id)) }

  const lineTotals = items.reduce((acc, it) => {
    const c = calcLine(it)
    return { subtotal: acc.subtotal + c.base, lineDisc: acc.lineDisc + c.disc, tax: acc.tax + c.tax }
  }, { subtotal: 0, lineDisc: 0, tax: 0 })

  const afterLineDisc  = lineTotals.subtotal - lineTotals.lineDisc
  const billDiscAmt    = afterLineDisc * (billDiscPct / 100)
  const grandTotal     = afterLineDisc - billDiscAmt + lineTotals.tax + shippingAmt
  const roundedTotal   = Math.round(grandTotal)
  const roundOff       = parseFloat((roundedTotal - grandTotal).toFixed(2))
  const taxRates       = [...new Set(items.map(i => i.taxRate).filter(r => r > 0))]
  const gstLabel       = taxRates.length === 1 ? `GST (${taxRates[0]}%)` : 'GST'

  async function handleSubmit(send: boolean) {
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSendOnSave(send)
    setSubmitting(true)
    try {
      const res = await quotationApi.create({
        customerId: selectedCustomer?.id ?? null,
        outletId,
        validUntil: validUntil ? `${validUntil}T00:00:00Z` : undefined,
        notes: notes || undefined,
        termsConditions: terms || undefined,
        items: items.map(it => ({
          productId: it.productId ?? undefined,
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.meters,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          taxRate: it.taxRate,
        })),
      })
      if (send) await quotationApi.updateStatus(res.data.data.id, 'SENT')
      toast.success(send ? 'Quotation sent' : 'Quotation saved as draft')
      onCreated()
      handleClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create quotation')
    } finally {
      setSubmitting(false)
    }
  }

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
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <ClipboardList size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">New Quotation</h2>
                <p className="text-xs text-gray-400 mt-0.5">Quotation number assigned on save</p>
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
                Save & Send
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">

              {/* ── From / To ── */}
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quote To</p>
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
                    <CustomerSearchInput label="" value={selectedCustomer} onSelect={setSelectedCustomer}
                      onClear={() => setSelectedCustomer(null)} placeholder="Search customer by name or phone…" />
                  )}
                </div>
              </div>

              {/* ── Quotation metadata bar ── */}
              <div className="bg-white rounded-xl shadow-md">
                <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Quotation No.</p>
                    <p className="text-sm text-gray-400 italic">Auto-assigned</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Quote Date</p>
                    <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)}
                      className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Valid Until</p>
                    <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                      className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">PO Reference</p>
                    <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-001"
                      className="w-full text-sm text-gray-800 placeholder-gray-300 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* ── Line Items ── */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <ProductSearch onSelect={addProduct} />
                </div>

                {/* Table header */}
                <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100"
                  style={{ gridTemplateColumns: '2.5fr 100px 120px 80px 72px 116px 36px' }}>
                  <div className="px-5 py-3">Description</div>
                  <div className="px-3 py-3 text-right">Meters (m)</div>
                  <div className="px-3 py-3 text-right">Price / m (₹)</div>
                  <div className="px-3 py-3 text-right">Disc %</div>
                  <div className="px-3 py-3 text-right">GST %</div>
                  <div className="px-3 py-3 text-right">Net Amount</div>
                  <div />
                </div>

                {items.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No items yet — search a product above to add</div>
                ) : items.map((it, idx) => {
                  const c = calcLine(it)
                  return (
                    <div key={it.id}
                      className={`grid items-center border-b border-gray-100 last:border-0 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'} hover:bg-violet-50/20`}
                      style={{ gridTemplateColumns: '2.5fr 100px 120px 80px 72px 116px 36px' }}>
                      <div className="px-5 py-3">
                        <p className="text-sm font-semibold text-gray-900">{it.productName}</p>
                        {it.productSku && <p className="text-[11px] text-gray-400 mt-0.5">{it.productSku}</p>}
                        {it.autoDiscountLabel && it.discountPercent > 0 && (
                          <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Percent size={8} /> {it.autoDiscountLabel}
                          </span>
                        )}
                        {it.meters > 0 && it.unitPrice > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                            {it.meters}m × ₹{it.unitPrice}/m · ≈ {it.quantity} pipe{it.quantity !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <div className="px-2 py-2.5">
                        <input type="number" min="0.01" step="0.01" value={it.meters || ''}
                          onChange={e => updateItem(it.id, 'meters', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                      </div>
                      <div className="px-2 py-2.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">₹</span>
                          <input type="number" min="0" step="0.01" value={it.unitPrice || ''}
                            onChange={e => updateItem(it.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full pl-5 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                        </div>
                      </div>
                      <div className="px-2 py-2.5">
                        <input type="number" min="0" max="100" step="0.5" value={it.discountPercent || ''}
                          onChange={e => updateItem(it.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                      </div>
                      <div className="px-2 py-2.5">
                        <input type="number" min="0" max="100" step="0.5" value={it.taxRate || ''}
                          onChange={e => updateItem(it.id, 'taxRate', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                      </div>
                      <div className="px-3 py-2.5 text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">₹{c.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        {c.disc > 0 && <p className="text-[10px] text-emerald-600 tabular-nums">−₹{c.disc.toLocaleString('en-IN', { minimumFractionDigits: 2 })} disc</p>}
                      </div>
                      <div className="pr-2 flex items-center justify-center">
                        <button type="button" onClick={() => removeItem(it.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {items.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex justify-end gap-8 text-sm">
                    <span className="text-gray-500">Subtotal: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                    {lineTotals.lineDisc > 0 && <span className="text-emerald-600">Discount: <span className="font-semibold tabular-nums">−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>}
                    <span className="text-gray-500">{gstLabel}: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                  </div>
                )}
              </div>

              {/* ── Adjustments + Summary ── */}
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adjustments</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Trade Discount (%)</label>
                      <input type="number" min="0" max="100" step="0.5" value={billDiscPct || ''}
                        onChange={e => setBillDiscPct(parseFloat(e.target.value) || 0)} placeholder="0"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-right" />
                      {billDiscPct > 0 && <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Freight (₹)</label>
                      <input type="number" min="0" step="0.01" value={shippingAmt || ''}
                        onChange={e => setShippingAmt(parseFloat(e.target.value) || 0)} placeholder="0.00"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-right" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Quotation Summary</p>
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
                        <span>Trade Discount ({billDiscPct}%)</span>
                        <span className="tabular-nums font-medium">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>{gstLabel}</span>
                      <span className="tabular-nums font-medium">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {shippingAmt > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Freight</span>
                        <span className="tabular-nums font-medium">₹{shippingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {roundOff !== 0 && (
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Round Off</span>
                        <span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[15px] border-t border-gray-200 pt-3 mt-1 text-gray-900">
                      <span>Grand Total</span>
                      <span className="tabular-nums text-violet-700">₹{roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 text-right pt-1">Valid until {validUntil}</p>
                  </div>
                </div>
              </div>

              {/* ── Notes & Terms ── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Special rates for bulk order, delivery included…"
                    className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms &amp; Conditions of Quotation</label>
                  <textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)}
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
                Save & Send
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── View Quotation Modal ──────────────────────────────────────────────────────

function ViewQuotationModal({ id, onClose, onStatusChange }: { id: number; onClose: () => void; onStatusChange: () => void }) {
  const qc = useQueryClient()
  const { outletId } = useAuthStore()
  const [updating, setUpdating]         = useState(false)
  const [emailSending, setEmailSending] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.getById(id).then(r => r.data.data),
  })

  const changeStatus = async (status: string) => {
    setUpdating(true)
    try {
      await quotationApi.updateStatus(id, status)
      toast.success(`Quotation ${status.toLowerCase()}`)
      qc.invalidateQueries({ queryKey: ['quotation', id] })
      onStatusChange()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const handleSendEmail = async () => {
    setEmailSending(true)
    try {
      await integrationApi.sendQuotationEmail(id, outletId!)
      toast.success(`Email sent to ${data?.customer?.email}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to send email')
    } finally { setEmailSending(false) }
  }

  const q = data

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">{q?.quotationNumber ?? '…'}</h2>
            {q?.status && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {q.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : q ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Customer</p>
                <p className="text-sm font-semibold text-gray-900">{q.customer?.name ?? 'Walk-in'}</p>
                {q.customer?.phone && <p className="text-xs text-gray-400">{q.customer.phone}</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Valid Until</p>
                <p className="text-sm font-semibold text-gray-900">
                  {q.validUntil ? format(new Date(q.validUntil), 'dd MMM yyyy') : '—'}
                </p>
                <p className="text-xs text-gray-400">Created: {format(new Date(q.createdAt), 'dd MMM yyyy')}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Product</th>
                      <th className="px-4 py-2.5 text-center">Qty</th>
                      <th className="px-4 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-center">Disc%</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {q.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.productSku && <p className="text-xs text-gray-400">{item.productSku}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">₹{Number(item.lineTotal).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{Number(q.subtotal).toLocaleString('en-IN')}</span></div>
                {Number(q.discountAmount) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>− ₹{Number(q.discountAmount).toLocaleString('en-IN')}</span></div>}
                {Number(q.taxAmount) > 0 && <div className="flex justify-between text-gray-600"><span>Tax</span><span>₹{Number(q.taxAmount).toLocaleString('en-IN')}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5"><span>Total</span><span>₹{Number(q.totalAmount).toLocaleString('en-IN')}</span></div>
              </div>
            </div>

            {/* Notes & Terms */}
            {q.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700">{q.notes}</p>
              </div>
            )}
            {q.termsConditions && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Terms & Conditions</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{q.termsConditions}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Actions footer */}
        {q && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between shrink-0 rounded-b-2xl">
            <span className="text-xs text-gray-400">
              {q.items?.length} item(s) · ₹{Number(q.totalAmount).toLocaleString('en-IN')}
            </span>
            <div className="flex gap-2">
              {q.status === 'DRAFT' && (
                <button onClick={() => changeStatus('SENT')} disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Send size={12} /> Send
                </button>
              )}
              {q.status === 'SENT' && (
                <>
                  <button onClick={() => changeStatus('ACCEPTED')} disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    <CheckCircle size={12} /> Accept
                  </button>
                  <button onClick={() => changeStatus('REJECTED')} disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                    <Ban size={12} /> Reject
                  </button>
                </>
              )}
              {q.status === 'ACCEPTED' && (
                <button onClick={() => changeStatus('CONVERTED')} disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  <ArrowRightCircle size={12} /> Convert to Order
                </button>
              )}
              {q.customer?.email && (
                <button disabled={emailSending} onClick={handleSendEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  title={`Send email to ${q.customer.email}`}>
                  {emailSending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                  Send Email
                </button>
              )}
              {(updating || emailSending) && <Loader2 size={16} className="animate-spin text-gray-400 self-center" />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function QuotationsPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const qc = useQueryClient()
  const [search, setSearch]           = useState('')
  const [statusTab, setStatusTab]     = useState('ALL')
  const [page, setPage]               = useState(0)
  const [showCreate, setShowCreate]   = useState(false)
  const [viewId, setViewId]           = useState<number | null>(null)
  const PAGE_SIZE = 15

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', oid, statusTab, page],
    queryFn: () => quotationApi.getByOutlet(oid, {
      status: statusTab === 'ALL' ? undefined : statusTab,
      page, size: PAGE_SIZE, sort: 'createdAt,desc',
    }).then(r => r.data.data),
    enabled: !!oid,
  })

  const quotations: any[]   = data?.content ?? []
  const totalPages: number  = data?.totalPages ?? 0
  const totalElements: number = data?.totalElements ?? 0

  const filtered = quotations.filter(q =>
    !search ||
    q.quotationNumber?.toLowerCase().includes(search.toLowerCase()) ||
    q.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleStatusChange = () => qc.invalidateQueries({ queryKey: ['quotations'] })

  const draftCount     = quotations.filter(q => q.status === 'DRAFT').length
  const acceptedCount  = quotations.filter(q => q.status === 'ACCEPTED').length
  const expiredCount   = quotations.filter(q => q.status === 'EXPIRED').length

  return (
    <div className="p-6">

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>

        {/* Top row */}
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <ClipboardList size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Sales</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Quotations</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search quotation # or customer…"
                className="pl-9 pr-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/30 w-64" />
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors whitespace-nowrap">
              <Plus size={16} /> New Quotation
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{totalElements}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Quotations</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{draftCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Drafts</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className={`text-xl font-bold ${acceptedCount > 0 ? 'text-emerald-300' : 'text-white'}`}>{acceptedCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Accepted</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className={`text-xl font-bold ${expiredCount > 0 ? 'text-red-300' : 'text-white'}`}>{expiredCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Expired</p>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => { setStatusTab(s); setPage(0) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusTab === s ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {totalElements > 0 && (
          <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">{totalElements} quotation{totalElements !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Quotation #</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Items</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Total</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Valid Until</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Created</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <FileText size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">
                    {search ? 'No quotations match your search' : 'No quotations yet'}
                  </p>
                  {!search && (
                    <button onClick={() => setShowCreate(true)}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      Create first quotation →
                    </button>
                  )}
                </td>
              </tr>
            ) : filtered.map((q: any) => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm font-mono font-medium text-primary-600">{q.quotationNumber}</span>
                </td>
                <td className="px-4 py-3">
                  {q.customer ? (
                    <div>
                      <p className="text-sm text-gray-900">{q.customer.name}</p>
                      <p className="text-xs text-gray-400">{q.customer.phone}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Walk-in</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-700">{q.items?.length ?? 0}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  ₹{Number(q.totalAmount ?? 0).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {q.validUntil ? format(new Date(q.validUntil), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {q.createdAt ? format(new Date(q.createdAt), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => setViewId(q.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="View">
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-xs text-gray-500">Page {page + 1} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === page ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                    {pg + 1}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateQuotationPanel
          outletId={oid}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['quotations'] })}
        />
      )}

      {viewId !== null && (
        <ViewQuotationModal
          id={viewId}
          onClose={() => setViewId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
