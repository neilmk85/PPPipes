import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, CreditCard, Plus, Loader2, X } from 'lucide-react'
import { purchaseBillApi, vendorPaymentApi, vendorApi } from '@/services/api'
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

export default function PaymentsMadeTab() {
  const { outletId } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [selectedBillId, setSelectedBillId] = useState('')
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: '',
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-payments', outletId],
    queryFn: () => vendorPaymentApi.getAll({ outletId: outletId ?? undefined, size: 200 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    enabled: true,
  })

  const { data: billsData, isLoading: billsLoading } = useQuery({
    queryKey: ['purchase-bills', outletId],
    queryFn: () => purchaseBillApi.getByOutlet(outletId!, { size: 500 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    enabled: showModal && !!outletId,
  })

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', outletId],
    queryFn: () => vendorApi.getAll({ size: 500 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    enabled: showModal && !!outletId,
  })

  const payments: any[] = Array.isArray(data) ? data : (data as any)?.content ?? []
  const allBills: any[] = Array.isArray(billsData) ? billsData : []
  const allVendors: any[] = Array.isArray(vendorsData) ? vendorsData : []
  const openBills = allBills.filter(b =>
    (b.status === 'UNPAID' || b.status === 'PARTIAL') &&
    (!selectedVendorId || String(b.supplierId ?? b.supplier?.id) === selectedVendorId)
  )

  const selectedBill = openBills.find(b => String(b.id) === selectedBillId) ?? null

  const filtered = payments.filter(p =>
    (p.supplier?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.referenceNumber ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const payMutation = useMutation({
    mutationFn: (payload: any) => vendorPaymentApi.create(payload),
    onSuccess: () => {
      toast.success('Payment recorded')
      qc.invalidateQueries({ queryKey: ['vendor-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-bills', outletId] })
      setShowModal(false)
      resetModal()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to record payment'),
  })

  function resetModal() {
    setSelectedVendorId('')
    setSelectedBillId('')
    setForm({
      amount: '',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: '',
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    })
  }

  function openPayModal() {
    resetModal()
    setShowModal(true)
  }

  function handleVendorSelect(vendorId: string) {
    setSelectedVendorId(vendorId)
    setSelectedBillId('')
    setForm(prev => ({ ...prev, amount: '' }))
  }

  function handleBillSelect(billId: string) {
    setSelectedBillId(billId)
    const bill = openBills.find(b => String(b.id) === billId)
    if (bill) {
      const balance = parseFloat(bill.totalAmount ?? 0) - parseFloat(bill.paidAmount ?? 0)
      setForm(prev => ({ ...prev, amount: balance.toFixed(2) }))
    }
  }

  function handleSubmit() {
    if (!selectedVendorId) { toast.error('Please select a vendor'); return }
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.paymentDate) { toast.error('Please enter payment date'); return }

    if (selectedBill) {
      const balance = parseFloat(selectedBill.totalAmount ?? 0) - parseFloat(selectedBill.paidAmount ?? 0)
      if (amt > balance + 0.01) { toast.error('Amount exceeds balance due'); return }
    }

    payMutation.mutate({
      supplierId: parseInt(selectedVendorId),
      outletId: outletId!,
      billId: selectedBillId ? parseInt(selectedBillId) : undefined,
      amount: amt,
      paymentMethod: form.paymentMethod,
      referenceNumber: form.referenceNumber || undefined,
      paymentDate: form.paymentDate,
      notes: form.notes || undefined,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={openPayModal}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search payments..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'No payments match your search' : 'No payments recorded yet'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Reference</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Vendor</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Method</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-violet-700">
                    {p.referenceNumber || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{p.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${METHOD_COLORS[p.paymentMethod] ?? 'bg-gray-100 text-gray-600'}`}>
                      {METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">₹{fmt(parseFloat(p.amount))}</td>
                </tr>
              ))}
            </tbody>
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
                    onChange={e => handleVendorSelect(e.target.value)}
                    className={inp}
                  >
                    <option value="">— Select a vendor —</option>
                    {allVendors.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Bill Selector (optional, filtered by vendor) */}
              <div>
                <label className={lbl}>
                  Bill <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                {billsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 size={14} className="animate-spin" /> Loading bills…
                  </div>
                ) : (
                  <select
                    value={selectedBillId}
                    onChange={e => handleBillSelect(e.target.value)}
                    className={inp}
                    disabled={!selectedVendorId}
                  >
                    <option value="">— No bill (advance / on-account payment) —</option>
                    {openBills.map(b => {
                      const balance = parseFloat(b.totalAmount ?? 0) - parseFloat(b.paidAmount ?? 0)
                      return (
                        <option key={b.id} value={b.id}>
                          {b.billNumber} · Balance ₹{fmt(balance)}
                        </option>
                      )
                    })}
                  </select>
                )}
                {selectedBill && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Total: ₹{fmt(parseFloat(selectedBill.totalAmount ?? 0))} ·
                    Paid: ₹{fmt(parseFloat(selectedBill.paidAmount ?? 0))} ·
                    <span className="font-semibold text-violet-700"> Balance: ₹{fmt(parseFloat(selectedBill.totalAmount ?? 0) - parseFloat(selectedBill.paidAmount ?? 0))}</span>
                  </p>
                )}
                {selectedVendorId && !selectedBillId && openBills.length === 0 && !billsLoading && (
                  <p className="text-xs text-gray-400 mt-1">No unpaid bills for this vendor</p>
                )}
              </div>

              {/* Two-column row: Amount + Method */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Amount (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
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
