import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, CreditCard, Plus, Loader2, X } from 'lucide-react'
import { vendorPaymentApi, vendorApi, tdsApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const METHOD_COLORS: Record<string, string> = {
  BANK_TRANSFER: 'bg-blue-100 text-blue-700',
  NEFT:          'bg-blue-100 text-blue-700',
  RTGS:          'bg-blue-100 text-blue-700',
  CHEQUE:        'bg-purple-100 text-purple-700',
  CASH:          'bg-green-100 text-green-700',
  UPI:           'bg-orange-100 text-orange-700',
  OTHER:         'bg-gray-100 text-gray-600',
}

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  UPI: 'UPI',
  OTHER: 'Other',
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

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

interface PaymentsMadeTabProps {
  dateFrom: string
  dateTo: string
}

export default function PaymentsMadeTab({ dateFrom, dateTo }: PaymentsMadeTabProps) {
  const { outletId } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [form, setForm] = useState({
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

  useEffect(() => { tdsApi.getSections().then(r => setTdsSections((r.data as any).data ?? [])) }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-payments', outletId],
    queryFn: () => vendorPaymentApi.getAll({ outletId: outletId ?? undefined, size: 500 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    enabled: true,
  })

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', outletId],
    queryFn: () => vendorApi.getAll({ size: 500 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    enabled: showModal && !!outletId,
  })

  const payments: any[] = Array.isArray(data) ? data : (data as any)?.content ?? []
  const allVendors: any[] = Array.isArray(vendorsData) ? vendorsData : []

  const filtered = payments.filter(p => {
    const matchesSearch =
      (p.supplier?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.referenceNumber ?? '').toLowerCase().includes(search.toLowerCase())
    const pDate = p.paymentDate ? new Date(p.paymentDate) : null
    const matchesFrom = !dateFrom || (pDate && pDate >= new Date(dateFrom))
    const matchesTo = !dateTo || (pDate && pDate <= new Date(dateTo + 'T23:59:59'))
    return matchesSearch && matchesFrom && matchesTo
  })

  const totalTds = filtered.reduce((s, p) => s + parseFloat(p.tdsAmount ?? 0), 0)
  const totalPaid = filtered.reduce((s, p) => s + parseFloat(p.amount ?? 0), 0)

  const payMutation = useMutation({
    mutationFn: (payload: any) => vendorPaymentApi.create(payload),
    onSuccess: () => {
      toast.success('Payment recorded')
      qc.invalidateQueries({ queryKey: ['vendor-payments'] })
      setShowModal(false)
      resetModal()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to record payment'),
  })

  function resetModal() {
    setSelectedVendorId('')
    setForm({
      amount: '',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: '',
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      tdsSectionId: '',
      tdsRate: '',
      tdsAmount: '',
    })
  }

  function setFormField(k: string, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
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
      if (k === 'amount' || k === 'tdsRate') {
        const base = parseFloat(k === 'amount' ? v : next.amount) || 0
        const rate = parseFloat(k === 'tdsRate' ? v : next.tdsRate) || 0
        if (base > 0 && rate > 0) next.tdsAmount = ((base * rate) / 100).toFixed(2)
      }
      return next
    })
  }

  function openPayModal() {
    resetModal()
    setShowModal(true)
  }

  function handleSubmit() {
    if (!selectedVendorId) { toast.error('Please select a vendor'); return }
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.paymentDate) { toast.error('Please enter payment date'); return }

    const payload: any = {
      supplierId: parseInt(selectedVendorId),
      outletId: outletId!,
      amount: amt,
      paymentMethod: form.paymentMethod,
      referenceNumber: form.referenceNumber || undefined,
      paymentDate: form.paymentDate,
      notes: form.notes || undefined,
    }
    if (form.tdsSectionId) {
      payload.tdsSectionId = parseInt(form.tdsSectionId)
      payload.tdsAmount = parseFloat(form.tdsAmount) || 0
    }
    payMutation.mutate(payload)
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-500">
          {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
          {(dateFrom || dateTo) && <span className="ml-1 text-violet-400">(date filtered)</span>}
        </h3>
        <button
          onClick={openPayModal}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> Record Payment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor or reference..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search || dateFrom || dateTo ? 'No payments match your search or date filter' : 'No payments recorded yet'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-b border-violet-100">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Reference</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Vendor</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Method</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">TDS</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p: any) => {
                const tds = parseFloat(p.tdsAmount ?? 0)
                return (
                  <tr key={p.id} className="hover:bg-violet-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-violet-700">
                      {p.referenceNumber || <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${METHOD_COLORS[p.paymentMethod] ?? 'bg-gray-100 text-gray-600'}`}>
                        {METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-red-600 font-medium">
                      {tds > 0 ? `₹${fmt(tds)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{fmt(parseFloat(p.amount))}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-t-2 border-violet-200">
                <td colSpan={4} className="px-4 py-3 text-xs font-bold text-violet-600 uppercase tracking-wide">
                  Total ({filtered.length} payments)
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold text-red-600">
                  {totalTds > 0 ? `₹${fmt(totalTds)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">₹{fmt(totalPaid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">Record Payment</h2>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="px-7 py-6 space-y-5 overflow-y-auto flex-1">
              {/* Vendor Selector */}
              <div>
                <label className={lbl}>Vendor <span className="text-red-500">*</span></label>
                {vendorsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 size={14} className="animate-spin" /> Loading vendors…
                  </div>
                ) : (
                  <select
                    value={selectedVendorId}
                    onChange={e => setSelectedVendorId(e.target.value)}
                    className={inp}
                  >
                    <option value="">— Select a vendor —</option>
                    {allVendors.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Two-column row: Amount + Method */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Amount (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.amount}
                    onChange={e => setFormField('amount', e.target.value)}
                    className={inp}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={lbl}>Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
                    className={inp}
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Two-column row: Date + Reference */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Payment Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Reference / Cheque No.</label>
                  <input
                    type="text"
                    value={form.referenceNumber}
                    onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))}
                    className={inp}
                    placeholder="UTR / Cheque number (optional)"
                  />
                </div>
              </div>

              {/* TDS Deduction */}
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  TDS Deduction <span className="normal-case font-normal">(optional)</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>TDS Section</label>
                    <select className={inp} value={form.tdsSectionId} onChange={e => setFormField('tdsSectionId', e.target.value)}>
                      <option value="">No TDS</option>
                      {tdsSections.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.sectionCode} — {s.description}</option>
                      ))}
                    </select>
                  </div>
                  {form.tdsSectionId && (
                    <>
                      <div>
                        <label className={lbl}>TDS Rate (%)</label>
                        <input type="number" min="0" step="0.01" className={inp}
                          value={form.tdsRate} onChange={e => setFormField('tdsRate', e.target.value)} />
                      </div>
                      <div>
                        <label className={lbl}>TDS Amount (₹)</label>
                        <input type="number" min="0" step="0.01" className={inp}
                          value={form.tdsAmount} onChange={e => setFormField('tdsAmount', e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
                {form.tdsSectionId && form.tdsAmount && form.amount && (
                  <p className="text-xs mt-3 text-violet-700 font-semibold">
                    Net payable to vendor: ₹{fmt((parseFloat(form.amount) || 0) - (parseFloat(form.tdsAmount) || 0))}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className={lbl}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className={inp + ' resize-none'}
                  rows={2}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="px-7 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => { setShowModal(false); resetModal() }}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={payMutation.isPending || !selectedVendorId}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold"
              >
                {payMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Recording…</> : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
