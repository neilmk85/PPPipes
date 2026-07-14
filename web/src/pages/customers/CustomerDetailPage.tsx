import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, User, FileText, Receipt, ShoppingBag, Edit } from 'lucide-react'
import { customerApi, invoiceApi, salesOrderPaymentApi, creditNoteApi, salesOrderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

type Tab = 'ledger' | 'invoices' | 'receipts' | 'orders'

function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0'
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtDate(d: string | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:   'bg-gray-100 text-gray-600',
  SENT:    'bg-blue-50 text-blue-700',
  PAID:    'bg-green-50 text-green-700',
  PARTIAL: 'bg-yellow-50 text-yellow-700',
  OVERDUE: 'bg-red-50 text-red-600',
}

const SO_STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  DELIVERED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const outletId = user?.outletId ?? 1
  const [tab, setTab] = useState<Tab>('ledger')

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerApi.getById(customerId).then(r => r.data.data),
    enabled: !!customerId,
  })

  const { data: invoicesRaw } = useQuery({
    queryKey: ['customer-invoices', customerId],
    queryFn: () => invoiceApi.getByCustomer(outletId, customerId).then(r => {
      const d = r.data.data
      return Array.isArray(d) ? d : (d?.content ?? [])
    }),
    enabled: !!customerId,
  })
  const invoices: any[] = invoicesRaw ?? []

  const { data: receiptsRaw } = useQuery({
    queryKey: ['customer-receipts', customerId],
    queryFn: () => salesOrderPaymentApi.getAll({ customerId, size: 500 }).then(r => {
      const d = r.data.data
      return Array.isArray(d) ? d : (d?.content ?? [])
    }),
    enabled: !!customerId,
  })
  const receipts: any[] = receiptsRaw ?? []

  const { data: creditNotesRaw } = useQuery({
    queryKey: ['customer-credit-notes', customerId],
    queryFn: () => creditNoteApi.getByCustomer(customerId).then(r => {
      const d = r.data.data
      return Array.isArray(d) ? d : (d?.content ?? [])
    }),
    enabled: !!customerId,
  })
  const creditNotes: any[] = creditNotesRaw ?? []

  const { data: salesOrdersRaw } = useQuery({
    queryKey: ['customer-sales-orders', customerId],
    queryFn: () => salesOrderApi.getAll({ customerId, size: 500 }).then(r => {
      const d = r.data.data
      return Array.isArray(d) ? d : (d?.content ?? [])
    }),
    enabled: !!customerId,
  })
  const salesOrders: any[] = salesOrdersRaw ?? []

  const totalBilled = invoices.reduce((s, inv) => s + parseFloat(inv.totalAmount ?? inv.total ?? 0), 0)
  const totalPaid = receipts.reduce((s, r) => s + parseFloat(r.amount ?? 0), 0)
  const creditNoteTotal = creditNotes.reduce((s, cn) => s + parseFloat(cn.amount ?? 0), 0)
  const outstanding = totalBilled - totalPaid - creditNoteTotal

  // Build ledger: merge invoices and receipts sorted by date
  const ledgerRows = [
    ...invoices.map(inv => ({
      date: inv.invoiceDate ?? inv.createdAt,
      type: 'Invoice' as const,
      ref: inv.invoiceNumber ?? `INV-${inv.id}`,
      debit: parseFloat(inv.totalAmount ?? inv.total ?? 0),
      credit: 0,
      status: inv.status,
      id: inv.id,
    })),
    ...receipts.map(r => ({
      date: r.paymentDate ?? r.createdAt,
      type: 'Receipt' as const,
      ref: r.referenceNumber ?? `REC-${r.id}`,
      debit: 0,
      credit: parseFloat(r.amount ?? 0),
      status: null,
      id: r.id,
    })),
    ...creditNotes.map(cn => ({
      date: cn.createdAt,
      type: 'Credit Note' as const,
      ref: cn.creditNoteNumber ?? `CN-${cn.id}`,
      debit: 0,
      credit: parseFloat(cn.amount ?? 0),
      status: cn.status,
      id: cn.id,
    })),
  ].sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())

  // Compute running balance
  let running = 0
  const ledgerWithBalance = ledgerRows.map(row => {
    running += row.debit - row.credit
    return { ...row, balance: running }
  })

  if (loadingCustomer) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
    )
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">Customer not found</div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'ledger',   label: 'Ledger',       icon: FileText },
    { key: 'invoices', label: 'Invoices',      icon: FileText },
    { key: 'receipts', label: 'Receipts',      icon: Receipt },
    { key: 'orders',   label: 'Sales Orders',  icon: ShoppingBag },
  ]

  return (
    <div>
      {/* Hero Header */}
      <div className="relative shadow-[0_4px_24px_rgba(109,40,217,0.25)] mb-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>
        <div className="relative px-8 py-5">
          {/* Row 1: back + title + edit */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/customers')}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <User size={26} className="text-amber-300" />
              <div>
                <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Customer</p>
                <h1 className="text-white text-2xl font-bold tracking-tight">{customer.name}</h1>
                <div className="flex items-center gap-3 mt-0.5">
                  {customer.city && <span className="text-white/60 text-xs">{customer.city}</span>}
                  {customer.phone && <span className="text-white/60 text-xs">{customer.phone}</span>}
                  {customer.gstin && <span className="text-white/50 text-xs font-mono">{customer.gstin}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Total Billed</p>
                <p className="text-white font-bold text-base">{fmtCur(totalBilled)}</p>
              </div>
              <div className="text-center">
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Total Paid</p>
                <p className="text-green-300 font-bold text-base">{fmtCur(totalPaid)}</p>
              </div>
              <div className="text-center">
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Outstanding</p>
                <p className={`font-bold text-base ${outstanding > 0 ? 'text-red-300' : 'text-green-300'}`}>{fmtCur(outstanding)}</p>
              </div>
              {creditNoteTotal > 0 && (
                <div className="text-center">
                  <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Credit Notes</p>
                  <p className="text-amber-300 font-bold text-base">{fmtCur(creditNoteTotal)}</p>
                </div>
              )}
              <div className="w-px h-8 bg-white/20" />
              <button
                onClick={() => navigate(`/customers/${customerId}/edit`)}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm transition-all"
              >
                <Edit size={14} /> Edit
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tab === t.key
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        {/* Ledger Tab */}
        {tab === 'ledger' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debit (Billed)</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Credit (Paid)</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerWithBalance.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No transactions yet</td></tr>
                )}
                {ledgerWithBalance.map((row, i) => (
                  <tr key={`${row.type}-${row.id}-${i}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-slate-600">{fmtDate(row.date)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        row.type === 'Invoice'
                          ? 'bg-violet-50 text-violet-700'
                          : row.type === 'Receipt'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{row.ref}</td>
                    <td className="py-3 px-4 text-right font-medium text-red-600">
                      {row.debit > 0 ? fmtCur(row.debit) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-green-600">
                      {row.credit > 0 ? fmtCur(row.credit) : '—'}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtCur(Math.abs(row.balance))}{row.balance > 0 ? ' Dr' : row.balance < 0 ? ' Cr' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              {ledgerWithBalance.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={3} className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">{fmtCur(totalBilled)}</td>
                    <td className="py-3 px-4 text-right font-bold text-green-600">{fmtCur(totalPaid + creditNoteTotal)}</td>
                    <td className={`py-3 px-4 text-right font-bold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtCur(Math.abs(outstanding))}{outstanding > 0 ? ' Dr' : outstanding < 0 ? ' Cr' : ''}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Invoices Tab */}
        {tab === 'invoices' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No invoices</td></tr>
                )}
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-violet-700 font-medium">{inv.invoiceNumber ?? `INV-${inv.id}`}</td>
                    <td className="py-3 px-4 text-slate-600">{fmtDate(inv.invoiceDate)}</td>
                    <td className="py-3 px-4 text-slate-600">{fmtDate(inv.dueDate)}</td>
                    <td className="py-3 px-4 text-right font-medium">{fmtCur(inv.totalAmount ?? inv.total)}</td>
                    <td className="py-3 px-4 text-right text-green-600">{fmtCur(inv.paidAmount ?? inv.amountPaid)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Receipts Tab */}
        {tab === 'receipts' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">No receipts</td></tr>
                )}
                {receipts.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-slate-600">{fmtDate(r.paymentDate)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{r.referenceNumber ?? '—'}</td>
                    <td className="py-3 px-4 text-slate-600 capitalize">{r.paymentMethod?.toLowerCase().replace(/_/g, ' ') ?? '—'}</td>
                    <td className="py-3 px-4 text-right font-medium text-green-600">{fmtCur(r.amount)}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{r.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              {receipts.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={3} className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Total</td>
                    <td className="py-3 px-4 text-right font-bold text-green-600">{fmtCur(totalPaid)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Sales Orders Tab */}
        {tab === 'orders' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">SO #</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesOrders.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-12 text-gray-400">No sales orders</td></tr>
                )}
                {salesOrders.map(so => (
                  <tr
                    key={so.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/sales/orders/${so.id}`)}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-violet-700 font-medium">{so.soNumber ?? `SO-${so.id}`}</td>
                    <td className="py-3 px-4 text-slate-600">{fmtDate(so.orderDate ?? so.createdAt)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SO_STATUS_COLORS[so.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {so.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{fmtCur(so.totalAmount ?? so.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
