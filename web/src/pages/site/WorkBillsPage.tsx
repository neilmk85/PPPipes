import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import SiteFloatingNav from './SiteFloatingNav'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, X, Loader2, FileText, HardHat,
  Calendar, CheckCircle2, Clock, IndianRupee, CreditCard,
  Edit2, ChevronRight, Printer, ClipboardList,
  AlertCircle, BadgePercent, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { workBillApi, workOrderApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type WBStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID' // SUBMITTED kept for legacy records only
type SupplyType = 'INTRA_STATE' | 'INTER_STATE'
type PayMode = 'BANK_TRANSFER' | 'CHEQUE' | 'UPI' | 'CASH'

interface WorkOrder {
  id: number; woNumber: string; contractorId: number; contractorName: string
  contractorGstin?: string; title: string; location: string
  startDate: string; endDate: string; status: string; notes: string
  items: { id: string; description: string; unit: string; quantity: number; rate: number }[]
  createdAt: string
}

interface BillItem {
  id: string; description: string; unit: string
  contractedQty: number; actualQty: number; rate: number; gstRate: number
}

interface BillPayment {
  id: string; date: string; amount: number; mode: PayMode; reference: string
}

interface WorkBill {
  id: number; billNumber: string
  workOrderId: number; woNumber: string; woTitle: string
  contractorId: number; contractorName: string; contractorGstin?: string
  billingPeriodFrom: string; billingPeriodTo: string
  billDate: string; dueDate: string
  supplyType: SupplyType; tdsRate: number
  status: WBStatus; items: BillItem[]
  contractorInvoiceNo: string; notes: string
  payments: BillPayment[]; createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GST_RATES = [0, 5, 12, 18]
const TDS_OPTIONS = [
  { label: 'No TDS', value: 0 },
  { label: '1% (Sec 194C – Individual)', value: 1 },
  { label: '2% (Sec 194C – Company/Firm)', value: 2 },
]
const PAY_MODES: { value: PayMode; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
]

const STATUS_CONFIG: Record<WBStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     color: 'text-gray-500',   bg: 'bg-gray-100',   icon: <Edit2 size={11} /> },
  SUBMITTED: { label: 'Draft',     color: 'text-gray-500',   bg: 'bg-gray-100',   icon: <Edit2 size={11} /> },
  APPROVED:  { label: 'Approved',  color: 'text-green-700',  bg: 'bg-green-50',   icon: <CheckCircle2 size={11} /> },
  PAID:      { label: 'Paid',      color: 'text-violet-700', bg: 'bg-violet-50',  icon: <IndianRupee size={11} /> },
}
const STATUS_TABS: Array<WBStatus | 'ALL'> = ['ALL', 'DRAFT', 'APPROVED', 'PAID']
const STATUS_TAB_ACTIVE: Record<string, string> = {
  ALL: 'bg-gray-800 text-white', DRAFT: 'bg-gray-500 text-white',
  APPROVED: 'bg-green-600 text-white', PAID: 'bg-violet-600 text-white',
}

function fmt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string) {
  if (!d) return '—'
  // Plain date string YYYY-MM-DD — no timezone conversion needed
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`
  }
  // Full datetime string — parse and display in IST
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
function fmtDateTime(d: string) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }) + ' IST'
}
function today() { return new Date().toISOString().split('T')[0] }
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n)
  return dt.toISOString().split('T')[0]
}

// ─── Calculations ─────────────────────────────────────────────────────────────

function calcBill(items: BillItem[], tdsRate: number, supplyType: SupplyType) {
  const subtotal = items.reduce((s, it) => s + Number(it.actualQty) * Number(it.rate), 0)
  const gstTotal = items.reduce((s, it) => s + Number(it.actualQty) * Number(it.rate) * Number(it.gstRate) / 100, 0)
  const cgst = supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const sgst = supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const igst = supplyType === 'INTER_STATE' ? gstTotal : 0
  const tds = subtotal * Number(tdsRate) / 100
  const netPayable = subtotal + gstTotal - tds
  return { subtotal, gstTotal, cgst, sgst, igst, tds, netPayable }
}

// ─── Work Order Selector ──────────────────────────────────────────────────────

function WOSelector({ value, onSelect }: {
  value: WorkOrder | null
  onSelect: (wo: WorkOrder | null) => void
}) {
  const [open, setOpen] = useState(false)

  const { data: allWOs = [] } = useQuery<WorkOrder[]>({
    queryKey: ['work-orders'],
    queryFn: () => workOrderApi.getAll().then(r => r.data.data ?? []),
  })

  const completedWOs = allWOs.filter(w => w.status === 'COMPLETED' || w.status === 'BILLED')

  if (value) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <ClipboardList size={14} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-800">{value.woNumber} — {value.title}</p>
          <p className="text-xs text-indigo-500">{value.contractorName}</p>
        </div>
        <button onClick={() => onSelect(null)} className="text-indigo-300 hover:text-indigo-500 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl hover:border-blue-400 text-sm text-gray-500 hover:text-gray-700 transition-colors bg-white">
        <ClipboardList size={14} className="text-gray-400" />
        <span>Select a completed work order…</span>
        <ChevronRight size={13} className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 max-h-56 overflow-y-auto">
          {completedWOs.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-400 text-center">
              <AlertCircle size={16} className="mx-auto mb-1 text-gray-300" />
              No completed work orders found
            </div>
          ) : completedWOs.map(wo => (
            <button key={wo.id} onClick={() => { onSelect(wo); setOpen(false) }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition-colors">
              <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{wo.woNumber}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{wo.title}</p>
                <p className="text-xs text-gray-400">{wo.contractorName} · {wo.items.length} services</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Create Bill Panel ────────────────────────────────────────────────────────

function CreateBillPanel({ initialWoId, onClose, onSaved }: {
  initialWoId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const { data: allWOs = [] } = useQuery<WorkOrder[]>({
    queryKey: ['work-orders'],
    queryFn: () => workOrderApi.getAll().then(r => r.data.data ?? []),
  })

  const initWO = initialWoId
    ? allWOs.find(w => String(w.id) === String(initialWoId)) ?? null
    : null

  const [wo, setWO] = useState<WorkOrder | null>(null)
  const [billDate, setBillDate] = useState(today())
  const [dueDate, setDueDate] = useState(addDays(today(), 30))
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState(today())
  const [supplyType, setSupplyType] = useState<SupplyType>('INTRA_STATE')
  const [tdsRate, setTdsRate] = useState(2)
  const [contractorInvNo, setContractorInvNo] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<BillItem[]>([])

  // Set initial WO once allWOs loads
  useEffect(() => {
    if (initialWoId && allWOs.length > 0 && !wo) {
      const found = allWOs.find(w => String(w.id) === String(initialWoId)) ?? null
      if (found) setWO(found)
    }
  }, [allWOs, initialWoId])

  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])

  useEffect(() => {
    if (wo) {
      setPeriodFrom(wo.startDate)
      setItems(wo.items.map(it => ({
        id: it.id,
        description: it.description,
        unit: it.unit,
        contractedQty: it.quantity,
        actualQty: it.quantity,
        rate: it.rate,
        gstRate: 18,
      })))
    } else {
      setItems([])
    }
  }, [wo])

  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  function updateItem(id: string, field: keyof BillItem, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const calc = calcBill(items, tdsRate, supplyType)

  async function handleSave() {
    if (!wo) { toast.error('Select a work order'); return }
    if (items.some(it => it.actualQty <= 0)) { toast.error('All actual quantities must be > 0'); return }
    setSaving(true)
    try {
      const payload = {
        workOrderId: wo.id,
        woNumber: wo.woNumber,
        woTitle: wo.title,
        contractorId: wo.contractorId,
        contractorName: wo.contractorName,
        billingPeriodFrom: periodFrom,
        billingPeriodTo: periodTo,
        billDate,
        dueDate,
        supplyType,
        tdsRate,
        status: 'DRAFT',
        items,
        contractorInvoiceNo: contractorInvNo,
        notes,
      }
      const res = await workBillApi.create(payload)
      const billNumber = res.data.data?.billNumber ?? ''
      toast.success(`Work Bill ${billNumber} created`)
      await queryClient.invalidateQueries({ queryKey: ['work-bills'] })
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      onSaved()
      handleClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create work bill')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors'

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 w-[70vw] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                <FileText size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">New Work Bill</h2>
                <p className="text-xs text-gray-400 mt-0.5">Bill number assigned on save</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClose} className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-semibold shadow-sm transition-colors">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Save Bill
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-6 space-y-5">

              {/* Work Order + Bill Meta */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-md p-5 space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Work Order <span className="text-blue-500">*</span></p>
                  <WOSelector value={wo} onSelect={setWO} />
                </div>
                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bill No.</p>
                  <p className="text-sm text-gray-400 italic font-mono">Auto-assigned on save</p>
                </div>
              </div>

              {/* Dates + Meta bar */}
              <div className="bg-white rounded-xl shadow-md">
                <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                  {[
                    { label: 'Bill Date', val: billDate, set: setBillDate },
                    { label: 'Due Date', val: dueDate, set: setDueDate },
                    { label: 'Period From', val: periodFrom, set: setPeriodFrom },
                    { label: 'Period To', val: periodTo, set: setPeriodTo },
                  ].map(f => (
                    <div key={f.label} className="px-5 py-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{f.label}</p>
                      <input type="date" value={f.val} onChange={e => f.set(e.target.value)}
                        className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
                    </div>
                  ))}
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Contractor Inv. No</p>
                    <input type="text" value={contractorInvNo} onChange={e => setContractorInvNo(e.target.value)}
                      placeholder="e.g. INV-2024-001"
                      className="w-full text-sm text-gray-700 placeholder-gray-300 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Supply Type + TDS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-md p-5 space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supply Type</p>
                  <div className="flex gap-2">
                    {(['INTRA_STATE', 'INTER_STATE'] as SupplyType[]).map(t => (
                      <button key={t} onClick={() => setSupplyType(t)}
                        className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors ${
                          supplyType === t ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}>
                        {t === 'INTRA_STATE' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5 space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TDS Deduction</p>
                  <select value={tdsRate} onChange={e => setTdsRate(Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 bg-white">
                    {TDS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Line Items */}
              {wo && items.length > 0 ? (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Measured Quantities &amp; GST</p>
                    <p className="text-xs text-gray-400 mt-0.5">Update actual quantities if they differ from contracted. Set GST rate per service.</p>
                  </div>

                  {/* Table header */}
                  <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100"
                    style={{ gridTemplateColumns: '2fr 70px 90px 90px 100px 80px 110px' }}>
                    <div className="px-5 py-3">Service</div>
                    <div className="px-3 py-3 text-center">Unit</div>
                    <div className="px-3 py-3 text-right">Contracted</div>
                    <div className="px-3 py-3 text-right">Actual</div>
                    <div className="px-3 py-3 text-right">Rate (₹)</div>
                    <div className="px-3 py-3 text-center">GST %</div>
                    <div className="px-3 py-3 text-right">Amount (₹)</div>
                  </div>

                  {items.map((it, idx) => {
                    const amount = it.actualQty * it.rate
                    const gstAmt = amount * it.gstRate / 100
                    const diff = it.actualQty - it.contractedQty
                    return (
                      <div key={it.id}
                        className={`grid items-center border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                        style={{ gridTemplateColumns: '2fr 70px 90px 90px 100px 80px 110px' }}>
                        <div className="px-5 py-3">
                          <p className="text-sm font-medium text-gray-800">{it.description}</p>
                          {diff !== 0 && (
                            <span className={`text-[10px] font-semibold ${diff > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                              {diff > 0 ? `+${diff}` : diff} from contracted
                            </span>
                          )}
                        </div>
                        <div className="px-3 py-2 text-center text-xs text-gray-400">{it.unit}</div>
                        <div className="px-3 py-2 text-right text-sm text-gray-400 tabular-nums">{it.contractedQty.toLocaleString('en-IN')}</div>
                        <div className="px-2 py-2">
                          <input type="number" min="0" step="0.01" value={it.actualQty || ''}
                            onChange={e => updateItem(it.id, 'actualQty', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div className="px-3 py-2 text-right text-sm text-gray-600 tabular-nums">₹{fmt(it.rate)}</div>
                        <div className="px-2 py-2">
                          <select value={it.gstRate} onChange={e => updateItem(it.id, 'gstRate', Number(e.target.value))}
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-center">
                            {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </div>
                        <div className="px-3 py-3 text-right">
                          <p className="text-sm font-bold text-gray-800 tabular-nums">₹{fmt(amount)}</p>
                          {it.gstRate > 0 && <p className="text-[10px] text-blue-500 tabular-nums">+GST ₹{fmt(gstAmt)}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-400">
                  <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">Select a work order to populate services</p>
                </div>
              )}

              {/* Summary + Notes side by side */}
              <div className="grid grid-cols-2 gap-5">

                {/* Bill Summary */}
                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Bill Summary</p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal (Work Value)</span>
                      <span className="tabular-nums font-medium">₹{fmt(calc.subtotal)}</span>
                    </div>
                    {supplyType === 'INTRA_STATE' ? (
                      <>
                        <div className="flex justify-between text-gray-500">
                          <span>CGST</span>
                          <span className="tabular-nums">₹{fmt(calc.cgst)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>SGST</span>
                          <span className="tabular-nums">₹{fmt(calc.sgst)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-gray-500">
                        <span>IGST</span>
                        <span className="tabular-nums">₹{fmt(calc.igst)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600 border-t pt-2">
                      <span>Gross Total</span>
                      <span className="tabular-nums font-semibold">₹{fmt(calc.subtotal + calc.gstTotal)}</span>
                    </div>
                    {tdsRate > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>TDS ({tdsRate}% on base)</span>
                        <span className="tabular-nums font-medium">−₹{fmt(calc.tds)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[15px] border-t pt-3 mt-1 text-gray-900">
                      <span>Net Payable</span>
                      <span className="tabular-nums text-gray-900">₹{fmt(calc.netPayable)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-white rounded-xl shadow-md p-5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                    placeholder="Payment instructions, site remarks, deduction details…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors resize-none" />
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400 tabular-nums">
              {wo ? `${items.length} services · Net payable ₹${fmt(calc.netPayable)}` : 'Select a work order to begin'}
            </p>
            <div className="flex gap-2">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !wo}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-semibold shadow-sm transition-colors">
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                Save Work Bill
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ bill, onClose, onDone }: {
  bill: WorkBill; onClose: () => void; onDone: () => void
}) {
  const calc = calcBill(bill.items, bill.tdsRate, bill.supplyType)
  const paid = bill.payments.reduce((s, p) => s + Number(p.amount), 0)
  const balance = calc.netPayable - paid
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState(balance.toFixed(2))
  const [mode, setMode] = useState<PayMode>('BANK_TRANSFER')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > balance + 0.01) { toast.error(`Cannot exceed balance ₹${fmt(balance)}`); return }
    setSaving(true)
    try {
      await workBillApi.addPayment(bill.id, { date, amount: amt, mode, reference })
      const newPaid = paid + amt
      const isFullyPaid = newPaid >= calc.netPayable - 0.01
      toast.success(isFullyPaid ? 'Bill fully paid!' : 'Payment recorded')
      await queryClient.invalidateQueries({ queryKey: ['work-bills'] })
      onDone()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900">Record Payment</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3.5 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Net Payable</span>
              <span className="font-semibold text-gray-800">₹{fmt(calc.netPayable)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Paid So Far</span>
              <span className="font-semibold text-green-600">₹{fmt(paid)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-1.5 text-gray-800">
              <span>Balance</span>
              <span className="text-blue-500">₹{fmt(balance)}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Payment Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Amount (₹)</label>
            <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:border-blue-400">
              <IndianRupee size={14} className="text-gray-400 mr-1.5" />
              <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                className="flex-1 text-sm outline-none text-gray-800" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Payment Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {PAY_MODES.map(m => (
                <button key={m.value} onClick={() => setMode(m.value)}
                  className={`py-2 text-xs font-semibold rounded-xl transition-colors ${
                    mode === m.value ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Reference No. <span className="font-normal text-gray-300">(optional)</span></label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
              placeholder="UTR / Cheque no. / Transaction ID"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bill Detail Panel ────────────────────────────────────────────────────────

function BillDetail({ bill, onClose, onUpdated }: {
  bill: WorkBill; onClose: () => void; onUpdated: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const navigate = useNavigate()
  const cfg = STATUS_CONFIG[bill.status]
  const calc = calcBill(bill.items, bill.tdsRate, bill.supplyType)
  const paid = bill.payments.reduce((s, p) => s + Number(p.amount), 0)
  const balance = calc.netPayable - paid
  const queryClient = useQueryClient()

  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])
  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  async function advanceStatus() {
    const next: Record<WBStatus, WBStatus | null> = {
      DRAFT: 'APPROVED', SUBMITTED: 'APPROVED', APPROVED: null, PAID: null
    }
    const ns = next[bill.status]
    if (!ns) return
    try {
      await workBillApi.updateStatus(bill.id, ns)
      toast.success('Bill Approved')
      await queryClient.invalidateQueries({ queryKey: ['work-bills'] })
      onUpdated()
      handleClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update status')
    }
  }

  const nextLabel: Record<WBStatus, string | null> = {
    DRAFT: 'Approve Bill', SUBMITTED: 'Approve Bill', APPROVED: null, PAID: null
  }
  const nextColor: Record<WBStatus, string> = {
    DRAFT: 'bg-green-600 hover:bg-green-700', SUBMITTED: 'bg-green-600 hover:bg-green-700',
    APPROVED: '', PAID: '',
  }

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 w-[70vw] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-gray-900">{bill.billNumber}</h2>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{bill.woNumber} · {bill.woTitle}</p>
            </div>
            <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Contractor + dates */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <HardHat size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{bill.contractorName}</p>
                  {bill.contractorInvoiceNo && <p className="text-xs text-gray-400">Contractor Inv: {bill.contractorInvoiceNo}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  { l: 'Bill Date', v: fmtDate(bill.billDate) },
                  { l: 'Due Date', v: fmtDate(bill.dueDate) },
                  { l: 'Period', v: `${fmtDate(bill.billingPeriodFrom)} – ${fmtDate(bill.billingPeriodTo)}` },
                ].map(f => (
                  <div key={f.l}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{f.l}</p>
                    <p className="font-medium text-gray-700">{f.v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Services Billed</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Service</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-3 py-2.5 text-center">GST</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bill.items.map(it => (
                    <tr key={it.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800">{it.description}</p>
                        <p className="text-xs text-gray-400">{it.unit}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{it.actualQty.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">₹{fmt(it.rate)}</td>
                      <td className="px-3 py-2.5 text-center text-blue-500 text-xs font-semibold">{it.gstRate}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800">₹{fmt(it.actualQty * it.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-2 text-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bill Summary</p>
              {[
                { l: 'Subtotal', v: `₹${fmt(calc.subtotal)}`, cls: 'text-gray-600' },
                ...(bill.supplyType === 'INTRA_STATE'
                  ? [{ l: 'CGST', v: `₹${fmt(calc.cgst)}`, cls: 'text-gray-500' }, { l: 'SGST', v: `₹${fmt(calc.sgst)}`, cls: 'text-gray-500' }]
                  : [{ l: 'IGST', v: `₹${fmt(calc.igst)}`, cls: 'text-gray-500' }]),
                { l: 'Gross Total', v: `₹${fmt(calc.subtotal + calc.gstTotal)}`, cls: 'text-gray-700 font-semibold' },
                ...(bill.tdsRate > 0 ? [{ l: `TDS (${bill.tdsRate}%)`, v: `−₹${fmt(calc.tds)}`, cls: 'text-gray-500' }] : []),
              ].map(r => (
                <div key={r.l} className={`flex justify-between ${r.cls}`}>
                  <span>{r.l}</span><span className="tabular-nums">{r.v}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base border-t pt-2.5 mt-1 text-gray-900">
                <span>Net Payable</span>
                <span className="text-gray-900 tabular-nums">₹{fmt(calc.netPayable)}</span>
              </div>
            </div>

            {/* Payment History */}
            {bill.payments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Payment History</p>
                <div className="space-y-2">
                  {bill.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-gray-800">₹{fmt(p.amount)}</span>
                        <span className="text-gray-400 text-xs ml-2">{PAY_MODES.find(m => m.value === p.mode)?.label}</span>
                        {p.reference && <span className="text-gray-400 text-xs ml-1">· {p.reference}</span>}
                      </div>
                      <span className="text-xs text-gray-400">{fmtDate(p.date)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                    <span className="text-green-600">Paid</span>
                    <span className="text-green-600 tabular-nums">₹{fmt(paid)}</span>
                  </div>
                  {balance > 0.01 && (
                    <div className="flex justify-between text-sm font-bold text-blue-500">
                      <span>Balance Due</span>
                      <span className="tabular-nums">₹{fmt(balance)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {bill.notes && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
                <p className="text-sm text-gray-600 leading-relaxed">{bill.notes}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 bg-white border-t border-gray-100 space-y-2.5 shrink-0">
            {nextLabel[bill.status] && (
              <button onClick={advanceStatus}
                className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors ${nextColor[bill.status]}`}>
                <CheckCircle2 size={15} /> {nextLabel[bill.status]}
              </button>
            )}
            {(bill.status === 'APPROVED' || bill.status === 'SUBMITTED') && balance > 0.01 && (
              <button onClick={() => setShowPayment(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors">
                <IndianRupee size={15} /> Record Payment
              </button>
            )}
            <button onClick={() => navigate(`/site/work-bills/${bill.id}/invoice`)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Printer size={15} /> Print Invoice
            </button>
            <button onClick={handleClose}
              className="w-full py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>

      {showPayment && (
        <RecordPaymentModal bill={bill} onClose={() => setShowPayment(false)} onDone={() => { onUpdated(); handleClose() }} />
      )}
    </>
  )
}

// ─── Bill Row ─────────────────────────────────────────────────────────────────

function BillRow({ bill, onClick }: { bill: WorkBill; onClick: () => void }) {
  const cfg = STATUS_CONFIG[bill.status]
  const calc = calcBill(bill.items, bill.tdsRate, bill.supplyType)
  const paid = bill.payments.reduce((s, p) => s + Number(p.amount), 0)
  const pct = calc.netPayable > 0 ? Math.min(100, (paid / calc.netPayable) * 100) : 0

  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-5 text-left group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-xs font-bold font-mono text-blue-500">{bill.billNumber}</span>
            <span className="text-xs font-mono text-gray-400">{bill.woNumber}</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900 truncate">{bill.woTitle}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <HardHat size={11} /> {bill.contractorName}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={11} /> {fmtDate(bill.billDate)}
            </span>
          </div>
          {bill.status !== 'DRAFT' && bill.status !== 'SUBMITTED' && (
            <div className="mt-2.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-600 font-medium">₹{fmt(paid)} paid</span>
                {calc.netPayable - paid > 0.01 && (
                  <span className="text-xs text-orange-500 font-medium">₹{fmt(calc.netPayable - paid)} due</span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold text-gray-900 tabular-nums">₹{fmt(calc.netPayable)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Net payable</p>
          <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors ml-auto mt-2" />
        </div>
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkBillsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialWoId = searchParams.get('woId') ?? undefined

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<WBStatus | 'ALL'>('ALL')
  const [detailBill, setDetailBill] = useState<WorkBill | undefined>()
  const [addBtnHovered, setAddBtnHovered] = useState(false)

  const { data: bills = [] } = useQuery<WorkBill[]>({
    queryKey: ['work-bills'],
    queryFn: () => workBillApi.getAll().then(r => r.data.data ?? []),
  })

  const filtered = bills.filter(b => {
    if (activeTab !== 'ALL' && b.status !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      return b.billNumber.toLowerCase().includes(q) ||
        b.contractorName.toLowerCase().includes(q) ||
        b.woTitle.toLowerCase().includes(q) ||
        b.woNumber.toLowerCase().includes(q)
    }
    return true
  })

  const counts = STATUS_TABS.reduce((acc, t) => {
    acc[t] = t === 'ALL' ? bills.length : bills.filter(b => b.status === t).length
    return acc
  }, {} as Record<string, number>)

  const approvedBills = bills.filter(b => b.status === 'APPROVED' || b.status === 'PAID' || b.status === 'SUBMITTED')
  const totalPayable = approvedBills.reduce((s, b) => s + calcBill(b.items, b.tdsRate, b.supplyType).netPayable, 0)
  const totalPaid = approvedBills.reduce((s, b) => s + b.payments.reduce((ps, p) => ps + Number(p.amount), 0), 0)

  return (
    <>
      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #ddd6fe 0%, #ede9fe 35%, #f5f3ff 65%, #faf9ff 85%, #ffffff 100%)' }}>
        {/* Nav row */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-4">
          <button onClick={() => navigate('/site')}
            className="text-violet-500 hover:text-violet-900 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 flex justify-center">
            <SiteFloatingNav theme="light" inline />
          </div>
        </div>

        {/* Title + add button */}
        {bills.length > 0 && (
          <div className="px-6 pt-6 pb-5 flex items-center justify-between">
            <div className="shrink-0">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Work Bills</h1>
              <p className="text-xs text-gray-500">Contractor invoices received, with GST, TDS and payments</p>
            </div>
            <button
              onClick={() => navigate(`/site/work-bills/new${initialWoId ? `?woId=${initialWoId}` : ''}`)}
              onMouseEnter={() => setAddBtnHovered(true)}
              onMouseLeave={() => setAddBtnHovered(false)}
              className="active:scale-95 shrink-0"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: addBtnHovered
                  ? 'linear-gradient(135deg, #6d28d9, #4f46e5)'
                  : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                border: 'none', color: '#fff',
                fontSize: 22, fontWeight: 300,
                fontFamily: '"Roboto", sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', lineHeight: 1,
                transform: addBtnHovered ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.2s ease, background 0.2s ease',
                boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
              }}>+</button>
          </div>
        )}
      </div>

      {/* Status Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-2 overflow-x-auto">
        {STATUS_TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab ? STATUS_TAB_ACTIVE[tab] : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {tab === 'ALL' ? 'All' : STATUS_CONFIG[tab as WBStatus].label}
            {counts[tab] > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{counts[tab]}</span>
            )}
          </button>
        ))}
        {bills.length > 0 && (
          <div className="ml-auto flex items-center shrink-0 mr-8 divide-x divide-gray-200">
            <div className="px-8" style={{ filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Total Payable</p>
              <p className="text-sm font-bold text-gray-900">₹{fmt(totalPayable)}</p>
            </div>
            <div className="px-8" style={{ filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Total Paid</p>
              <p className="text-sm font-bold text-green-600">₹{fmt(totalPaid)}</p>
            </div>
            <div className="px-8" style={{ filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Outstanding</p>
              <p className="text-sm font-bold text-orange-600">₹{fmt(totalPayable - totalPaid)}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all min-w-[200px]">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills…"
            className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400" />
          {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400" /></button>}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <FileText size={28} className="text-blue-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              {search || activeTab !== 'ALL' ? 'No bills found' : 'No work bills yet'}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {search || activeTab !== 'ALL' ? 'Try changing your filters' : 'Generate a bill from a completed work order'}
            </p>
            {!search && activeTab === 'ALL' && (
              <button onClick={() => navigate('/site/work-bills/new')}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                <Plus size={15} /> New Work Bill
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => (
              <BillRow key={b.id} bill={b} onClick={() => setDetailBill(b)} />
            ))}
          </div>
        )}
      </div>

      {detailBill && (
        <BillDetail
          bill={detailBill}
          onClose={() => setDetailBill(undefined)}
          onUpdated={() => { queryClient.invalidateQueries({ queryKey: ['work-bills'] }); setDetailBill(undefined) }}
        />
      )}
    </>
  )
}
