import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, CheckCircle2, Truck, XCircle,
  Factory, User, Calendar, MapPin, Edit2, Loader2,
  ChevronRight, Package, Zap, AlertCircle, Clock, X,
  IndianRupee, Plus,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { salesOrderApi, salesOrderPaymentApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const PAYMENT_METHODS = ['NEFT', 'RTGS', 'CHEQUE', 'CASH', 'UPI', 'IMPS', 'BANK_TRANSFER']
const PM_COLOR: Record<string, string> = {
  NEFT: 'bg-blue-50 text-blue-700', RTGS: 'bg-indigo-50 text-indigo-700',
  CHEQUE: 'bg-amber-50 text-amber-700', CASH: 'bg-green-50 text-green-700',
  UPI: 'bg-purple-50 text-purple-700', IMPS: 'bg-cyan-50 text-cyan-700',
  BANK_TRANSFER: 'bg-gray-100 text-gray-700',
}

function RecordPaymentModal({ salesOrderId, soNumber, balance, onClose }: {
  salesOrderId: number; soNumber: string; balance: number; onClose: () => void
}) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [amount, setAmount]       = useState(balance > 0 ? balance.toFixed(2) : '')
  const [method, setMethod]       = useState('NEFT')
  const [refNo, setRefNo]         = useState('')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      await salesOrderPaymentApi.record(salesOrderId, {
        amount: amt, paymentMethod: method,
        referenceNumber: refNo || undefined,
        paymentDate: date,
        notes: notes || undefined,
      })
      toast.success('Payment recorded')
      qc.invalidateQueries({ queryKey: ['so-payments', salesOrderId] })
      onClose()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to record payment')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-bold text-gray-900">Record Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">{soNumber}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (₹) *</label>
              <input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Payment Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Payment Method *</label>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Reference / UTR No.</label>
              <input value={refNo} onChange={e => setRefNo(e.target.value)}
                placeholder="e.g. UTR123456"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Payment
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:               { label: 'Draft',             color: 'text-gray-600',   bg: 'bg-gray-100',    border: 'border-gray-200'   },
  CONFIRMED:           { label: 'Confirmed',          color: 'text-blue-700',   bg: 'bg-blue-50',     border: 'border-blue-200'   },
  IN_PRODUCTION:       { label: 'In Production',      color: 'text-amber-700',  bg: 'bg-amber-50',    border: 'border-amber-200'  },
  PROCESSING:          { label: 'Processing',         color: 'text-orange-700', bg: 'bg-orange-50',   border: 'border-orange-200' },
  PARTIALLY_DELIVERED: { label: 'Partially Delivered',color: 'text-purple-700', bg: 'bg-purple-50',   border: 'border-purple-200' },
  DELIVERED:           { label: 'Delivered',          color: 'text-teal-700',   bg: 'bg-teal-50',     border: 'border-teal-200'   },
  INVOICED:            { label: 'Invoiced',           color: 'text-green-700',  bg: 'bg-green-50',    border: 'border-green-200'  },
  CANCELLED:           { label: 'Cancelled',          color: 'text-red-600',    bg: 'bg-red-50',      border: 'border-red-200'    },
  ON_HOLD:             { label: 'On Hold',            color: 'text-slate-600',  bg: 'bg-slate-100',   border: 'border-slate-200'  },
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}
function ConfirmDialog({ title, message, confirmLabel, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        {/* Icon + close */}
        <div className="flex items-start justify-between gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <Factory size={20} className="text-amber-500" />
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        {/* Text */}
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
        </div>
        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-60">
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
              : <><Zap size={14} /> {confirmLabel}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.DRAFT
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${c.bg} ${c.color} ${c.border}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
      {c.label}
    </span>
  )
}

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { outletId } = useAuthStore()
  const [convertingItem, setConvertingItem] = useState<number | null>(null)
  const [convertingAll, setConvertingAll]   = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [confirm, setConfirm] = useState<{ type: 'item'; itemId: number; name: string } | { type: 'all' } | null>(null)

  const { data: so, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => salesOrderApi.getById(Number(id)).then(r => r.data.data),
    enabled: !!id,
  })

  const { data: paymentsData } = useQuery({
    queryKey: ['so-payments', Number(id)],
    queryFn: () => salesOrderPaymentApi.getForOrder(Number(id)).then(r => r.data.data ?? []),
    enabled: !!id,
  })
  const payments: any[] = paymentsData ?? []
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount ?? 0), 0)
  const balance = Math.max(0, parseFloat(so?.totalAmount ?? 0) - totalPaid)

  const pipeItems    = (so?.items ?? []).filter((i: any) => i.pipeConfigId)
  const convertedCnt = pipeItems.filter((i: any) => i.productionOrderId).length
  const pendingCnt   = pipeItems.length - convertedCnt
  const totalPipes   = pipeItems.reduce((sum: number, i: any) => sum + Number(i.quantity), 0)
  const totalMeters  = +pipeItems.reduce((sum: number, i: any) =>
    sum + Number(i.quantity) * (i.pipeConfig?.lengthM ?? 5.25), 0).toFixed(2)

  async function handleConvertItem(itemId: number) {
    setConvertingItem(itemId)
    try {
      const res = await salesOrderApi.convertItemToPO(itemId, outletId ?? 1)
      toast.success(`Production Order ${res.data.data?.poNumber} created!`)
      qc.invalidateQueries({ queryKey: ['sales-order', id] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to convert to Production Order')
    } finally {
      setConvertingItem(null)
    }
  }

  async function handleConvertAll() {
    setConvertingAll(true)
    try {
      const res = await salesOrderApi.convertAllToPOs(Number(id), outletId ?? 1)
      const count = res.data.data?.length ?? 0
      toast.success(`${count} Production Order${count !== 1 ? 's' : ''} created!`)
      qc.invalidateQueries({ queryKey: ['sales-order', id] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to convert orders')
    } finally {
      setConvertingAll(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/60 flex items-center justify-center">
        <Loader2 size={28} className="text-slate-400 animate-spin" />
      </div>
    )
  }

  if (!so) {
    return (
      <div className="min-h-screen bg-gray-50/60 p-6">
        <p className="text-gray-400">Sales order not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales-orders')}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors">
            <ArrowLeft size={16} className="text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{so.soNumber}</h1>
              <StatusBadge status={so.status} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Created {so.createdAt ? format(new Date(so.createdAt), 'dd MMM yyyy, h:mm a') : '—'}
            </p>
          </div>
        </div>
        <button onClick={() => setShowPaymentModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-sm shadow-sm transition-all">
          <Plus size={15} /> Record Payment
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* Left col: order info + items */}
        <div className="col-span-2 space-y-5">

          {/* Production conversion banner */}
          {pipeItems.length > 0 && (
            <div className={`rounded-2xl border-2 px-5 py-4 flex items-center justify-between ${
              convertedCnt === pipeItems.length
                ? 'bg-green-50 border-green-200'
                : pendingCnt > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  convertedCnt === pipeItems.length ? 'bg-green-100' : 'bg-amber-100'
                }`}>
                  <Factory size={17} className={convertedCnt === pipeItems.length ? 'text-green-600' : 'text-amber-600'} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {convertedCnt === pipeItems.length
                      ? 'All pipe items sent to production'
                      : `${pendingCnt} pipe item${pendingCnt !== 1 ? 's' : ''} pending conversion`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {convertedCnt} of {pipeItems.length} converted to Production Orders
                  </p>
                </div>
              </div>
              {/* Mini progress bar */}
              <div className="w-36">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{convertedCnt}</span><span>{pipeItems.length}</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${convertedCnt === pipeItems.length ? 'bg-green-500' : 'bg-amber-500'}`}
                    style={{ width: pipeItems.length > 0 ? `${(convertedCnt / pipeItems.length) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Master PO Summary */}
          {pipeItems.length > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-6 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-500">
                Sales Order Summary
              </p>
              <div className="grid grid-cols-2 divide-x divide-blue-100">
                <div className="pr-6 text-center">
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">{totalPipes.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-gray-500">Total Number of Pipes</p>
                </div>
                <div className="pl-6 text-center">
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">{totalMeters.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-gray-500">Total Length in Meters</p>
                </div>
              </div>
            </div>
          )}

          {/* Line items table */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-gray-100">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Package size={18} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Pipe Line Items</h2>
                  <p className="text-xs text-blue-100 mt-0.5">{(so.items ?? []).length} item{(so.items ?? []).length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-blue-100">Order Total</p>
                  <p className="text-sm font-bold text-white tabular-nums">
                    ₹{parseFloat(so.totalAmount ?? 0).toLocaleString('en-IN')}
                  </p>
                </div>
                {pendingCnt > 0 && (
                  <button onClick={() => setConfirm({ type: 'all' })} disabled={convertingAll}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-xs font-bold rounded-lg disabled:opacity-60 transition-all">
                    {convertingAll ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                    Convert All ({pendingCnt})
                  </button>
                )}
                {(so.status === 'DRAFT' || so.status === 'CONFIRMED') && (
                  <button onClick={() => navigate(`/sales-orders/${id}/edit`)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold rounded-lg transition-all">
                    <Edit2 size={13} /> Edit
                  </button>
                )}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200">
                  <th className="px-6 py-3 text-left   text-[11px] font-bold text-slate-500 uppercase tracking-widest">Pipe / Product</th>
                  <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Qty</th>
                  <th className="px-6 py-3 text-right  text-[11px] font-bold text-slate-500 uppercase tracking-widest">Unit Price</th>
                  <th className="px-6 py-3 text-right  text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Production</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(so.items ?? []).map((item: any) => {
                  const isPipe     = !!item.pipeConfigId
                  const isConverted = !!item.productionOrderId
                  const isConverting = convertingItem === item.id
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{item.productName}</p>
                          {item.pipeConfig && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {item.pipeConfig.diameterMm}mm · {item.pipeConfig.pressureClass}
                            </p>
                          )}
                          {item.sku && <p className="text-xs text-gray-400 mt-0.5">{item.sku}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-800">
                        {parseFloat(item.quantity).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 tabular-nums">
                        ₹{parseFloat(item.unitPrice).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900 tabular-nums">
                        ₹{parseFloat(item.lineTotal ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {!isPipe ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : isConverted ? (
                          <Link to={`/production/orders`}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors">
                            <CheckCircle2 size={12} />
                            {item.productionOrder?.poNumber ?? 'PO Created'}
                          </Link>
                        ) : (
                          <button
                            onClick={() => setConfirm({ type: 'item', itemId: item.id, name: item.productName })}
                            disabled={isConverting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-bold rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-60 shadow-sm transition-all">
                            {isConverting
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Factory size={12} />}
                            {isConverting ? 'Creating…' : 'Convert to PO'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-violet-50 border-t-2 border-violet-200">
                  <td colSpan={3} className="px-6 py-3 text-xs font-bold text-violet-700 uppercase tracking-widest">Order Total</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">
                    ₹{parseFloat(so.totalAmount ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right col: order meta */}
        <div className="space-y-4">

          {/* Customer card */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-gray-100">
            <div className="px-5 py-4 bg-gradient-to-r from-violet-600 to-blue-600 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <User size={15} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Customer</h3>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-base font-bold text-gray-900">{so.customer?.name}</p>
                {so.customer?.phone && <p className="text-xs text-gray-500 mt-0.5">{so.customer.phone}</p>}
                {so.customer?.email && <p className="text-xs text-gray-500">{so.customer.email}</p>}
              </div>
              {so.shippingAddress && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-start gap-1.5">
                    <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600">
                      {[so.shippingAddress, so.shippingCity, so.shippingState].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order details card */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-gray-100">
            <div className="px-5 py-4 bg-gradient-to-r from-violet-600 to-blue-600 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <Calendar size={15} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Order Details</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {[
                { label: 'Order Date',    value: so.orderDate    ? format(new Date(so.orderDate),    'dd MMM yyyy') : '—' },
                { label: 'Required By',  value: so.requiredDate ? format(new Date(so.requiredDate), 'dd MMM yyyy') : '—', urgent: !!so.requiredDate },
                { label: 'Payment Terms',value: so.paymentTerms ?? '—' },
                { label: 'Customer PO',  value: so.customerPoNumber ?? '—' },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-start gap-2">
                  <span className="text-gray-400 text-xs">{r.label}</span>
                  <span className={`font-semibold text-xs text-right ${r.urgent ? 'text-orange-600' : 'text-gray-800'}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Financials card */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-gray-100">
            <div className="px-5 py-4 bg-gradient-to-r from-violet-600 to-blue-600 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <FileText size={15} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Financials</h3>
            </div>
            <div className="p-5 space-y-2 text-sm">
              {[
                { label: 'Subtotal',   value: `₹${parseFloat(so.subtotal ?? 0).toLocaleString('en-IN')}` },
                { label: 'Discount',   value: `−₹${parseFloat(so.discountAmount ?? 0).toLocaleString('en-IN')}`, red: parseFloat(so.discountAmount) > 0 },
                { label: 'Tax',        value: `₹${parseFloat(so.taxAmount ?? 0).toLocaleString('en-IN')}` },
                { label: 'Shipping',   value: `₹${parseFloat(so.shippingAmount ?? 0).toLocaleString('en-IN')}` },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-gray-400 text-xs">{r.label}</span>
                  <span className={`font-medium text-xs tabular-nums ${r.red ? 'text-green-600' : 'text-gray-700'}`}>{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total</span>
                <span className="font-bold text-gray-900 tabular-nums">₹{parseFloat(so.totalAmount ?? 0).toLocaleString('en-IN')}</span>
              </div>
              {parseFloat(so.advanceAmount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Advance Paid</span>
                  <span className="font-semibold text-xs text-green-600 tabular-nums">₹{parseFloat(so.advanceAmount).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Payments</p>
              <button onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800">
                <Plus size={12} /> Add
              </button>
            </div>
            {payments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No payments recorded yet</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${PM_COLOR[p.paymentMethod] ?? 'bg-gray-100 text-gray-700'}`}>
                        {p.paymentMethod}
                      </span>
                      <span className="text-gray-400">{p.paymentDate?.slice(0, 10)}</span>
                      {p.referenceNumber && <span className="text-gray-400 font-mono">{p.referenceNumber}</span>}
                    </div>
                    <span className="font-semibold text-green-700 tabular-nums">₹{parseFloat(p.amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total Paid</span>
                <span className="font-semibold text-green-700 tabular-nums">₹{totalPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold">Balance Due</span>
                <span className={`font-bold tabular-nums ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{balance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {so.notes && (
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
              <p className="text-sm text-gray-600 leading-relaxed">{so.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Record Payment Modal ── */}
      {showPaymentModal && so && (
        <RecordPaymentModal
          salesOrderId={so.id}
          soNumber={so.soNumber}
          balance={balance}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* ── Confirmation dialog ── */}
      {confirm && (
        <ConfirmDialog
          title={confirm.type === 'all'
            ? `Convert ${pendingCnt} item${pendingCnt !== 1 ? 's' : ''} to Production Orders?`
            : 'Convert to Production Order?'}
          message={confirm.type === 'all'
            ? `This will create ${pendingCnt} new Production Order${pendingCnt !== 1 ? 's' : ''} for all pending pipe items in ${so.soNumber}. This action cannot be undone.`
            : `This will create a new Production Order for "${confirm.name}". Once created it cannot be undone.`}
          confirmLabel={confirm.type === 'all' ? `Convert All (${pendingCnt})` : 'Convert to PO'}
          loading={confirm.type === 'all' ? convertingAll : convertingItem === (confirm as any).itemId}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.type === 'all') {
              await handleConvertAll()
            } else {
              await handleConvertItem((confirm as any).itemId)
            }
            setConfirm(null)
          }}
        />
      )}
    </div>
  )
}
