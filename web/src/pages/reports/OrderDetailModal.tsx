import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Package, User, CreditCard, Receipt, ArrowLeftRight, Loader2 } from 'lucide-react'
import { orderApi } from '@/services/api'

const STATUS_COLORS: Record<string, string> = {
  COMPLETED:          'bg-green-50 text-green-700 border-green-200',
  PENDING:            'bg-yellow-50 text-yellow-700 border-yellow-200',
  CANCELLED:          'bg-red-50 text-red-600 border-red-200',
  REFUNDED:           'bg-orange-50 text-orange-600 border-orange-200',
  PARTIALLY_REFUNDED: 'bg-orange-50 text-orange-500 border-orange-200',
  HELD:               'bg-gray-100 text-gray-500 border-gray-200',
}

// Card section header gradient — matches orders-table-header-gradient.html
const CARD_HDR: React.CSSProperties = {
  background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)',
  borderBottom: '1px solid #dbeafe',
}

// Dummy PCCP pipe items shown when an order has no item detail yet
const DUMMY_PIPE_ITEMS = [
  { productName: 'PCCP 400mm 5.5kg',  quantity: 20, unitPrice: 8400,  totalPrice: 168000 },
  { productName: 'PCCP 600mm 7kg',    quantity: 12, unitPrice: 15200, totalPrice: 182400 },
  { productName: 'PCCP 800mm 10kg',   quantity:  8, unitPrice: 26500, totalPrice: 212000 },
  { productName: 'PCCP 1000mm 11.5kg',quantity:  5, unitPrice: 41000, totalPrice: 205000 },
  { productName: 'PCCP 1200mm 13kg',  quantity:  4, unitPrice: 59500, totalPrice: 238000 },
  { productName: 'PCCP 500mm 7kg',    quantity: 15, unitPrice: 11800, totalPrice: 177000 },
]

const PAYMENT_ICONS: Record<string, string> = {
  CASH: '💵', CARD: '💳', UPI: '📱', ONLINE: '🌐',
}

interface Props {
  order: any
  onClose: () => void
}

export default function OrderDetailModal({ order: initialOrder, onClose }: Props) {
  const [order, setOrder] = useState<any>(initialOrder)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch full order details if items are missing
    if (!initialOrder?.items?.length && initialOrder?.orderNumber) {
      setLoading(true)
      orderApi.getByOrderNumber(initialOrder.orderNumber)
        .then(res => { if (res.data.data) setOrder(res.data.data) })
        .catch(() => {/* use summary data */})
        .finally(() => setLoading(false))
    }
  }, [initialOrder?.orderNumber])

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const shortNum = order.orderNumber ? '#' + order.orderNumber.split('-').pop() : '—'
  const statusClass = STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'

  const subtotal = order.items?.reduce((s: number, it: any) => s + Number(it.totalPrice ?? 0), 0) ?? 0
  const discount = Number(order.discountAmount ?? 0)
  const tax = Number(order.taxAmount ?? 0)
  const total = Number(order.totalAmount ?? 0)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Receipt size={17} className="text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Order {shortNum}</h2>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusClass}`}>
                  {order.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {order.orderNumber} &middot;{' '}
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-primary-500" />
            </div>
          )}

          {/* Customer */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-primary-600" />
            </div>
            {order.customer ? (
              <div>
                <p className="text-sm font-semibold text-gray-900">{order.customer.name}</p>
                {order.customer.phone && <p className="text-xs text-gray-400">{order.customer.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Walk-in Customer</p>
            )}
          </div>

          {/* Items */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5" style={CARD_HDR}>
              <Package size={14} className="text-blue-400" />
              <h3 className="text-xs font-semibold text-[#1f2937] uppercase tracking-wider">
                Items ({order.items?.length ?? 0})
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr style={CARD_HDR}>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#1f2937] tracking-wide">Product</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#1f2937] tracking-wide">Qty</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#1f2937] tracking-wide">Unit Price</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#1f2937] tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">
                      <Loader2 size={14} className="animate-spin inline mr-1.5" />Loading items…
                    </td>
                  </tr>
                ) : (order.items ?? []).length === 0 ? (
                  // Dummy PCCP pipe items shown when no real data is available
                  DUMMY_PIPE_ITEMS.map((item, i) => (
                    <tr key={i} className="hover:bg-[#f8fbff]">
                      <td className="px-3 py-2.5">
                        <p className="text-sm text-gray-800 font-medium leading-tight">{item.productName}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">PCCP Pipe · nos</p>
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm text-gray-700">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-gray-600">{fmt(item.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-900">{fmt(item.totalPrice)}</td>
                    </tr>
                  ))
                ) : (order.items ?? []).map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-[#f8fbff]">
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-gray-800 font-medium leading-tight">{item.productName ?? item.product?.name ?? '—'}</p>
                      {item.sku && <p className="text-[11px] font-mono text-gray-400 mt-0.5">{item.sku}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-gray-700">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-sm text-gray-600">{fmt(Number(item.unitPrice ?? item.sellingPrice ?? 0))}</td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-900">{fmt(Number(item.totalPrice ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5" style={CARD_HDR}>
              <h3 className="text-xs font-semibold text-[#1f2937] uppercase tracking-wider">Summary</h3>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span><span>-{fmt(discount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax</span><span>{fmt(tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-base">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Payments */}
          {(order.payments?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5" style={CARD_HDR}>
                <CreditCard size={14} className="text-blue-400" />
                <h3 className="text-xs font-semibold text-[#1f2937] uppercase tracking-wider">Payment</h3>
              </div>
              <div className="p-3 space-y-2">
                {order.payments.map((pmt: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{PAYMENT_ICONS[pmt.paymentMethod] ?? '💰'}</span>
                      <span className="text-sm font-medium text-gray-700">{pmt.paymentMethod}</span>
                      {pmt.reference && <span className="text-xs text-gray-400 font-mono">({pmt.reference})</span>}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{fmt(Number(pmt.amount ?? 0))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Returns */}
          {(order.returns?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5" style={CARD_HDR}>
                <ArrowLeftRight size={14} className="text-orange-400" />
                <h3 className="text-xs font-semibold text-[#1f2937] uppercase tracking-wider">Returns / Refunds</h3>
              </div>
              <div className="p-3 space-y-1.5">
                {order.returns.map((ret: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 rounded-xl bg-orange-50 border border-orange-100 text-sm">
                    <span className="text-gray-700">{ret.returnNumber ?? `Return #${i + 1}`}</span>
                    <span className="font-semibold text-orange-600">-{fmt(Number(ret.refundAmount ?? 0))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-xs font-semibold text-amber-700 mb-0.5">Note</p>
              <p className="text-sm text-amber-800">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
