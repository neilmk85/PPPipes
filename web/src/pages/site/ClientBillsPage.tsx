import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteFloatingNav from './SiteFloatingNav'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, X, Loader2, FileText, Building2, Calendar,
  IndianRupee, CheckCircle2, Clock, AlertCircle, ArrowLeft,
  Edit2, Trash2, CreditCard, ChevronDown, BadgePercent,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clientBillApi, siteProjectApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type CBStatus = 'DRAFT' | 'SUBMITTED' | 'CERTIFIED' | 'PAID'
type SupplyType = 'INTRA_STATE' | 'INTER_STATE'

interface BillItem {
  id?: number
  description: string
  unit: string
  contractedQty: number
  previousQty: number
  currentQty: number
  rate: number
  gstRate: number
  amount: number
}

interface BillPayment {
  id: number
  date: string
  amount: string
  mode: string
  reference?: string
  notes?: string
}

interface ClientBill {
  id: number
  siteProjectId: number
  billNumber: string
  billDate: string
  periodFrom?: string
  periodTo?: string
  clientName: string
  supplyType: SupplyType
  tdsRate: string
  retentionRate: string
  otherDeductions: string
  status: CBStatus
  notes?: string
  items: BillItem[]
  payments: BillPayment[]
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GST_RATES = [0, 5, 12, 18]
const PAY_MODES = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'UPI', label: 'UPI' },
]

const STATUS_CONFIG: Record<CBStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     color: 'text-gray-500',   bg: 'bg-gray-100',   icon: <Edit2 size={11} /> },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-700',   bg: 'bg-blue-50',    icon: <Clock size={11} /> },
  CERTIFIED: { label: 'Certified', color: 'text-green-700',  bg: 'bg-green-50',   icon: <CheckCircle2 size={11} /> },
  PAID:      { label: 'Paid',      color: 'text-violet-700', bg: 'bg-violet-50',  icon: <IndianRupee size={11} /> },
}

const STATUS_FLOW: Record<CBStatus, CBStatus | null> = {
  DRAFT: 'SUBMITTED', SUBMITTED: 'CERTIFIED', CERTIFIED: 'PAID', PAID: null,
}
const STATUS_NEXT_LABEL: Record<CBStatus, string> = {
  DRAFT: 'Submit', SUBMITTED: 'Certify', CERTIFIED: 'Mark Paid', PAID: '',
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d?: string) {
  if (!d) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`
  }
  return new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
}
function today() { return new Date().toISOString().split('T')[0] }

// ─── Calculations ─────────────────────────────────────────────────────────────

function calcBill(bill: ClientBill) {
  const subtotal = bill.items.reduce((s, it) => s + Number(it.currentQty) * Number(it.rate), 0)
  const gstTotal = bill.items.reduce((s, it) => s + Number(it.currentQty) * Number(it.rate) * Number(it.gstRate) / 100, 0)
  const gross = subtotal + gstTotal
  const cgst = bill.supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const sgst = bill.supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const igst = bill.supplyType === 'INTER_STATE' ? gstTotal : 0
  const tds = gross * Number(bill.tdsRate) / 100
  const retention = gross * Number(bill.retentionRate) / 100
  const otherDed = Number(bill.otherDeductions)
  const netPayable = gross - tds - retention - otherDed
  const paid = bill.payments.reduce((s, p) => s + Number(p.amount), 0)
  const due = netPayable - paid
  return { subtotal, gstTotal, gross, cgst, sgst, igst, tds, retention, otherDed, netPayable, paid, due }
}

// ─── Bill Detail Panel ────────────────────────────────────────────────────────

function BillDetailPanel({ bill, onClose, onStatusChange, onAddPayment, onDeletePayment, onEdit, onDelete }: {
  bill: ClientBill
  onClose: () => void
  onStatusChange: (bill: ClientBill, status: CBStatus) => void
  onAddPayment: (bill: ClientBill, data: any) => void
  onDeletePayment: (bill: ClientBill, paymentId: number) => void
  onEdit: (bill: ClientBill) => void
  onDelete: (bill: ClientBill) => void
}) {
  const [payOpen, setPayOpen] = useState(false)
  const [payDate, setPayDate] = useState(today())
  const [payAmt, setPayAmt] = useState('')
  const [payMode, setPayMode] = useState('BANK_TRANSFER')
  const [payRef, setPayRef] = useState('')
  const [visible, setVisible] = useState(false)

  useState(() => { setTimeout(() => setVisible(true), 10) })

  const sc = STATUS_CONFIG[bill.status]
  const calc = calcBill(bill)
  const nextStatus = STATUS_FLOW[bill.status]

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  const submitPayment = () => {
    if (!payAmt || isNaN(Number(payAmt))) { toast.error('Enter a valid amount'); return }
    onAddPayment(bill, { date: payDate, amount: Number(payAmt), mode: payMode, reference: payRef || undefined })
    setPayOpen(false); setPayAmt(''); setPayRef('')
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className={`flex-1 bg-black/30 backdrop-blur-sm transition-opacity duration-[280ms] ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`w-full max-w-xl bg-white shadow-2xl flex flex-col h-full transition-transform duration-[280ms] ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
                {sc.icon}{sc.label}
              </span>
              <span className="text-xs text-gray-400">{bill.billNumber}</span>
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{bill.clientName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {fmtDate(bill.billDate)}
              {bill.periodFrom && ` · ${fmtDate(bill.periodFrom)} – ${fmtDate(bill.periodTo)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bill.status === 'DRAFT' && (
              <>
                <button onClick={() => onEdit(bill)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={15} /></button>
                <button onClick={() => { if (confirm('Delete this bill?')) onDelete(bill) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
              </>
            )}
            <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Line Items */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Work Items</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-1.5 text-gray-400 font-medium pr-2">Description</th>
                    <th className="text-right text-gray-400 font-medium px-1">Prev Qty</th>
                    <th className="text-right text-gray-400 font-medium px-1">This Bill</th>
                    <th className="text-right text-gray-400 font-medium px-1">Rate</th>
                    <th className="text-right text-gray-400 font-medium pl-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((it, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 pr-2">
                        <span className="font-medium text-gray-800">{it.description}</span>
                        <span className="text-gray-400 ml-1">({it.unit})</span>
                        {Number(it.contractedQty) > 0 && <span className="text-gray-400 ml-1">/ {Number(it.contractedQty).toLocaleString()} contracted</span>}
                      </td>
                      <td className="text-right px-1 text-gray-500">{Number(it.previousQty).toLocaleString()}</td>
                      <td className="text-right px-1 font-semibold text-gray-800">{Number(it.currentQty).toLocaleString()}</td>
                      <td className="text-right px-1 text-gray-600">₹{Number(it.rate).toLocaleString()}</td>
                      <td className="text-right pl-1 font-semibold text-gray-900">₹{fmt(Number(it.currentQty) * Number(it.rate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="mx-5 mb-4 bg-gray-50 rounded-xl p-3 text-sm space-y-1.5">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-medium">₹{fmt(calc.subtotal)}</span></div>
            {bill.supplyType === 'INTRA_STATE' ? (
              <>
                <div className="flex justify-between text-gray-500 text-xs"><span>CGST</span><span>₹{fmt(calc.cgst)}</span></div>
                <div className="flex justify-between text-gray-500 text-xs"><span>SGST</span><span>₹{fmt(calc.sgst)}</span></div>
              </>
            ) : (
              <div className="flex justify-between text-gray-500 text-xs"><span>IGST</span><span>₹{fmt(calc.igst)}</span></div>
            )}
            <div className="flex justify-between text-gray-700 font-medium border-t border-gray-200 pt-1.5"><span>Gross</span><span>₹{fmt(calc.gross)}</span></div>
            {calc.tds > 0 && <div className="flex justify-between text-red-600 text-xs"><span>TDS ({bill.tdsRate}%)</span><span>− ₹{fmt(calc.tds)}</span></div>}
            {calc.retention > 0 && <div className="flex justify-between text-orange-600 text-xs"><span>Retention ({bill.retentionRate}%)</span><span>− ₹{fmt(calc.retention)}</span></div>}
            {calc.otherDed > 0 && <div className="flex justify-between text-red-500 text-xs"><span>Other Deductions</span><span>− ₹{fmt(calc.otherDed)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1.5"><span>Net Payable</span><span>₹{fmt(calc.netPayable)}</span></div>
            <div className="flex justify-between text-green-700 text-xs"><span>Received</span><span>₹{fmt(calc.paid)}</span></div>
            <div className={`flex justify-between font-semibold text-sm ${calc.due > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
              <span>Outstanding</span><span>₹{fmt(Math.max(0, calc.due))}</span>
            </div>
          </div>

          {/* Payments */}
          <div className="px-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payments Received</p>
              <button onClick={() => setPayOpen(v => !v)} className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
                <Plus size={12} />Record
              </button>
            </div>

            {payOpen && (
              <div className="mb-3 p-3 bg-teal-50 border border-teal-100 rounded-xl space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Date</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Amount (₹)</label>
                    <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="0.00"
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Mode</label>
                    <select value={payMode} onChange={e => setPayMode(e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                      {PAY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Reference</label>
                    <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="UTR / Cheque no."
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setPayOpen(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={submitPayment} className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">Save</button>
                </div>
              </div>
            )}

            {bill.payments.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No payments recorded</p>
            ) : (
              <div className="space-y-1.5">
                {bill.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-semibold text-green-800">₹{fmt(Number(p.amount))}</span>
                      <span className="text-xs text-green-600 ml-2">{p.mode.replace('_',' ')}</span>
                      {p.reference && <span className="text-xs text-green-500 ml-1">· {p.reference}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600">{fmtDate(p.date)}</span>
                      <button onClick={() => { if (confirm('Remove payment?')) onDeletePayment(bill, p.id) }}
                        className="text-green-300 hover:text-red-500 transition-colors"><X size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {bill.notes && (
            <div className="mx-5 mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-xs font-semibold text-amber-700 mb-0.5">Notes</p>
              <p className="text-sm text-amber-800">{bill.notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {nextStatus && (
          <div className="px-5 py-4 border-t border-gray-100 shrink-0">
            <button onClick={() => onStatusChange(bill, nextStatus)}
              className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors">
              {STATUS_NEXT_LABEL[bill.status]} →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bill Form Panel ──────────────────────────────────────────────────────────

const EMPTY_ITEM = (): BillItem => ({ description: '', unit: 'RMT', contractedQty: 0, previousQty: 0, currentQty: 0, rate: 0, gstRate: 18, amount: 0 })

function BillFormPanel({ initial, projectId, clientName, onClose, onSaved }: {
  initial?: ClientBill
  projectId: number
  clientName: string
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [visible, setVisible] = useState(false)
  useState(() => { setTimeout(() => setVisible(true), 10) })

  const [billDate, setBillDate] = useState(initial?.billDate ?? today())
  const [periodFrom, setPeriodFrom] = useState(initial?.periodFrom ?? '')
  const [periodTo, setPeriodTo] = useState(initial?.periodTo ?? '')
  const [supplyType, setSupplyType] = useState<SupplyType>(initial?.supplyType ?? 'INTRA_STATE')
  const [tdsRate, setTdsRate] = useState(String(initial?.tdsRate ?? '1'))
  const [retentionRate, setRetentionRate] = useState(String(initial?.retentionRate ?? '0'))
  const [otherDed, setOtherDed] = useState(String(initial?.otherDeductions ?? '0'))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [items, setItems] = useState<BillItem[]>(initial?.items.length ? initial.items : [EMPTY_ITEM()])
  const [saving, setSaving] = useState(false)

  const handleClose = () => { setVisible(false); setTimeout(onClose, 280) }

  const updateItem = (i: number, field: keyof BillItem, val: any) => {
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      if (['currentQty', 'rate'].includes(field as string)) {
        next[i].amount = Number(next[i].currentQty) * Number(next[i].rate)
      }
      return next
    })
  }

  const calcPreview = () => {
    const subtotal = items.reduce((s, it) => s + Number(it.currentQty) * Number(it.rate), 0)
    const gstTotal = items.reduce((s, it) => s + Number(it.currentQty) * Number(it.rate) * Number(it.gstRate) / 100, 0)
    const gross = subtotal + gstTotal
    const tds = gross * Number(tdsRate) / 100
    const retention = gross * Number(retentionRate) / 100
    const other = Number(otherDed)
    return { subtotal, gstTotal, gross, tds, retention, other, net: gross - tds - retention - other }
  }

  const save = async () => {
    if (!billDate) { toast.error('Bill date is required'); return }
    if (items.some(it => !it.description)) { toast.error('All items need a description'); return }
    setSaving(true)
    try {
      const payload = {
        siteProjectId: projectId, billDate, periodFrom: periodFrom || null, periodTo: periodTo || null,
        clientName, supplyType, tdsRate: Number(tdsRate), retentionRate: Number(retentionRate),
        otherDeductions: Number(otherDed), notes: notes || null, items,
      }
      if (initial) {
        await clientBillApi.update(initial.id, payload)
        toast.success('Bill updated')
      } else {
        await clientBillApi.create(payload)
        toast.success('RA Bill created')
      }
      qc.invalidateQueries({ queryKey: ['site-client-bills'] })
      onSaved()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const calc = calcPreview()

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className={`flex-1 bg-black/30 backdrop-blur-sm transition-opacity duration-[280ms] ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`w-full max-w-4xl bg-white shadow-2xl flex flex-col h-full transition-transform duration-[280ms] ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{initial ? 'Edit RA Bill' : 'New RA Bill'}</h2>
            <p className="text-xs text-gray-400">{clientName}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Bill Date *</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Period From</label>
              <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Period To</label>
              <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>

          {/* Supply Type */}
          <div>
            <label className="text-xs font-semibold text-gray-600">GST Type</label>
            <div className="flex gap-2 mt-1">
              {(['INTRA_STATE', 'INTER_STATE'] as const).map(t => (
                <button key={t} onClick={() => setSupplyType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${supplyType === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                  {t === 'INTRA_STATE' ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'}
                </button>
              ))}
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">Work Items</label>
              <button onClick={() => setItems(p => [...p, EMPTY_ITEM()])} className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
                <Plus size={12} />Add Row
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50 space-y-2">
                  <div className="flex gap-2">
                    <input value={it.description} onChange={e => updateItem(i, 'description', e.target.value)}
                      placeholder="Description of work" className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
                    <select value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)}
                      className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                      {['RMT','M³','M²','Nos','LS','MT','KG','Bags'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    {items.length > 1 && (
                      <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 transition-colors"><X size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: 'Contract Qty', field: 'contractedQty' },
                      { label: 'Previous Qty', field: 'previousQty' },
                      { label: 'This Bill Qty', field: 'currentQty' },
                      { label: 'Rate (₹)', field: 'rate' },
                    ].map(({ label, field }) => (
                      <div key={field}>
                        <label className="text-xs text-gray-400">{label}</label>
                        <input type="number" value={(it as any)[field]} onChange={e => updateItem(i, field as keyof BillItem, Number(e.target.value))}
                          className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-gray-400">GST%</label>
                      <select value={it.gstRate} onChange={e => updateItem(i, 'gstRate', Number(e.target.value))}
                        className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                        {GST_RATES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    Amount: <span className="font-semibold text-gray-800">₹{fmt(Number(it.currentQty) * Number(it.rate))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deductions */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1"><BadgePercent size={12} />Deductions</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600">TDS Rate %</label>
                <input type="number" step="0.5" value={tdsRate} onChange={e => setTdsRate(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Retention Rate %</label>
                <input type="number" step="0.5" value={retentionRate} onChange={e => setRetentionRate(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Other Deductions (₹)</label>
                <input type="number" value={otherDed} onChange={e => setOtherDed(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
              </div>
            </div>
          </div>

          {/* Summary Preview */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{fmt(calc.subtotal)}</span></div>
            <div className="flex justify-between text-gray-500 text-xs"><span>GST</span><span>₹{fmt(calc.gstTotal)}</span></div>
            <div className="flex justify-between font-medium text-gray-700"><span>Gross</span><span>₹{fmt(calc.gross)}</span></div>
            {calc.tds > 0 && <div className="flex justify-between text-red-600 text-xs"><span>TDS ({tdsRate}%)</span><span>− ₹{fmt(calc.tds)}</span></div>}
            {calc.retention > 0 && <div className="flex justify-between text-orange-600 text-xs"><span>Retention ({retentionRate}%)</span><span>− ₹{fmt(calc.retention)}</span></div>}
            {calc.other > 0 && <div className="flex justify-between text-red-500 text-xs"><span>Other</span><span>− ₹{fmt(calc.other)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1"><span>Net Payable</span><span>₹{fmt(calc.net)}</span></div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-600">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional remarks…"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={handleClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial ? 'Update' : 'Create Bill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientBillsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [projectId, setProjectId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [detailBill, setDetailBill] = useState<ClientBill | null>(null)
  const [editBill, setEditBill] = useState<ClientBill | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll().then(r => r.data.data ?? []),
  })

  const { data: bills = [], isLoading } = useQuery<ClientBill[]>({
    queryKey: ['site-client-bills', projectId, statusFilter],
    queryFn: () => clientBillApi.getAll({ siteProjectId: projectId ?? undefined, status: statusFilter !== 'ALL' ? statusFilter : undefined })
      .then(r => r.data.data ?? []),
    enabled: !!projectId,
  })

  const selectedProject = projects.find(p => p.id === projectId)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['site-client-bills'] })

  const handleStatusChange = async (bill: ClientBill, status: CBStatus) => {
    try {
      await clientBillApi.updateStatus(bill.id, status)
      toast.success(`Bill marked ${STATUS_CONFIG[status].label}`)
      invalidate()
      setDetailBill(prev => prev?.id === bill.id ? { ...prev, status } : prev)
    } catch { toast.error('Failed to update status') }
  }

  const handleAddPayment = async (bill: ClientBill, data: any) => {
    try {
      const res = await clientBillApi.addPayment(bill.id, data)
      toast.success('Payment recorded')
      invalidate()
      setDetailBill(res.data.data)
    } catch { toast.error('Failed to record payment') }
  }

  const handleDeletePayment = async (bill: ClientBill, paymentId: number) => {
    try {
      const res = await clientBillApi.deletePayment(bill.id, paymentId)
      toast.success('Payment removed')
      invalidate()
      setDetailBill(res.data.data)
    } catch { toast.error('Failed to remove payment') }
  }

  const handleDelete = async (bill: ClientBill) => {
    try {
      await clientBillApi.delete(bill.id)
      toast.success('Bill deleted')
      invalidate()
      setDetailBill(null)
    } catch { toast.error('Failed to delete') }
  }

  // Stats
  const totalBilled = bills.reduce((s, b) => s + calcBill(b).subtotal, 0)
  const totalNet = bills.reduce((s, b) => s + calcBill(b).netPayable, 0)
  const totalPaid = bills.reduce((s, b) => s + calcBill(b).paid, 0)
  const totalDue = bills.reduce((s, b) => s + Math.max(0, calcBill(b).due), 0)

  const STATUS_TABS = ['ALL', 'DRAFT', 'SUBMITTED', 'CERTIFIED', 'PAID'] as const

  return (
    <div className="min-h-screen bg-white">
      {/* Gradient Header */}
      <div style={{ background: 'linear-gradient(180deg,#ccfbf1 0%,#e0fdf4 35%,#f0fdf4 65%,#f9fffe 85%,#ffffff 100%)' }}>
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate('/site/sub-contractor')} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/60 rounded-lg transition-colors">
              <ArrowLeft size={18} />
            </button>
            <SiteFloatingNav inline />
          </div>
          <div className="flex items-start justify-between pb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">RA Bills</h1>
              <p className="text-sm text-gray-500">Running Account Bills raised to client</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Project Selector */}
              <div className="relative">
                <select
                  value={projectId ?? ''}
                  onChange={e => setProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer shadow-sm min-w-48"
                >
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {projectId && (
                <button onClick={() => { setEditBill(null); setShowForm(true) }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm">
                  <Plus size={15} />New RA Bill
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stat Strip */}
        {projectId && (
          <div className="mx-6 mb-0 bg-white rounded-t-2xl shadow-sm border border-gray-100 border-b-0">
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              {[
                { label: `${bills.length} Bill${bills.length !== 1 ? 's' : ''}`, sub: 'Raised', icon: <FileText size={14} className="text-teal-500" /> },
                { label: `₹${fmt(totalBilled)}`, sub: 'Total Subtotal', icon: <IndianRupee size={14} className="text-blue-500" /> },
                { label: `₹${fmt(totalNet)}`, sub: 'Net Payable', icon: <CreditCard size={14} className="text-violet-500" /> },
                { label: `₹${fmt(totalDue)}`, sub: 'Outstanding', icon: <AlertCircle size={14} className={totalDue > 0 ? 'text-red-500' : 'text-green-500'} /> },
              ].map(s => (
                <div key={s.sub} className="px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-0.5">{s.icon}<span className="text-xs text-gray-400">{s.sub}</span></div>
                  <p className="text-base font-bold text-gray-900">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6">
        {!projectId ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Building2 size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Select a project to view RA Bills</p>
          </div>
        ) : (
          <>
            {/* Status Tabs */}
            <div className="flex items-center gap-1 py-3 border-b border-gray-100">
              {STATUS_TABS.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s
                    ? s === 'ALL' ? 'bg-gray-800 text-white'
                      : s === 'DRAFT' ? 'bg-gray-500 text-white'
                      : s === 'SUBMITTED' ? 'bg-blue-600 text-white'
                      : s === 'CERTIFIED' ? 'bg-green-600 text-white'
                      : 'bg-violet-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'}`}>
                  {s === 'ALL' ? 'All' : STATUS_CONFIG[s as CBStatus].label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 size={22} className="animate-spin mr-2" />Loading…
              </div>
            ) : bills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <FileText size={36} className="mb-3 opacity-25" />
                <p className="text-sm font-medium">No RA Bills yet</p>
                <p className="text-xs mt-1">Click "New RA Bill" to raise your first bill</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm mt-1">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Bill No','Period','Bill Date','Subtotal','GST','TDS','Retention','Net Payable','Received','Due','Status'].map(h => (
                        <th key={h} className="text-left py-2.5 px-2 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map(bill => {
                      const c = calcBill(bill)
                      const sc = STATUS_CONFIG[bill.status]
                      return (
                        <tr key={bill.id} onClick={() => setDetailBill(bill)}
                          className="border-b border-gray-50 cursor-pointer hover:bg-teal-50/50 transition-colors">
                          <td className="py-3 px-2 font-semibold text-gray-800 whitespace-nowrap">{bill.billNumber}</td>
                          <td className="py-3 px-2 text-gray-500 whitespace-nowrap text-xs">
                            {bill.periodFrom ? `${fmtDate(bill.periodFrom)} – ${fmtDate(bill.periodTo)}` : '—'}
                          </td>
                          <td className="py-3 px-2 text-gray-600 whitespace-nowrap">{fmtDate(bill.billDate)}</td>
                          <td className="py-3 px-2 text-gray-900 font-medium text-right whitespace-nowrap">₹{fmt(c.subtotal)}</td>
                          <td className="py-3 px-2 text-gray-600 text-right whitespace-nowrap">₹{fmt(c.gstTotal)}</td>
                          <td className="py-3 px-2 text-red-600 text-right whitespace-nowrap">₹{fmt(c.tds)}</td>
                          <td className="py-3 px-2 text-orange-600 text-right whitespace-nowrap">₹{fmt(c.retention)}</td>
                          <td className="py-3 px-2 text-gray-900 font-semibold text-right whitespace-nowrap">₹{fmt(c.netPayable)}</td>
                          <td className="py-3 px-2 text-green-700 text-right whitespace-nowrap">₹{fmt(c.paid)}</td>
                          <td className={`py-3 px-2 text-right font-semibold whitespace-nowrap ${c.due > 0.01 ? 'text-red-600' : 'text-green-600'}`}>₹{fmt(Math.max(0, c.due))}</td>
                          <td className="py-3 px-2 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
                              {sc.icon}{sc.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Panels */}
      {detailBill && !showForm && (
        <BillDetailPanel
          bill={detailBill}
          onClose={() => setDetailBill(null)}
          onStatusChange={handleStatusChange}
          onAddPayment={handleAddPayment}
          onDeletePayment={handleDeletePayment}
          onEdit={b => { setEditBill(b); setDetailBill(null); setShowForm(true) }}
          onDelete={handleDelete}
        />
      )}
      {showForm && (
        <BillFormPanel
          initial={editBill ?? undefined}
          projectId={projectId!}
          clientName={selectedProject?.clientName ?? ''}
          onClose={() => { setShowForm(false); setEditBill(null) }}
          onSaved={() => { setShowForm(false); setEditBill(null) }}
        />
      )}
    </div>
  )
}
