import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Receipt, Plus, X, ChevronLeft, ChevronRight, Loader2,
  Pencil, Trash2, CheckCircle2, Clock, XCircle,
  Building2, Zap, Droplets, Users, Package, Truck,
  Wrench, Coins, Sparkles, Megaphone, Pencil as PencilIcon,
  MoreHorizontal, Tag, AlertCircle, Download, RefreshCw,
  AlertTriangle, TrendingDown, Info, Repeat, BarChart3, List,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { expenseApi, expenseCategoryApi, outletApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0.00'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string) {
  const d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function today() { return new Date().toISOString().slice(0, 10) }
function istStr(d: Date) { return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) }

type DatePreset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'last_7' | 'last_30' | 'custom' | ''
const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_7',     label: 'Last 7 Days' },
  { key: 'last_30',    label: 'Last 30 Days' },
  { key: 'custom',     label: 'Custom' },
]
function getPresetRange(preset: DatePreset) {
  const now = new Date()
  const offset = (days: number) => istStr(new Date(now.getTime() + days * 86_400_000))
  switch (preset) {
    case 'today':      return { from: istStr(now), to: istStr(now) }
    case 'this_week': { const day = now.getDay(); return { from: offset(-(day === 0 ? 6 : day - 1)), to: istStr(now) } }
    case 'this_month': return { from: istStr(now).slice(0, 8) + '01', to: istStr(now) }
    case 'last_month': { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); const le = new Date(now.getFullYear(), now.getMonth(), 0); return { from: istStr(lm), to: istStr(le) } }
    case 'last_7':  return { from: offset(-6), to: istStr(now) }
    case 'last_30': return { from: offset(-29), to: istStr(now) }
    default: return null
  }
}

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER']
const PAYMENT_LABELS: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CARD: 'Card', CHEQUE: 'Cheque', OTHER: 'Other' }
const PAYMENT_COLORS: Record<string, string> = { CASH: 'bg-emerald-50 text-emerald-700', UPI: 'bg-violet-50 text-violet-700', BANK_TRANSFER: 'bg-blue-50 text-blue-700', CARD: 'bg-indigo-50 text-indigo-700', CHEQUE: 'bg-amber-50 text-amber-700', OTHER: 'bg-gray-100 text-gray-600' }
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: 'Pending',  color: 'bg-amber-50 text-amber-700',    icon: <Clock size={10} /> },
  APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 size={10} /> },
  REJECTED: { label: 'Rejected', color: 'bg-red-50 text-red-700',        icon: <XCircle size={10} /> },
}
const GST_RATES = [0, 5, 12, 18, 28]
const ICON_MAP: Record<string, React.ReactNode> = {
  'building-2': <Building2 size={14} />, 'zap': <Zap size={14} />, 'droplets': <Droplets size={14} />,
  'users': <Users size={14} />, 'package': <Package size={14} />, 'truck': <Truck size={14} />,
  'wrench': <Wrench size={14} />, 'coins': <Coins size={14} />, 'sparkles': <Sparkles size={14} />,
  'megaphone': <Megaphone size={14} />, 'pencil': <PencilIcon size={14} />, 'more-horizontal': <MoreHorizontal size={14} />,
  'tag': <Tag size={14} />, 'receipt': <Receipt size={14} />,
}
function CategoryIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0"
      style={{ backgroundColor: color + '22', color }}>
      {ICON_MAP[icon] ?? <Receipt size={14} />}
    </span>
  )
}

// ─── Expense Form Modal ────────────────────────────────────────────────────────
function ExpenseFormModal({ expense, outletId, onClose, onSaved }: {
  expense: any | null; outletId: number; onClose: () => void; onSaved: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!expense

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoryApi.getAll(true).then(r => r.data.data ?? []),
  })

  const [form, setForm] = useState({
    categoryId:      expense?.expenseCategory?.id ?? '',
    amount:          expense?.amount ?? '',
    gstRate:         expense?.gstRate ?? '',
    supplyType:      expense?.supplyType ?? 'INTRA_STATE',
    cgstAmount:      expense?.cgstAmount ?? '',
    sgstAmount:      expense?.sgstAmount ?? '',
    igstAmount:      expense?.igstAmount ?? '',
    vendorGstin:     expense?.vendorGstin ?? '',
    itcEligible:     expense?.itcEligible ?? false,
    expenseDate:     expense?.expenseDate ?? today(),
    vendor:          expense?.vendor ?? '',
    paymentMode:     expense?.paymentMode ?? 'CASH',
    referenceNumber: expense?.referenceNumber ?? '',
    notes:           expense?.notes ?? '',
    submittedBy:     expense?.submittedBy ?? '',
    recurring:       expense?.recurring ?? false,
    recurrenceInterval: expense?.recurrenceInterval ?? 'MONTHLY',
    recurrenceDay:   expense?.recurrenceDay ?? '',
  })
  const patch = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  // Auto-split GST based on rate + supply type
  function applyGstRate(rate: number, supplyType: string) {
    const base = parseFloat(String(form.amount)) || 0
    if (base <= 0 || rate <= 0) { patch('cgstAmount', ''); patch('sgstAmount', ''); patch('igstAmount', ''); return }
    const gstAmt = parseFloat((base * rate / 100).toFixed(2))
    if (supplyType === 'INTER_STATE') {
      setForm(f => ({ ...f, gstRate: rate, igstAmount: gstAmt, cgstAmount: '', sgstAmount: '' }))
    } else {
      const half = parseFloat((gstAmt / 2).toFixed(2))
      setForm(f => ({ ...f, gstRate: rate, cgstAmount: half, sgstAmount: parseFloat((gstAmt - half).toFixed(2)), igstAmount: '' }))
    }
  }

  const totalGst = (parseFloat(String(form.cgstAmount)) || 0)
    + (parseFloat(String(form.sgstAmount)) || 0)
    + (parseFloat(String(form.igstAmount)) || 0)
  const totalPreview = (parseFloat(String(form.amount)) || 0) + totalGst

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = {
        outletId,
        categoryId:         Number(form.categoryId),
        amount:             parseFloat(String(form.amount)) || 0,
        gstAmount:          totalGst,
        cgstAmount:         parseFloat(String(form.cgstAmount)) || 0,
        sgstAmount:         parseFloat(String(form.sgstAmount)) || 0,
        igstAmount:         parseFloat(String(form.igstAmount)) || 0,
        gstRate:            parseFloat(String(form.gstRate)) || null,
        supplyType:         form.supplyType,
        vendorGstin:        form.vendorGstin || null,
        itcEligible:        form.itcEligible,
        expenseDate:        form.expenseDate ? `${form.expenseDate}T00:00:00Z` : undefined,
        vendor:             form.vendor || null,
        paymentMode:        form.paymentMode,
        referenceNumber:    form.referenceNumber || null,
        notes:              form.notes || null,
        submittedBy:        form.submittedBy || null,
        recurring:          form.recurring,
        recurrenceInterval: form.recurring ? form.recurrenceInterval : null,
        recurrenceDay:      form.recurring && form.recurrenceDay ? Number(form.recurrenceDay) : null,
      }
      return isEdit ? expenseApi.update(expense.id, payload) : expenseApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Expense updated' : 'Expense recorded')
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-stats'] })
      onSaved()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save expense'),
  })

  const canSubmit = form.categoryId && (parseFloat(String(form.amount)) || 0) >= 0 && form.expenseDate

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
              <Receipt size={16} className="text-rose-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
              <p className="text-xs text-gray-400 mt-0.5">All GST fields auto-split on rate selection</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category <span className="text-red-400">*</span></label>
              <select value={form.categoryId} onChange={e => patch('categoryId', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:outline-none">
                <option value="">Select category</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-400">*</span></label>
              <input type="date" value={form.expenseDate} onChange={e => patch('expenseDate', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 [color-scheme:light] focus:ring-2 focus:ring-rose-300 focus:outline-none" />
            </div>
          </div>

          {/* Amount + Vendor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (₹) <span className="text-red-400">*</span></label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => patch('amount', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor / Payee</label>
              <input value={form.vendor} onChange={e => patch('vendor', e.target.value)} placeholder="e.g. MSEB, Reliance"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:outline-none" />
            </div>
          </div>

          {/* ── GST Section ── */}
          <div className="border border-dashed border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">GST Details</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-gray-600">ITC Eligible</span>
                <div onClick={() => patch('itcEligible', !form.itcEligible)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${form.itcEligible ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.itcEligible ? 'left-4' : 'left-0.5'}`} />
                </div>
              </label>
            </div>

            {/* Supply type + GST rate */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Supply Type</label>
                <select value={form.supplyType} onChange={e => { patch('supplyType', e.target.value); if (form.gstRate) applyGstRate(Number(form.gstRate), e.target.value) }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none bg-white">
                  <option value="INTRA_STATE">Intra-State (CGST+SGST)</option>
                  <option value="INTER_STATE">Inter-State (IGST)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">GST Rate — auto-split ↓</label>
                <div className="flex gap-1.5 flex-wrap">
                  {GST_RATES.map(r => (
                    <button key={r} type="button"
                      onClick={() => { patch('gstRate', r); applyGstRate(r, form.supplyType) }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        Number(form.gstRate) === r && r > 0
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : r === 0
                          ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400'
                      }`}
                    >
                      {r === 0 ? 'None' : `${r}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CGST / SGST / IGST */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">CGST (₹)</label>
                <input type="number" min="0" step="0.01" value={form.cgstAmount}
                  onChange={e => patch('cgstAmount', e.target.value)} placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-indigo-300 focus:outline-none bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">SGST (₹)</label>
                <input type="number" min="0" step="0.01" value={form.sgstAmount}
                  onChange={e => patch('sgstAmount', e.target.value)} placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-indigo-300 focus:outline-none bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">IGST (₹)</label>
                <input type="number" min="0" step="0.01" value={form.igstAmount}
                  onChange={e => patch('igstAmount', e.target.value)} placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-indigo-300 focus:outline-none bg-white" />
              </div>
            </div>

            {/* Vendor GSTIN */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor GSTIN</label>
              <input value={form.vendorGstin} onChange={e => patch('vendorGstin', e.target.value.toUpperCase())}
                placeholder="e.g. 27AABCU9603R1ZX" maxLength={15}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-300 focus:outline-none bg-white" />
            </div>

            {totalGst > 0 && (
              <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-indigo-100">
                <span className="text-xs text-indigo-600 font-semibold">Total GST</span>
                <span className="text-sm font-bold text-indigo-700">{fmtCur(totalGst)}</span>
              </div>
            )}
          </div>

          {/* Total preview */}
          {totalPreview > 0 && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600">Total (Amount + GST)</span>
              <span className="text-sm font-bold text-rose-700">{fmtCur(totalPreview)}</span>
            </div>
          )}

          {/* Payment + Ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Mode</label>
              <select value={form.paymentMode} onChange={e => patch('paymentMode', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:outline-none">
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reference No.</label>
              <input value={form.referenceNumber} onChange={e => patch('referenceNumber', e.target.value)} placeholder="Receipt / Cheque No."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:outline-none" />
            </div>
          </div>

          {/* Submitted By + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Submitted By</label>
              <input value={form.submittedBy} onChange={e => patch('submittedBy', e.target.value)} placeholder="Staff name"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
              <input value={form.notes} onChange={e => patch('notes', e.target.value)} placeholder="Optional remarks"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:outline-none" />
            </div>
          </div>

          {/* ── Recurring Section ── */}
          <div className="border border-dashed border-emerald-200 rounded-xl p-4 space-y-3 bg-emerald-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat size={14} className="text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Recurring Expense</p>
              </div>
              <div onClick={() => patch('recurring', !form.recurring)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${form.recurring ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.recurring ? 'left-4' : 'left-0.5'}`} />
              </div>
            </div>
            {form.recurring && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Repeat Every</label>
                  <select value={form.recurrenceInterval} onChange={e => patch('recurrenceInterval', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-300 focus:outline-none">
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>
                {form.recurrenceInterval === 'MONTHLY' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Day of Month</label>
                    <input type="number" min="1" max="28" value={form.recurrenceDay} onChange={e => patch('recurrenceDay', e.target.value)}
                      placeholder="e.g. 1 for 1st of month"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-300 focus:outline-none" />
                  </div>
                )}
              </div>
            )}
            {form.recurring && <p className="text-[11px] text-emerald-600">System will auto-create this expense on the next due date. No manual entry needed.</p>}
          </div>

        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-white transition-colors">Cancel</button>
          <button disabled={!canSubmit || saveMut.isPending} onClick={() => saveMut.mutate()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
            {saveMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Receipt size={14} /> {isEdit ? 'Update' : 'Add'} Expense</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Budget Banner ─────────────────────────────────────────────────────────────
function BudgetBanners({ budgetUsage }: { budgetUsage: any[] }) {
  if (!budgetUsage?.length) return null
  const warnings = budgetUsage.filter((b: any) => {
    const pct = b.budget > 0 ? (b.spent / b.budget) * 100 : 0
    return pct >= 80
  })
  if (!warnings.length) return null
  return (
    <div className="space-y-2">
      {warnings.map((b: any) => {
        const pct = Math.min(100, Math.round((b.spent / b.budget) * 100))
        const over = b.spent > b.budget
        return (
          <div key={b.categoryId} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${over ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            {over ? <AlertTriangle size={15} className="text-red-500 flex-shrink-0" /> : <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <span className={`font-semibold ${over ? 'text-red-700' : 'text-amber-700'}`}>{b.categoryName}</span>
              <span className={`ml-2 ${over ? 'text-red-600' : 'text-amber-600'}`}>
                {over ? `Over budget by ${fmtCur(b.spent - b.budget)}` : `${pct}% of ${fmtCur(b.budget)} budget used`}
              </span>
            </div>
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
              <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const qc = useQueryClient()
  const { outletId } = useAuthStore()

  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(outletId)
  const effectiveOutletId = selectedOutletId

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })

  const [tab, setTab] = useState<'summary' | 'transactions'>('summary')

  // Shared date filter (used by both tabs)
  const [datePreset, setDatePreset]     = useState<DatePreset>('')
  const [fromDate,   setFromDate]       = useState('')
  const [toDate,     setToDate]         = useState('')
  // Transactions-only filters
  const [categoryId, setCategoryId]     = useState('')
  const [paymentMode, setPaymentMode]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [itcFilter,  setItcFilter]      = useState('')
  const [page, setPage]                 = useState(0)
  const [showForm, setShowForm]         = useState(false)
  const [editingExp, setEditingExp]     = useState<any | null>(null)
  const [exporting, setExporting]       = useState(false)

  const activeRange = useMemo(() => {
    if (datePreset === 'custom') return fromDate && toDate ? { from: fromDate, to: toDate } : null
    return getPresetRange(datePreset)
  }, [datePreset, fromDate, toDate])

  function applyPreset(p: DatePreset) { setDatePreset(prev => prev === p && p !== 'custom' ? '' : p); setPage(0) }

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoryApi.getAll(true).then(r => r.data.data ?? []),
  })

  const { data: stats } = useQuery({
    queryKey: ['expense-stats', effectiveOutletId, activeRange],
    queryFn: () => expenseApi.getStats(effectiveOutletId!, activeRange?.from, activeRange?.to).then(r => r.data.data),
    enabled: !!effectiveOutletId,
  })

  const { data: expData, isLoading } = useQuery({
    queryKey: ['expenses', effectiveOutletId, activeRange, categoryId, paymentMode, statusFilter, itcFilter, page],
    queryFn: () => expenseApi.getAll({
      outletId: effectiveOutletId!,
      from: activeRange?.from, to: activeRange?.to,
      categoryId: categoryId ? Number(categoryId) : undefined,
      paymentMode: paymentMode || undefined,
      status: statusFilter || undefined,
      itcEligible: itcFilter === 'yes' ? true : itcFilter === 'no' ? false : undefined,
      page, size: 15, sort: 'expenseDate,desc',
    }).then(r => r.data.data),
    enabled: !!effectiveOutletId,
  })

  const expenses: any[]      = expData?.content ?? []
  const totalPages: number   = expData?.totalPages ?? 1
  const totalElements: number = expData?.totalElements ?? 0
  const budgetUsage: any[]   = stats?.budgetUsage ?? []

  const deleteMut = useMutation({
    mutationFn: (id: number) => expenseApi.delete(id),
    onSuccess: () => { toast.success('Expense deleted'); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }) },
    onError: () => toast.error('Failed to delete'),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => expenseApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
    onError: () => toast.error('Failed to update status'),
  })

  function handleDelete(exp: any) {
    if (!confirm(`Delete this ${exp.expenseCategory?.name} expense of ${fmtCur(exp.totalAmount)}?`)) return
    deleteMut.mutate(exp.id)
  }

  async function handleExport() {
    if (!effectiveOutletId) return
    setExporting(true)
    try {
      const res = await expenseApi.exportCsv({
        outletId: effectiveOutletId,
        from: activeRange?.from, to: activeRange?.to,
        categoryId: categoryId ? Number(categoryId) : undefined,
        paymentMode: paymentMode || undefined,
        status: statusFilter || undefined,
      })
      const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]))
      const a = document.createElement('a')
      a.href = url
      a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Exported successfully')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const itcTotal = parseFloat(String(stats?.itcTotal ?? 0))
  const itcCgst  = parseFloat(String(stats?.itcCgst  ?? 0))
  const itcSgst  = parseFloat(String(stats?.itcSgst  ?? 0))
  const itcIgst  = parseFloat(String(stats?.itcIgst  ?? 0))

  const rangeLabel = activeRange
    ? `${activeRange.from} – ${activeRange.to}`
    : 'All Time'

  const kpiCards = [
    { label: "Today's Expenses", value: fmtCur(stats?.todayTotal ?? 0),   sub: `${stats?.todayCount ?? 0} entries`,              gradient: 'from-rose-500 to-red-600',      icon: <Receipt size={18} /> },
    { label: 'This Month',       value: fmtCur(stats?.monthTotal ?? 0),   sub: `${stats?.monthCount ?? 0} entries`,              gradient: 'from-indigo-500 to-violet-600',  icon: <TrendingDown size={18} /> },
    { label: rangeLabel,         value: fmtCur(stats?.allTimeTotal ?? 0), sub: `${stats?.allTimeCount ?? 0} entries in period`,  gradient: 'from-slate-500 to-gray-700',     icon: <BarChart3 size={18} /> },
    { label: 'ITC Claimable',    value: fmtCur(itcTotal),                 sub: itcTotal > 0 ? `CGST ${fmtCur(itcCgst)} · SGST ${fmtCur(itcSgst)}` : 'No ITC in period', gradient: 'from-emerald-500 to-teal-600', icon: <Zap size={18} /> },
  ]

  const PIE_COLORS = ['#f43f5e','#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#06b6d4','#ec4899']
  const PAYMENT_COLORS_HEX: Record<string, string> = { CASH: '#10b981', UPI: '#8b5cf6', BANK_TRANSFER: '#3b82f6', CARD: '#6366f1', CHEQUE: '#f59e0b', OTHER: '#94a3b8' }

  const statStrip = [
    { label: "Today's Expenses", value: fmtCur(stats?.todayTotal ?? 0),   sub: `${stats?.todayCount ?? 0} entries` },
    { label: 'This Month',       value: fmtCur(stats?.monthTotal ?? 0),   sub: `${stats?.monthCount ?? 0} entries` },
    { label: 'Period Total',     value: fmtCur(stats?.allTimeTotal ?? 0), sub: `${stats?.allTimeCount ?? 0} in period` },
    { label: 'ITC Claimable',    value: fmtCur(itcTotal),                 sub: itcTotal > 0 ? 'eligible GST' : 'no ITC', warn: itcTotal > 0 },
    { label: 'ITC CGST',         value: itcCgst > 0 ? fmtCur(itcCgst) : '—', sub: 'central tax' },
    { label: 'ITC SGST',         value: itcSgst > 0 ? fmtCur(itcSgst) : '—', sub: 'state tax' },
    { label: 'ITC IGST',         value: itcIgst > 0 ? fmtCur(itcIgst) : '—', sub: 'integrated' },
    { label: 'Categories',       value: String((stats?.byCategory ?? []).length || '—'), sub: 'expense types' },
  ]

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Gradient hero header ── */}
      <div className="relative bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        <div className="relative px-6 pt-5 pb-0">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center">
                <Receipt size={20} className="text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Expenses</h1>
                <p className="text-xs text-white/60">Track expenses · ITC GST breakdown · Budget monitoring</p>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="bg-white/10 rounded-xl p-1 backdrop-blur-sm flex gap-1">
              {([['summary', <BarChart3 size={13} />, 'Summary'], ['transactions', <List size={13} />, 'Transactions']] as const).map(([key, icon, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-white text-violet-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Date presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_PRESETS.filter(p => p.key !== 'custom').map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)}
                  className={`px-2.5 py-1 text-xs border rounded-lg transition-colors ${datePreset === p.key ? 'bg-white/25 border-white/40 text-white font-medium' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
              <button onClick={() => applyPreset('custom')}
                className={`px-2.5 py-1 text-xs border rounded-lg transition-colors ${datePreset === 'custom' ? 'bg-white/25 border-white/40 text-white font-medium' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white'}`}>
                Custom
              </button>
              {datePreset === 'custom' && (
                <>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="border border-white/25 rounded-lg px-2 py-1 text-xs bg-white/15 text-white [color-scheme:dark]" />
                  <span className="text-white/40 text-xs">–</span>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="border border-white/25 rounded-lg px-2 py-1 text-xs bg-white/15 text-white [color-scheme:dark]" />
                </>
              )}
              {datePreset && (
                <button onClick={() => { setDatePreset(''); setFromDate(''); setToDate('') }}
                  className="text-white/50 hover:text-white flex items-center gap-1 text-xs">
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              {outlets.length > 1 && (
                <select value={selectedOutletId ?? ''} onChange={e => { setSelectedOutletId(Number(e.target.value)); setPage(0) }}
                  className="border border-white/25 rounded-lg px-2.5 py-1.5 text-xs bg-white/15 text-white focus:outline-none [color-scheme:dark]">
                  {outlets.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60 transition-all">
                {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} Export CSV
              </button>
              <button onClick={() => { setEditingExp(null); setShowForm(true) }}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm">
                <Plus size={13} /> Add Expense
              </button>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative grid grid-cols-8 divide-x divide-white/10 border-t border-white/10 mt-2">
          {statStrip.map((s, i) => (
            <div key={i} className="px-3 py-2.5 text-center">
              <p className={`text-sm font-bold leading-tight ${(s as any).warn ? 'text-amber-300' : 'text-white'}`}>{s.value}</p>
              <p className="text-[10px] text-white/50 mt-0.5 truncate">{s.label}</p>
              {s.sub && <p className="text-[9px] text-white/35 truncate">{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Budget warnings */}
      <BudgetBanners budgetUsage={budgetUsage} />

      {/* ── Summary Tab ── */}
      {tab === 'summary' && (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Category breakdown bar chart */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
                  <h2 className="text-sm font-semibold text-white">Spend by Category</h2>
                </div>
                <div className="p-5">
                {!stats ? (
                  <div className="flex items-center justify-center h-48"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
                ) : (stats.byCategory ?? []).length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-sm text-gray-400">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.byCategory} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => fmtCur(Number(v))} />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {(stats.byCategory ?? []).map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                </div>
              </div>

              {/* Payment mode pie */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
                  <h2 className="text-sm font-semibold text-white">Payment Mode Breakdown</h2>
                  {stats?.byPaymentMode?.length > 0 && (
                    <span className="text-xs text-blue-100">
                      Total: {fmtCur((stats.byPaymentMode ?? []).reduce((s: number, d: any) => s + d.total, 0))}
                    </span>
                  )}
                </div>
                <div className="p-5">
                {!stats ? (
                  <div className="flex items-center justify-center h-52"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
                ) : (stats.byPaymentMode ?? []).length === 0 ? (
                  <div className="flex items-center justify-center h-52 text-sm text-gray-400">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={340}>
                    <PieChart>
                      <Pie data={stats.byPaymentMode} dataKey="total" nameKey="mode" cx="50%" cy="50%" outerRadius={90}
                        labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                        label={({ cx, cy, midAngle, payload, percent }: any) => {
                          const RADIAN = Math.PI / 180
                          const radius = 90 + 48
                          const x = cx + radius * Math.cos(-midAngle * RADIAN)
                          const y = cy + radius * Math.sin(-midAngle * RADIAN)
                          return (
                            <text x={x} y={y} fill="#9ca3af" fontSize={11}
                              textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                              {`${PAYMENT_LABELS[payload.mode] ?? payload.mode} ${(percent * 100).toFixed(0)}%`}
                            </text>
                          )
                        }}>
                        {(stats.byPaymentMode ?? []).map((_: any, i: number) => (
                          <Cell key={i} fill={PAYMENT_COLORS_HEX[_.mode] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, _: any, p: any) => [fmtCur(Number(v)), PAYMENT_LABELS[p.payload.mode] ?? p.payload.mode]} />
                      <Legend content={({ payload }) => {
                        const total = (stats.byPaymentMode ?? []).reduce((s: number, d: any) => s + d.total, 0)
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px', marginTop: 8, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                            {(payload ?? []).map((entry: any, i: number) => {
                              const pct = total > 0 ? ((entry.payload.total / total) * 100).toFixed(0) : '0'
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }} />
                                  <span style={{ color: '#6b7280', fontSize: 12 }}>{PAYMENT_LABELS[entry.value] ?? entry.value}</span>
                                  <span style={{ color: '#374151', fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                </div>
              </div>
            </div>

            {/* Category detail table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-violet-400 to-blue-400">
                <h2 className="text-sm font-semibold text-white">Category Summary</h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Category</th>
                    <th className="px-4 py-2.5 text-right">Entries</th>
                    <th className="px-4 py-2.5 text-right">Total Spend</th>
                    <th className="px-4 py-2.5 text-right">Share</th>
                    <th className="px-4 py-2.5 text-left w-36">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(stats?.byCategory ?? []).map((c: any, i: number) => {
                    const total = (stats?.byCategory ?? []).reduce((s: number, x: any) => s + x.total, 0)
                    const share = total > 0 ? Math.round((c.total / total) * 100) : 0
                    return (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0"
                              style={{ backgroundColor: c.color + '22', color: c.color }}>
                              {ICON_MAP[c.icon] ?? <Receipt size={14} />}
                            </span>
                            <span className="text-sm font-medium text-gray-800">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{c.count}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmtCur(c.total)}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">{share}%</td>
                        <td className="px-4 py-3">
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${share}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Budget usage */}
            {budgetUsage.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-5 py-3.5 bg-gradient-to-r from-violet-400 to-blue-400">
                  <h2 className="text-sm font-semibold text-white">Budget vs Actual (This Month)</h2>
                </div>
                <div className="p-5 space-y-4">
                  {budgetUsage.map((b: any) => {
                    const pct = b.budget > 0 ? Math.min(100, Math.round((b.spent / b.budget) * 100)) : 0
                    const over = b.spent > b.budget
                    return (
                      <div key={b.categoryId}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700">{b.categoryName}</span>
                          <span className={`text-xs font-semibold ${over ? 'text-red-600' : 'text-gray-500'}`}>
                            {fmtCur(b.spent)} / {fmtCur(b.budget)} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Transactions Tab ── */}
        {tab === 'transactions' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-400 mr-1">Period:</span>
                {DATE_PRESETS.map(p => (
                  <button key={p.key} onClick={() => applyPreset(p.key)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${datePreset === p.key ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              {datePreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0) }}
                    className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-rose-300" />
                  <span className="text-xs text-gray-400">to</span>
                  <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(0) }}
                    className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-rose-300" />
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(0) }}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300 w-44">
                  <option value="">All Categories</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={paymentMode} onChange={e => { setPaymentMode(e.target.value); setPage(0) }}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300 w-40">
                  <option value="">All Payment Modes</option>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
                </select>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300 w-36">
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select value={itcFilter} onChange={e => { setItcFilter(e.target.value); setPage(0) }}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300 w-36">
                  <option value="">ITC: All</option>
                  <option value="yes">ITC Eligible</option>
                  <option value="no">Not Eligible</option>
                </select>
                {(categoryId || paymentMode || statusFilter || itcFilter || datePreset) && (
                  <button onClick={() => { setCategoryId(''); setPaymentMode(''); setStatusFilter(''); setItcFilter(''); setDatePreset(''); setPage(0) }}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <X size={12} /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  {totalElements > 0 ? `${totalElements} expense${totalElements !== 1 ? 's' : ''}` : 'Expenses'}
                </p>
              </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Vendor / GSTIN</th>
                  <th className="px-4 py-2.5 text-left">Payment</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">CGST</th>
                  <th className="px-4 py-2.5 text-right">SGST</th>
                  <th className="px-4 py-2.5 text-right">IGST</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-center">ITC</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 12 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded-full w-3/4" /></td>
                      ))}
                    </tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-14 text-center">
                      <TrendingDown size={28} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">No expenses found</p>
                      <p className="text-gray-300 text-xs mt-1">Try changing filters or add a new expense</p>
                    </td>
                  </tr>
                ) : expenses.map((exp: any) => {
                  const cat = exp.expenseCategory
                  const sc  = STATUS_CONFIG[exp.status] ?? STATUS_CONFIG.PENDING
                  return (
                    <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        <div>{fmtDate(exp.expenseDate)}</div>
                        {exp.recurring && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium"><Repeat size={9} /> Recurring</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {cat && <CategoryIcon icon={cat.icon} color={cat.color} />}
                          <span className="text-sm font-medium text-gray-800">{cat?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{exp.vendor || '—'}</p>
                        {exp.vendorGstin && <p className="text-[10px] font-mono text-gray-400">{exp.vendorGstin}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PAYMENT_COLORS[exp.paymentMode] ?? 'bg-gray-100 text-gray-600'}`}>
                            {PAYMENT_LABELS[exp.paymentMode] ?? exp.paymentMode}
                          </span>
                          {exp.referenceNumber && <p className="text-[10px] text-gray-400 mt-0.5">{exp.referenceNumber}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">{fmtCur(exp.amount)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">{parseFloat(exp.cgstAmount) > 0 ? fmtCur(exp.cgstAmount) : '—'}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">{parseFloat(exp.sgstAmount) > 0 ? fmtCur(exp.sgstAmount) : '—'}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">{parseFloat(exp.igstAmount) > 0 ? fmtCur(exp.igstAmount) : '—'}</td>
                      <td className="px-4 py-3 text-right"><span className="text-sm font-bold text-gray-900">{fmtCur(exp.totalAmount)}</span></td>
                      <td className="px-4 py-3 text-center">
                        {exp.itcEligible
                          ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ ITC</span>
                          : <span className="text-[10px] text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>
                            {sc.icon} {sc.label}
                          </span>
                          {exp.status !== 'APPROVED' && (
                            <button onClick={() => statusMut.mutate({ id: exp.id, status: 'APPROVED' })}
                              className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium">Approve</button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => { setEditingExp(exp); setShowForm(true) }}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-colors" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(exp)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">{totalElements} total records</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 transition-colors">
                  <ChevronLeft size={13} />
                </button>
                <span className="text-xs font-medium text-gray-600">{page + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 transition-colors">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        )}

      {showForm && effectiveOutletId && (
        <ExpenseFormModal
          expense={editingExp}
          outletId={effectiveOutletId}
          onClose={() => { setShowForm(false); setEditingExp(null) }}
          onSaved={() => { setShowForm(false); setEditingExp(null) }}
        />
      )}
    </div>
  )
}
