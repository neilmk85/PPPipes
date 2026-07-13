import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Landmark, TrendingUp, IndianRupee, Plus, X } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { salesOrderPaymentApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'
import CustomerSearchInput from '@/components/CustomerSearchInput'

const METHOD_COLORS: Record<string, string> = {
  NEFT:          'bg-blue-50 text-blue-700',
  RTGS:          'bg-indigo-50 text-indigo-700',
  CHEQUE:        'bg-amber-50 text-amber-700',
  CASH:          'bg-green-50 text-green-700',
  UPI:           'bg-purple-50 text-purple-700',
  IMPS:          'bg-cyan-50 text-cyan-700',
  BANK_TRANSFER: 'bg-gray-100 text-gray-700',
}

const METHOD_GRADIENTS: Record<string, string> = {
  NEFT:          'from-blue-500 to-blue-600',
  RTGS:          'from-indigo-500 to-indigo-600',
  CHEQUE:        'from-amber-400 to-amber-500',
  CASH:          'from-green-500 to-emerald-600',
  UPI:           'from-purple-500 to-violet-600',
  IMPS:          'from-cyan-500 to-cyan-600',
  BANK_TRANSFER: 'from-gray-400 to-gray-500',
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#64748b']
const RADIAN = Math.PI / 180

function isoStartOfMonth() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function isoToday() { return new Date().toISOString().slice(0, 10) }

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null
  const r = innerRadius + (outerRadius - innerRadius) * 1.4
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>{`${(percent * 100).toFixed(0)}%`}</text>
}

const PAYMENT_METHODS = ['NEFT', 'RTGS', 'CHEQUE', 'UPI', 'IMPS', 'BANK_TRANSFER', 'CASH']

interface RecordPaymentModalProps {
  onClose: () => void
  onSaved: () => void
}

function RecordPaymentModal({ onClose, onSaved }: RecordPaymentModalProps) {
  const { outletId } = useAuthStore()
  const [customer, setCustomer]   = useState<any>(null)
  const [amount, setAmount]       = useState('')
  const [method, setMethod]       = useState('NEFT')
  const [date, setDate]           = useState(isoToday())
  const [reference, setReference] = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) { setError('Please select a customer'); return }
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount'); return }
    setError('')
    setSaving(true)
    try {
      await salesOrderPaymentApi.create({
        customerId: customer.id,
        outletId: outletId!,
        amount: parseFloat(amount),
        paymentMethod: method,
        paymentDate: date,
        referenceNumber: reference || undefined,
        notes: notes || undefined,
      })
      onSaved()
      onClose()
    } catch {
      setError('Failed to record payment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Record Receipt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer *</label>
            <CustomerSearchInput value={customer} onSelect={setCustomer} onClear={() => setCustomer(null)} label="" placeholder="Search customer…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₹) *</label>
              <input
                type="number" min="0.01" step="0.01" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Date *</label>
              <input
                type="date" value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Method *</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none bg-white">
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reference / UTR No.</label>
            <input
              type="text" value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : 'Record Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PaymentsReceivedPage() {
  const { outletId } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab]     = useState<'summary' | 'transactions'>('summary')
  const [search, setSearch] = useState('')
  const [from, setFrom]   = useState(isoStartOfMonth())
  const [to,   setTo]     = useState(isoToday())
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['so-payments-all', outletId, from, to],
    queryFn: () => salesOrderPaymentApi.getAll({ outletId: outletId ?? undefined, from, to, size: 500 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    enabled: !!outletId,
  })

  const payments: any[] = data ?? []

  const filtered = payments.filter((p: any) =>
    !search ||
    p.salesOrder?.soNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.salesOrder?.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.paymentMethod?.toLowerCase().includes(search.toLowerCase()) ||
    (p.referenceNumber ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const total = filtered.reduce((s: number, p: any) => s + parseFloat(p.amount ?? 0), 0)

  const byMethod: Record<string, number> = {}
  filtered.forEach((p: any) => {
    byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] ?? 0) + parseFloat(p.amount ?? 0)
  })

  const pieData   = Object.entries(byMethod).map(([name, value]) => ({ name, value }))
  const chartData = Object.entries(byMethod).map(([method, amount]) => ({ method, amount }))

  return (
    <div className="min-h-full bg-gray-50">
      {showModal && (
        <RecordPaymentModal
          onClose={() => setShowModal(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['so-payments-all'] })}
        />
      )}

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
        <div className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />

        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <Landmark size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Sales</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Receipts</h1>
              <p className="text-violet-200/70 text-xs mt-0.5">Customer receipts against sales orders</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              <Plus size={15} />
              Record Receipt
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Received</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{filtered.length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Transactions</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{Object.keys(byMethod).length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Payment Methods</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">
              ₹{filtered.length > 0 ? (total / filtered.length).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
            </p>
            <p className="text-violet-200 text-xs mt-0.5">Avg. Receipt</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          {(['summary', 'transactions'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Summary Tab */}
        {tab === 'summary' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                  <IndianRupee size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total Received</p>
                  <p className="text-xl font-bold text-gray-900">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  <p className="text-[11px] text-gray-400">{filtered.length} transactions</p>
                </div>
              </div>
              {Object.entries(byMethod).map(([method, amt]) => (
                <div key={method} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${METHOD_GRADIENTS[method] ?? 'from-gray-400 to-gray-500'} flex items-center justify-center text-white shrink-0`}>
                    <IndianRupee size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">{method}</p>
                    <p className="text-xl font-bold text-gray-900">₹{(amt as number).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              ))}
            </div>

            {pieData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Payment Mix</h3>
                  <p className="text-xs text-gray-400 mb-3">Share by method</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        outerRadius={90} labelLine={false} label={renderPieLabel}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-3 border-t border-gray-100">
                    {pieData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-gray-600">{entry.name}</span>
                        <span className="text-xs font-semibold text-gray-800">
                          {total > 0 ? `${((entry.value / total) * 100).toFixed(0)}%` : '0%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Amount by Method</h3>
                  <p className="text-xs text-gray-400 mb-3">Receipt breakdown</p>
                  <ResponsiveContainer width="100%" height={290}>
                    <BarChart data={chartData}>
                      <defs>
                        <linearGradient id="payBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="method" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/100000).toFixed(1)}L`} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                        formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Amount']} />
                      <Bar dataKey="amount" fill="url(#payBarGrad)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {filtered.length === 0 && !isLoading && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <TrendingUp size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">No payments received in this period</p>
                <p className="text-xs text-gray-300 mt-1">Use "Record Receipt" to record a customer receipt</p>
              </div>
            )}
          </>
        )}

        {/* Transactions Tab */}
        {tab === 'transactions' && (
          <>
            <div className="relative mb-4 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search SO#, customer, method, UTR…"
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none bg-white" />
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">SO Number</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Customer</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Method</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Reference / UTR</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16">
                        <TrendingUp size={36} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-sm text-gray-400">No payments in this period</p>
                      </td>
                    </tr>
                  ) : filtered.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {p.paymentDate?.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-violet-600">
                        {p.salesOrder?.soNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.customer?.name ?? p.salesOrder?.customer?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${METHOD_COLORS[p.paymentMethod] ?? 'bg-gray-100 text-gray-700'}`}>
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{p.referenceNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900 tabular-nums">
                        ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-violet-50 border-t-2 border-violet-100">
                      <td colSpan={5} className="px-4 py-3 text-xs font-bold text-violet-700 uppercase tracking-wide">Total</td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-gray-900 tabular-nums">
                        ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
