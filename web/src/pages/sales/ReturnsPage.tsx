import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, RotateCcw, X, Loader2, Plus, Trash2 } from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns'
import toast from 'react-hot-toast'
import { saleReturnApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import CustomerSearchInput from '@/components/CustomerSearchInput'

const REFUND_METHODS = ['CASH', 'CARD', 'UPI', 'CREDIT_NOTE']

interface ReturnItem { productName: string; quantity: string; unitPrice: string }

// ─── Return Modal ──────────────────────────────────────────────────────────────

function ProcessReturnModal({ onClose, outletId }: { onClose: () => void; outletId: number }) {
  const qc = useQueryClient()
  const [customer, setCustomer] = useState<{ id: number; name: string; phone?: string } | null>(null)
  const [refNo, setRefNo] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('CASH')
  const [items, setItems] = useState<ReturnItem[]>([{ productName: '', quantity: '', unitPrice: '' }])
  const [submitting, setSubmitting] = useState(false)

  const total = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0)

  function addItem() { setItems(p => [...p, { productName: '', quantity: '', unitPrice: '' }]) }
  function removeItem(i: number) { setItems(p => p.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, f: keyof ReturnItem, v: string) {
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item))
  }

  async function handleSubmit() {
    const validItems = items.filter(i => i.productName.trim() && parseFloat(i.quantity) > 0)
    if (validItems.length === 0) { toast.error('Add at least one item with name and quantity'); return }
    if (!reason.trim()) { toast.error('Reason is required'); return }
    setSubmitting(true)
    try {
      await saleReturnApi.create({
        outletId,
        customerId: customer?.id ?? undefined,
        customerName: customer?.name || undefined,
        refNo: refNo || undefined,
        returnDate,
        reason,
        returnMethod: refundMethod,
        items: validItems.map(i => ({
          productName: i.productName.trim(),
          quantity: parseFloat(i.quantity) || 0,
          unitPrice: parseFloat(i.unitPrice) || 0,
        })),
      })
      toast.success('Sale return recorded')
      qc.invalidateQueries({ queryKey: ['sale-returns'] })
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to record return')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-900">New Sale Return</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          {/* Row 1: Customer + Ref No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <CustomerSearchInput
                label="Customer"
                value={customer}
                onSelect={c => setCustomer(c)}
                onClear={() => setCustomer(null)}
                placeholder="Search customer (optional)"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Original Bill / Invoice No.</label>
              <input value={refNo} onChange={e => setRefNo(e.target.value)}
                placeholder="e.g. INV-2024-001"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
            </div>
          </div>

          {/* Row 2: Date + Refund Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Return Date</label>
              <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Refund Method</label>
              <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none">
                {REFUND_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500">Items Returned</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium">
                <Plus size={13} /> Add Item
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
                    <th className="px-3 py-2 text-left">Product / Description</th>
                    <th className="px-3 py-2 text-center w-24">Qty</th>
                    <th className="px-3 py-2 text-right w-32">Unit Price (₹)</th>
                    <th className="px-3 py-2 text-right w-28">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)}
                          placeholder="Product name"
                          className="w-full border-0 outline-none text-sm text-gray-800 placeholder-gray-300" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min={0} value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', e.target.value)}
                          placeholder="0"
                          className="w-full text-center border-0 outline-none text-sm text-gray-800 placeholder-gray-300" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min={0} value={item.unitPrice}
                          onChange={e => updateItem(i, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full text-right border-0 outline-none text-sm text-gray-800 placeholder-gray-300" />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-gray-700">
                        ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                      </td>
                      <td className="px-2 py-2">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-2 pr-10">
              <span className="text-sm font-bold text-gray-800">Total: ₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Reason <span className="text-red-400">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="Reason for return…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Save Return · ₹{total.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', UPI: 'UPI',
  NET_BANKING: 'Net Banking', CREDIT_NOTE: 'Credit Note',
  LOYALTY_POINTS: 'Loyalty Points', CREDIT_SALE: 'Credit Sale',
}

const METHOD_COLORS: Record<string, string> = {
  CASH: 'bg-green-100 text-green-700',
  CARD: 'bg-blue-100 text-blue-700',
  UPI: 'bg-purple-100 text-purple-700',
  NET_BANKING: 'bg-indigo-100 text-indigo-700',
  CREDIT_NOTE: 'bg-orange-100 text-orange-700',
  LOYALTY_POINTS: 'bg-yellow-100 text-yellow-700',
  CREDIT_SALE: 'bg-red-100 text-red-700',
}

function fmtMethod(method: string | undefined) {
  if (!method) return null
  const key = method.toUpperCase()
  return { label: METHOD_LABELS[key] ?? method, color: METHOD_COLORS[key] ?? 'bg-gray-100 text-gray-700' }
}

const today = new Date()
const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

const DATE_PRESETS = [
  { label: 'Today',        from: fmt(today),                            to: fmt(today) },
  { label: 'Yesterday',    from: fmt(subDays(today, 1)),                to: fmt(subDays(today, 1)) },
  { label: 'This Week',    from: fmt(startOfWeek(today, { weekStartsOn: 1 })), to: fmt(endOfWeek(today, { weekStartsOn: 1 })) },
  { label: 'Last Week',    from: fmt(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })), to: fmt(endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })) },
  { label: 'This Month',   from: fmt(startOfMonth(today)),              to: fmt(endOfMonth(today)) },
  { label: 'Last Month',   from: fmt(startOfMonth(subMonths(today, 1))), to: fmt(endOfMonth(subMonths(today, 1))) },
  { label: 'Last 30 Days', from: fmt(subDays(today, 29)),               to: fmt(today) },
  { label: 'Last 90 Days', from: fmt(subDays(today, 89)),               to: fmt(today) },
  { label: 'This Quarter', from: fmt(startOfQuarter(today)),            to: fmt(endOfQuarter(today)) },
  { label: 'Last Quarter', from: fmt(startOfQuarter(subQuarters(today, 1))), to: fmt(endOfQuarter(subQuarters(today, 1))) },
]

export default function ReturnsPage() {
  const { outletId } = useAuthStore()
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [from, setFrom] = useState(fmt(subDays(today, 29)))
  const [to,   setTo]   = useState(fmt(today))
  const [activePreset, setActivePreset] = useState('Last 30 Days')

  function applyPreset(preset: typeof DATE_PRESETS[0]) {
    setFrom(preset.from)
    setTo(preset.to)
    setActivePreset(preset.label)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['sale-returns', outletId, from, to],
    queryFn: () => saleReturnApi.getAll(outletId ?? 1, { from, to }).then(r => r.data.data),
  })

  const returns: any[] = data?.content ?? []

  const filtered = returns.filter((o: any) =>
    !search ||
    o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const total = filtered.reduce((s: number, o: any) => s + Math.abs(parseFloat(String(o.totalAmount ?? 0))), 0)

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6">
      {/* Hero Header */}
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
            <RotateCcw size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Sales</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Returns</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm" />
            <span className="text-white/60 text-sm">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm" />
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors">
              <Plus size={15} /> Process Return
            </button>
          </div>
        </div>
        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-2 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{filtered.length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Returns</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Refund Amount</p>
          </div>
        </div>
        {/* Date presets */}
        <div className="relative border-t border-white/10 px-8 py-3 flex flex-wrap gap-1.5">
          {DATE_PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activePreset === p.label
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search order or customer…"
          className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Return #</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Items Returned</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Refund Amount</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Refund Method</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Reason</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <RotateCcw size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">No returns found</p>
                </td>
              </tr>
            ) : filtered.map((o: any) => {
              const method = fmtMethod(o.payments?.[0]?.paymentMethod ?? o.notes)
              return (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm text-violet-600">{o.orderNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{o.customer?.name ?? 'Walk-in'}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-600">
                  {o.items?.reduce((s: number, i: any) => s + parseFloat(String(i.quantity ?? 0)), 0)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-right text-red-600">
                  ₹{Math.abs(parseFloat(String(o.totalAmount ?? 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  {method
                    ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${method.color}`}>{method.label}</span>
                    : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                  {o.items?.[0]?.notes ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(o.createdAt)}</td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ProcessReturnModal onClose={() => setShowModal(false)} outletId={outletId ?? 1} />
      )}
    </div>
    </div>
  )
}
