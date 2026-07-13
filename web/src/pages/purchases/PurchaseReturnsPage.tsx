import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, RotateCcw, X, Loader2, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { purchaseReturnApi, vendorApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'

const CREDIT_METHODS = [
  { value: 'CASH',               label: 'Cash Refund' },
  { value: 'BANK_TRANSFER',      label: 'Bank Transfer' },
  { value: 'VENDOR_CREDIT',      label: 'Vendor Credit' },
  { value: 'UPI',                label: 'UPI' },
  { value: 'LEDGER_ADJUSTMENT',  label: 'Ledger Adjustment' },
]

const CREDIT_COLORS: Record<string, string> = {
  CASH:              'bg-green-50 text-green-700',
  BANK_TRANSFER:     'bg-blue-50 text-blue-700',
  VENDOR_CREDIT:     'bg-purple-50 text-purple-700',
  UPI:               'bg-orange-50 text-orange-700',
  LEDGER_ADJUSTMENT: 'bg-slate-50 text-slate-700',
}

interface PRItem { productName: string; quantity: string; unitCost: string }

// ─── New Return Modal ──────────────────────────────────────────────────────────

function SupplierAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery]   = useState(value)
  const [open, setOpen]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['vendors-search', query],
    queryFn: () => vendorApi.getAll({ search: query, size: 20 }).then(r => {
      const d = r.data.data
      return Array.isArray(d) ? d : (d?.content ?? [])
    }),
    enabled: open && query.length >= 0,
  })

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function select(name: string) { onChange(name); setQuery(name); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search supplier…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none"
      />
      {open && (data ?? []).length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {(data ?? []).map((v: any) => (
            <li key={v.id}
              onMouseDown={() => select(v.name)}
              className="px-3 py-2 text-sm text-gray-800 hover:bg-violet-50 cursor-pointer">
              {v.name}
              {v.phone && <span className="ml-2 text-xs text-gray-400">{v.phone}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NewReturnModal({ outletId, onClose }: { outletId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [supplierName, setSupplierName] = useState('')
  const [refNo, setRefNo]               = useState('')
  const [returnDate, setReturnDate]     = useState(new Date().toISOString().split('T')[0])
  const [creditMethod, setCreditMethod] = useState('VENDOR_CREDIT')
  const [reason, setReason]             = useState('')
  const [items, setItems]               = useState<PRItem[]>([{ productName: '', quantity: '', unitCost: '' }])
  const [submitting, setSubmitting]     = useState(false)

  const total = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitCost) || 0), 0)

  function addItem() { setItems(p => [...p, { productName: '', quantity: '', unitCost: '' }]) }
  function removeItem(i: number) { setItems(p => p.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, f: keyof PRItem, v: string) {
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item))
  }

  const handleSubmit = async () => {
    if (!supplierName.trim()) { toast.error('Supplier name is required'); return }
    const validItems = items.filter(i => i.productName.trim() && parseFloat(i.quantity) > 0)
    if (validItems.length === 0) { toast.error('Add at least one item with name and quantity'); return }
    if (!reason.trim()) { toast.error('Reason is required'); return }

    setSubmitting(true)
    try {
      await purchaseReturnApi.create({
        outletId,
        supplierName,
        refNo: refNo || undefined,
        returnDate,
        creditMethod,
        reason,
        items: validItems.map(i => ({
          productName:      i.productName.trim(),
          returnedQuantity: parseFloat(i.quantity) || 0,
          unitCost:         parseFloat(i.unitCost) || 0,
        })),
      })
      toast.success('Purchase return recorded')
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
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
          <h2 className="text-lg font-bold text-gray-900">New Purchase Return</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          {/* Row 1: Supplier + Ref No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Supplier Name <span className="text-red-400">*</span>
              </label>
              <SupplierAutocomplete value={supplierName} onChange={setSupplierName} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Original Bill / PO No.</label>
              <input value={refNo} onChange={e => setRefNo(e.target.value)}
                placeholder="e.g. PO-2024-001"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
            </div>
          </div>

          {/* Row 2: Date + Credit Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Return Date</label>
              <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Credit Method</label>
              <select value={creditMethod} onChange={e => setCreditMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none">
                {CREDIT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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
                    <th className="px-3 py-2 text-right w-32">Unit Cost (₹)</th>
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
                        <input type="number" min={0} value={item.unitCost}
                          onChange={e => updateItem(i, 'unitCost', e.target.value)}
                          placeholder="0.00"
                          className="w-full text-right border-0 outline-none text-sm text-gray-800 placeholder-gray-300" />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-gray-700">
                        ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0)).toFixed(2)}
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
              placeholder="e.g. Damaged goods, wrong items received…"
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

export default function PurchaseReturnsPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [page, setPage]           = useState(0)
  const PAGE_SIZE = 15

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-returns', oid, page],
    queryFn: () => purchaseReturnApi.getByOutlet(oid, { page, size: PAGE_SIZE, sort: 'createdAt,desc' })
      .then(r => r.data.data),
    enabled: !!oid,
  })

  const returns: any[]  = data?.content ?? []
  const totalPages: number = data?.totalPages ?? 0
  const totalElements: number = data?.totalElements ?? 0

  const filtered = returns.filter(r =>
    !search ||
    r.returnNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.purchaseOrder?.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.purchaseOrder?.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
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
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Purchases</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Purchase Returns</h1>
            </div>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors">
            <Plus size={15} /> New Return
          </button>
        </div>
        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-3 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{totalElements}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Returns</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">₹{returns.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0).toLocaleString('en-IN')}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Value (current page)</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{new Set(returns.map(r => r.purchaseOrder?.supplier?.name).filter(Boolean)).size}</p>
            <p className="text-violet-200 text-xs mt-0.5">Suppliers (current page)</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search return #, PO # or supplier…"
          className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.14), 0 2px 8px -2px rgba(0,0,0,0.08)' }}>
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Return #</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">PO Number</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Supplier</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Items</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Credit Method</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Return Value</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Reason</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(8).fill(0).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <RotateCcw size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">
                    {search ? 'No returns match your search' : 'No purchase returns yet'}
                  </p>
                  {!search && (
                    <button onClick={() => setShowModal(true)}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      Process first return →
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono font-medium text-primary-600">{r.returnNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {r.purchaseOrder?.poNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-900">{r.purchaseOrder?.supplier?.name ?? '—'}</p>
                      {r.purchaseOrder?.supplier?.phone && (
                        <p className="text-xs text-gray-400">{r.purchaseOrder.supplier.phone}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {r.items?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${CREDIT_COLORS[r.creditMethod] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.creditMethod?.replace('_', ' ') ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    ₹{Number(r.totalAmount ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="text-xs text-gray-500 truncate" title={r.reason}>{r.reason ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy') : '—'}
                  </td>
                </tr>
              ))
            )}
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

      {showModal && (
        <NewReturnModal outletId={oid} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
