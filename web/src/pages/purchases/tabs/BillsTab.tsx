import { useState, useEffect } from 'react'
import { Search, Receipt, Loader2, CreditCard, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchaseBillApi, vendorPaymentApi, tdsApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0.00'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  try {
    const date = new Date(d.includes('T') ? d : d + 'T00:00:00')
    return format(date, 'd MMM yyyy')
  } catch { return d }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:   'bg-gray-100 text-gray-600',
  UNPAID:  'text-red-600',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PAID:    'bg-green-100 text-green-700',
}

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'NEFT',          label: 'NEFT' },
  { value: 'RTGS',          label: 'RTGS' },
  { value: 'CHEQUE',        label: 'Cheque' },
  { value: 'UPI',           label: 'UPI' },
  { value: 'CASH',          label: 'Cash' },
  { value: 'OTHER',         label: 'Other' },
]

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none'

export default function BillsTab() {
  const { user } = useAuthStore()
  const outletId = user?.outletId ?? 1
  const qc = useQueryClient()

  const [search, setSearch]   = useState('')
  const [viewBill, setViewBill] = useState<any>(null)
  const [payBill, setPayBill]   = useState<any>(null)

  // Payment form state
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: '',
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    tdsSectionId: '',
    tdsRate: '',
    tdsAmount: '',
  })
  const [tdsSections, setTdsSections] = useState<any[]>([])

  useEffect(() => {
    tdsApi.getSections().then(r => setTdsSections((r.data as any).data ?? []))
  }, [])

  function openPayModal(bill: any) {
    const balance = parseFloat(bill.totalAmount ?? 0) - parseFloat(bill.paidAmount ?? 0)
    setPayBill(bill)
    setPayForm({
      amount: balance.toFixed(2),
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: '',
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      tdsSectionId: '',
      tdsRate: '',
      tdsAmount: '',
    })
  }

  function setPayField(k: string, v: string) {
    setPayForm(prev => {
      const next = { ...prev, [k]: v }
      // Auto-set TDS rate when section selected
      if (k === 'tdsSectionId') {
        const sec = tdsSections.find((s: any) => String(s.id) === v)
        if (sec) {
          next.tdsRate = String(parseFloat(sec.rate))
          const base = parseFloat(next.amount) || 0
          if (base > 0) next.tdsAmount = ((base * parseFloat(sec.rate)) / 100).toFixed(2)
        } else {
          next.tdsRate = ''
          next.tdsAmount = ''
        }
      }
      // Recalc TDS amount when base amount or rate changes
      if (k === 'amount' || k === 'tdsRate') {
        const base = parseFloat(k === 'amount' ? v : next.amount) || 0
        const rate = parseFloat(k === 'tdsRate' ? v : next.tdsRate) || 0
        if (base > 0 && rate > 0) next.tdsAmount = ((base * rate) / 100).toFixed(2)
      }
      return next
    })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-bills', outletId],
    queryFn: async () => {
      const res = await purchaseBillApi.getByOutlet(outletId, { size: 200 })
      return res.data.data
    },
  })


  const payMutation = useMutation({
    mutationFn: (payload: any) => vendorPaymentApi.create(payload),
    onSuccess: () => {
      toast.success('Payment recorded')
      qc.invalidateQueries({ queryKey: ['purchase-bills', outletId] })
      qc.invalidateQueries({ queryKey: ['purchase-bills-summary', outletId] })
      setPayBill(null)
    },
    onError: () => toast.error('Failed to record payment'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseBillApi.delete(id),
    onSuccess: () => {
      toast.success('Bill deleted')
      qc.invalidateQueries({ queryKey: ['purchase-bills', outletId] })
      qc.invalidateQueries({ queryKey: ['purchase-bills-summary', outletId] })
    },
    onError: () => toast.error('Failed to delete bill'),
  })

  const bills: any[] = data?.content ?? []
  const filtered = bills.filter(b =>
    b.billNumber?.toLowerCase().includes(search.toLowerCase()) ||
    b.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.vendorBillNumber?.toLowerCase().includes(search.toLowerCase())
  )

  function handlePay() {
    const amt = parseFloat(payForm.amount)
    if (!payBill || isNaN(amt) || amt <= 0) return
    const balance = parseFloat(payBill.totalAmount) - parseFloat(payBill.paidAmount ?? 0)
    if (amt > balance + 0.01) { toast.error('Amount exceeds balance due'); return }

    const payload: any = {
      billId: payBill.id,
      amount: amt,
      paymentMethod: payForm.paymentMethod,
      referenceNumber: payForm.referenceNumber || undefined,
      paymentDate: payForm.paymentDate,
      notes: payForm.notes || undefined,
    }
    if (payForm.tdsSectionId) {
      payload.tdsSectionId = parseInt(payForm.tdsSectionId)
      payload.tdsAmount = parseFloat(payForm.tdsAmount) || 0
    }
    payMutation.mutate(payload)
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search bills..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Receipt size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No bills yet — convert a Purchase Order to create a bill</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Bill #</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Vendor Bill #</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Vendor</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Due Date</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Balance Due</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => {
                const balance = parseFloat(b.totalAmount ?? 0) - parseFloat(b.paidAmount ?? 0)
                return (
                  <tr
                    key={b.id}
                    onClick={() => setViewBill(b)}
                    className="hover:bg-violet-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-primary-700">{b.billNumber}</td>
                    <td className="px-4 py-3 text-gray-500">{b.vendorBillNumber || '—'}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{b.supplier?.name}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(b.billDate)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(b.dueDate)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtCur(b.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{fmtCur(balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        {b.status !== 'PAID' && (
                          <button
                            onClick={() => openPayModal(b)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            <CreditCard size={12} /> Pay
                          </button>
                        )}
                        <button onClick={() => {
                          if (confirm(`Delete bill ${b.billNumber}?`)) deleteMutation.mutate(b.id)
                        }} className="px-2 py-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* View Bill Detail Modal */}
      {viewBill && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewBill(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">{viewBill.billNumber}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{viewBill.supplier?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {viewBill.status !== 'PAID' && (
                  <button
                    onClick={() => { setViewBill(null); openPayModal(viewBill) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg"
                  >
                    <CreditCard size={12} /> Record Payment
                  </button>
                )}
                <button onClick={() => setViewBill(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Bill Date', fmtDate(viewBill.billDate)],
                  ['Due Date', fmtDate(viewBill.dueDate)],
                  ['Vendor Bill #', viewBill.vendorBillNumber || '—'],
                  ['Status', viewBill.status],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-medium text-gray-800">{val}</p>
                  </div>
                ))}
              </div>

              {viewBill.items?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b">
                        <th className="pb-2 text-left font-medium">Product</th>
                        <th className="pb-2 text-right font-medium">Qty</th>
                        <th className="pb-2 text-right font-medium">Unit Cost</th>
                        <th className="pb-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {viewBill.items.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="py-2">{item.product?.name}</td>
                          <td className="py-2 text-right">{item.quantity}</td>
                          <td className="py-2 text-right">{fmtCur(item.unitCost)}</td>
                          <td className="py-2 text-right font-medium">{fmtCur(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{fmtCur(viewBill.subtotal)}</span>
                </div>
                {(parseFloat(viewBill.cgstAmount ?? 0) > 0 || parseFloat(viewBill.sgstAmount ?? 0) > 0 || parseFloat(viewBill.igstAmount ?? 0) > 0) ? (
                  <>
                    {parseFloat(viewBill.cgstAmount ?? 0) > 0 && <div className="flex justify-between text-blue-600"><span>CGST</span><span>{fmtCur(viewBill.cgstAmount)}</span></div>}
                    {parseFloat(viewBill.sgstAmount ?? 0) > 0 && <div className="flex justify-between text-green-600"><span>SGST</span><span>{fmtCur(viewBill.sgstAmount)}</span></div>}
                    {parseFloat(viewBill.igstAmount ?? 0) > 0 && <div className="flex justify-between text-purple-600"><span>IGST</span><span>{fmtCur(viewBill.igstAmount)}</span></div>}
                  </>
                ) : (
                  <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{fmtCur(viewBill.taxAmount)}</span></div>
                )}
                {viewBill.supplyType && <div className="flex justify-between text-xs text-gray-400"><span>Supply Type</span><span>{viewBill.supplyType === 'INTRA_STATE' ? 'Intra-State' : 'Inter-State'}</span></div>}
                {viewBill.vendorGstin && <div className="flex justify-between text-xs text-gray-400"><span>Vendor GSTIN</span><span className="font-mono">{viewBill.vendorGstin}</span></div>}
                <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Total</span><span>{fmtCur(viewBill.totalAmount)}</span></div>
                <div className="flex justify-between text-green-600"><span>Paid</span><span>{fmtCur(viewBill.paidAmount)}</span></div>
                <div className="flex justify-between font-semibold text-red-600"><span>Balance Due</span><span>{fmtCur(parseFloat(viewBill.totalAmount) - parseFloat(viewBill.paidAmount))}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payBill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setPayBill(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
                <p className="text-sm text-gray-500 mt-0.5">{payBill.billNumber} · {payBill.supplier?.name}</p>
              </div>
              <button onClick={() => setPayBill(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Balance banner */}
              <div className="bg-red-50 border border-red-100 rounded-xl px-6 py-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Balance Due</p>
                  <p className="text-2xl font-bold text-red-600 mt-0.5">
                    {fmtCur(parseFloat(payBill.totalAmount) - parseFloat(payBill.paidAmount ?? 0))}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-400 space-y-0.5">
                  <p>Total: {fmtCur(payBill.totalAmount)}</p>
                  <p>Paid: {fmtCur(payBill.paidAmount ?? 0)}</p>
                </div>
              </div>

              {/* Payment fields — 2 cols */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Payment Details</p>
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Amount (₹) *</label>
                    <input type="number" min="0" step="0.01" className={inp}
                      value={payForm.amount} onChange={e => setPayField('amount', e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Date *</label>
                    <input type="date" className={inp}
                      value={payForm.paymentDate} onChange={e => setPayField('paymentDate', e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
                    <select className={inp} value={payForm.paymentMethod} onChange={e => setPayField('paymentMethod', e.target.value)}>
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference / Cheque No.</label>
                    <input className={inp} placeholder="e.g. UTR123456 or Cheque no."
                      value={payForm.referenceNumber} onChange={e => setPayField('referenceNumber', e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                    <input className={inp} placeholder="Optional remarks"
                      value={payForm.notes} onChange={e => setPayField('notes', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* TDS Section */}
              <div className="border-t pt-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">TDS Deduction <span className="normal-case font-normal">(optional)</span></p>
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">TDS Section</label>
                    <select className={inp} value={payForm.tdsSectionId} onChange={e => setPayField('tdsSectionId', e.target.value)}>
                      <option value="">No TDS</option>
                      {tdsSections.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.sectionCode} — {s.description} ({parseFloat(s.rate).toFixed(2)}%)</option>
                      ))}
                    </select>
                  </div>
                  {payForm.tdsSectionId && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">TDS Rate (%)</label>
                        <input type="number" className={inp} placeholder="auto-filled"
                          value={payForm.tdsRate} onChange={e => setPayField('tdsRate', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">TDS Amount (₹)</label>
                        <input type="number" className={inp} placeholder="auto-calculated"
                          value={payForm.tdsAmount} onChange={e => setPayField('tdsAmount', e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-2">
                <button onClick={() => setPayBill(null)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handlePay} disabled={payMutation.isPending || !payForm.amount}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {payMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  Save Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
