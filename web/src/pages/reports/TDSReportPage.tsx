import { useState, useEffect, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Calendar, ChevronDown, Loader2,
  Building2, LayoutList, Plus, X, Trash2, CheckCircle2, Clock,
} from 'lucide-react'
import { reportApi, tdsApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const PRESETS = [
  { label: 'Last 30d',     from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'),                                                                to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month',   from: () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),                            to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Quarter', from: () => { const q = Math.floor(new Date().getMonth()/3)*3; return format(new Date(new Date().getFullYear(), q, 1), 'yyyy-MM-dd') }, to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Year',    from: () => format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),                                                to: () => format(new Date(), 'yyyy-MM-dd') },
]

function dmy(iso: string) { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
function fmt(v: any) {
  const n = parseFloat(v ?? 0)
  if (!n) return '—'
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtPlain(v: any) {
  const n = parseFloat(v ?? 0)
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DateRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo, setTmpTo] = useState(to)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setTmpFrom(from); setTmpTo(to); setOpen(true) }}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-violet-400 transition-colors shadow-sm">
        <Calendar size={14} className="text-violet-500" />
        {dmy(from)} – {dmy(to)}
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-72">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => { const f=p.from(),t=p.to(); setTmpFrom(f);setTmpTo(t);onChange(f,t);setOpen(false) }}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${from===p.from()&&to===p.to() ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-violet-100'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
            <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
          </div>
          <button onClick={() => { onChange(tmpFrom, tmpTo); setOpen(false) }} className="mt-3 w-full py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700">Apply</button>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const textColor = color.replace('border-l-', 'text-').replace('-500', '-600')
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <p className={`text-xs font-semibold mb-1 ${textColor}`}>{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── TDS Outward tab ───────────────────────────────────────────────────────────
function TDSOutwardTab({ outletId, from, to }: { outletId: number; from: string; to: string }) {
  const [innerTab, setInnerTab] = useState<'section' | 'party'>('section')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!outletId) return
    setLoading(true)
    reportApi.getTDSReport(outletId, from, to)
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [outletId, from, to])

  const bySection: any[] = data?.bySection ?? []
  const byParty: any[]   = data?.byParty   ?? []
  const totalBase = parseFloat(data?.totalBase ?? 0)
  const totalTDS  = parseFloat(data?.totalTds  ?? 0)

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Base Amount" value={`₹ ${fmtPlain(totalBase)}`} color="border-l-violet-500" />
        <StatCard label="Total TDS Deducted" value={`₹ ${fmtPlain(totalTDS)}`} color="border-l-blue-500" />
        <StatCard label="Sections" value={String(bySection.length)} sub="active TDS sections" color="border-l-orange-500" />
        <StatCard label="Parties" value={String(byParty.length)} sub="vendors with TDS" color="border-l-green-500" />
      </div>

      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setInnerTab('section')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${innerTab === 'section' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <LayoutList size={13} /> By Section
          </button>
          <button onClick={() => setInnerTab('party')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${innerTab === 'party' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Building2 size={13} /> By Party
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-20 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-violet-400" />
          <p className="text-sm text-gray-400">Loading TDS data…</p>
        </div>
      ) : innerTab === 'section' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Section-wise TDS Summary (Outward)</p>
            <p className="text-xs text-gray-500">TDS deducted on vendor payments — {dmy(from)} to {dmy(to)}</p>
          </div>
          {bySection.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No TDS deductions in this period</div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ background: 'linear-gradient(to right,#eff6ff,#eef2ff)', borderBottom: '1px solid #dbeafe' }}>
                <tr>
                  {['Section','Description','Rate','Transactions','Base Amount','TDS Deducted','Deposited','Pending'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#1f2937', textAlign: ['Base Amount','TDS Deducted','Deposited','Pending','Transactions'].includes(h) ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bySection.map((s: any) => (
                  <tr key={s.sectionCode} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">{s.sectionCode}</span></td>
                    <td className="px-5 py-4 text-gray-700">{s.description}</td>
                    <td className="px-5 py-4 text-gray-600">{parseFloat(s.rate).toFixed(2)}%</td>
                    <td className="px-5 py-4 text-right text-gray-600">{s.transactions}</td>
                    <td className="px-5 py-4 text-right font-medium text-gray-800">{fmt(s.totalBase)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-blue-700">{fmt(s.totalTds)}</td>
                    <td className="px-5 py-4 text-right text-green-600">{fmt(s.deposited)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`font-semibold ${parseFloat(s.pending) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmt(s.pending)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50/80">
                <tr>
                  <td colSpan={4} className="px-5 py-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider">Total</td>
                  <td className="px-5 py-3.5 text-right font-bold text-gray-900">{fmt(totalBase)}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-blue-700">{fmt(totalTDS)}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-green-600">{fmt(bySection.reduce((s: number, r: any) => s + parseFloat(r.deposited ?? 0), 0))}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-red-600">{fmt(bySection.reduce((s: number, r: any) => s + parseFloat(r.pending ?? 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Party-wise TDS Summary (Outward)</p>
            <p className="text-xs text-gray-500">TDS deducted per vendor — {dmy(from)} to {dmy(to)}</p>
          </div>
          {byParty.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No TDS deductions in this period</div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ background: 'linear-gradient(to right,#eff6ff,#eef2ff)', borderBottom: '1px solid #dbeafe' }}>
                <tr>
                  {['#','Vendor','PAN','Section','Transactions','Base Amount','TDS Deducted','Deposited','Pending'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#1f2937', textAlign: ['Base Amount','TDS Deducted','Deposited','Pending','Transactions'].includes(h) ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byParty.map((p: any, i: number) => (
                  <tr key={`${p.supplierId}-${p.sectionCode}`} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-4 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-4 font-medium text-gray-800">{p.supplierName}</td>
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs">{p.pan || '—'}</td>
                    <td className="px-5 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-xs font-bold">{p.sectionCode}</span></td>
                    <td className="px-5 py-4 text-right text-gray-600">{p.transactions}</td>
                    <td className="px-5 py-4 text-right font-medium text-gray-800">{fmt(p.totalBase)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-blue-700">{fmt(p.totalTds)}</td>
                    <td className="px-5 py-4 text-right text-green-600">{fmt(p.deposited)}</td>
                    <td className="px-5 py-4 text-right"><span className={`font-semibold ${parseFloat(p.pending) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmt(p.pending)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add receivable form ───────────────────────────────────────────────────────
const EMPTY_FORM = { customerName: '', invoiceNumber: '', tdsSectionId: '', paymentDate: format(new Date(), 'yyyy-MM-dd'), baseAmount: '', tdsRate: '', tdsAmount: '', notes: '' }

function AddReceivableForm({ outletId, sections, onSaved, onCancel }: {
  outletId: number
  sections: any[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  function setField(k: string, v: string) {
    const next = { ...form, [k]: v }
    // auto-compute tdsAmount when base or rate changes
    if (k === 'baseAmount' || k === 'tdsRate') {
      const b = parseFloat(k === 'baseAmount' ? v : next.baseAmount) || 0
      const r = parseFloat(k === 'tdsRate' ? v : next.tdsRate) || 0
      next.tdsAmount = b > 0 && r > 0 ? ((b * r) / 100).toFixed(2) : next.tdsAmount
    }
    if (k === 'tdsSectionId') {
      const sec = sections.find((s: any) => String(s.id) === v)
      if (sec) next.tdsRate = String(parseFloat(sec.rate))
      const b = parseFloat(next.baseAmount) || 0
      const r = parseFloat(k === 'tdsSectionId' ? (sec?.rate ?? 0) : next.tdsRate) || 0
      if (b > 0 && r > 0) next.tdsAmount = ((b * r) / 100).toFixed(2)
    }
    setForm(next)
  }

  async function save() {
    if (!form.customerName || !form.tdsSectionId || !form.paymentDate || !form.baseAmount) return
    setSaving(true)
    try {
      await tdsApi.createReceivable({
        outletId,
        customerName: form.customerName,
        invoiceNumber: form.invoiceNumber,
        tdsSectionId: parseInt(form.tdsSectionId),
        paymentDate: form.paymentDate,
        baseAmount: parseFloat(form.baseAmount),
        tdsRate: parseFloat(form.tdsRate),
        tdsAmount: parseFloat(form.tdsAmount),
        notes: form.notes,
        createdBy: '',
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/50'

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-teal-800">Add TDS Inward Entry</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label>
          <input className={inp} placeholder="e.g. Tata Projects Ltd" value={form.customerName} onChange={e => setField('customerName', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Invoice / Bill No.</label>
          <input className={inp} placeholder="e.g. INV-2025-001" value={form.invoiceNumber} onChange={e => setField('invoiceNumber', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">TDS Section *</label>
          <select className={inp} value={form.tdsSectionId} onChange={e => setField('tdsSectionId', e.target.value)}>
            <option value="">Select section</option>
            {sections.map((s: any) => (
              <option key={s.id} value={s.id}>{s.sectionCode} — {s.description} ({parseFloat(s.rate).toFixed(2)}%)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date *</label>
          <input type="date" className={inp} value={form.paymentDate} onChange={e => setField('paymentDate', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Base Amount (₹) *</label>
          <input type="number" className={inp} placeholder="0.00" value={form.baseAmount} onChange={e => setField('baseAmount', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">TDS Rate (%)</label>
          <input type="number" className={inp} placeholder="auto" value={form.tdsRate} onChange={e => setField('tdsRate', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">TDS Amount (₹)</label>
          <input type="number" className={inp} placeholder="auto" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input className={inp} placeholder="Optional notes" value={form.notes} onChange={e => setField('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving || !form.customerName || !form.tdsSectionId || !form.baseAmount}
          className="px-5 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Entry'}
        </button>
      </div>
    </div>
  )
}

// ── TDS Inward tab ────────────────────────────────────────────────────────────
function TDSInwardTab({ outletId, from, to }: { outletId: number; from: string; to: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  function loadData() {
    if (!outletId) return
    setLoading(true)
    Promise.all([
      tdsApi.listReceivables(outletId, from, to),
      reportApi.getTDSInwardReport(outletId, from, to),
      tdsApi.getSections(),
    ]).then(([r, rpt, sec]) => {
      setRows((r.data as any).data ?? [])
      setReportData((rpt.data as any).data ?? null)
      setSections((sec.data as any).data ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [outletId, from, to])

  async function markReceived(row: any) {
    setMarkingId(row.id)
    try {
      await tdsApi.updateReceivable(row.id, {
        outletId,
        tdsSectionId: row.tdsSectionId,
        customerName: row.customerName,
        invoiceNumber: row.invoiceNumber,
        paymentDate: format(new Date(row.paymentDate), 'yyyy-MM-dd'),
        baseAmount: parseFloat(row.baseAmount),
        tdsRate: parseFloat(row.tdsRate),
        tdsAmount: parseFloat(row.tdsAmount),
        status: 'RECEIVED',
        notes: row.notes,
        receivedDate: format(new Date(), 'yyyy-MM-dd'),
      })
      loadData()
    } finally {
      setMarkingId(null)
    }
  }

  async function deleteRow(row: any) {
    if (!confirm(`Delete TDS receivable from ${row.customerName}?`)) return
    setDeletingId(row.id)
    try {
      await tdsApi.deleteReceivable(row.id, outletId)
      loadData()
    } finally {
      setDeletingId(null)
    }
  }

  const totalBase     = parseFloat(reportData?.totalBase     ?? 0)
  const totalTDS      = parseFloat(reportData?.totalTds      ?? 0)
  const totalReceived = parseFloat(reportData?.totalReceived ?? 0)
  const totalPending  = parseFloat(reportData?.totalPending  ?? 0)
  const byCustomer: any[] = reportData?.byCustomer ?? []

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Base Amount" value={`₹ ${fmtPlain(totalBase)}`} color="border-l-teal-500" />
        <StatCard label="Total TDS (Inward)" value={`₹ ${fmtPlain(totalTDS)}`} color="border-l-blue-500" />
        <StatCard label="Received in 26AS" value={`₹ ${fmtPlain(totalReceived)}`} color="border-l-green-500" />
        <StatCard label="Pending (not reflected)" value={`₹ ${fmtPlain(totalPending)}`} sub="not yet in Form 26AS" color="border-l-red-500" />
      </div>

      {/* Add entry */}
      {!showForm && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={14} /> Record TDS Deducted by Customer
          </button>
        </div>
      )}
      {showForm && (
        <AddReceivableForm
          outletId={outletId}
          sections={sections}
          onSaved={() => { setShowForm(false); loadData() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Receivables table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">TDS Deducted by Customers</p>
            <p className="text-xs text-gray-500">TDS customers deduct from our invoices — {dmy(from)} to {dmy(to)}</p>
          </div>
          <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg">{rows.length} entries</span>
        </div>
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-teal-400" />
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No TDS inward entries for this period</div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: 'linear-gradient(to right,#f0fdfa,#ccfbf1)', borderBottom: '1px solid #99f6e4' }}>
              <tr>
                {['Date','Customer','Invoice','Section','Base Amount','TDS Amount','Status','Notes',''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left text-gray-600"
                    style={{ textAlign: ['Base Amount','TDS Amount'].includes(h) ? 'right' : 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r: any) => (
                <tr key={r.id} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{dmy((r.paymentDate ?? '').substring(0, 10))}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.customerName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.invoiceNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-100 text-teal-700 text-xs font-bold">
                      {r.tdsSection?.sectionCode ?? `S${r.tdsSectionId}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(r.baseAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-700">{fmt(r.tdsAmount)}</td>
                  <td className="px-4 py-3">
                    {r.status === 'RECEIVED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        <CheckCircle2 size={10} /> Received
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                        <Clock size={10} /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate">{r.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.status === 'PENDING' && (
                        <button onClick={() => markReceived(r)} disabled={markingId === r.id}
                          title="Mark as received in 26AS"
                          className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg disabled:opacity-40 transition-colors">
                          {markingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        </button>
                      )}
                      <button onClick={() => deleteRow(r)} disabled={deletingId === r.id}
                        title="Delete"
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-40 transition-colors">
                        {deletingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50/80">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Total</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(rows.reduce((s: number, r: any) => s + parseFloat(r.baseAmount ?? 0), 0))}</td>
                <td className="px-4 py-3 text-right font-bold text-teal-700">{fmt(rows.reduce((s: number, r: any) => s + parseFloat(r.tdsAmount ?? 0), 0))}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* By customer summary */}
      {!loading && byCustomer.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">By Customer Summary</p>
          </div>
          <table className="w-full text-sm">
            <thead style={{ background: 'linear-gradient(to right,#f0fdfa,#ccfbf1)', borderBottom: '1px solid #99f6e4' }}>
              <tr>
                {['Customer','Section','Transactions','Base Amount','TDS Amount','Received','Pending'].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-left text-gray-600"
                    style={{ textAlign: ['Base Amount','TDS Amount','Received','Pending','Transactions'].includes(h) ? 'right' : 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byCustomer.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{c.customerName}</td>
                  <td className="px-5 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-100 text-teal-700 text-xs font-bold">{c.sectionCode}</span></td>
                  <td className="px-5 py-3 text-right text-gray-600">{c.transactions}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-800">{fmt(c.totalBase)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-teal-700">{fmt(c.totalTds)}</td>
                  <td className="px-5 py-3 text-right text-green-600">{fmt(c.received)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${parseFloat(c.pending) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmt(c.pending)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TDSReportPage() {
  const navigate = useNavigate()
  const { outletId } = useAuthStore()
  const today = format(new Date(), 'yyyy-MM-dd')
  const yearStart = format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')

  const [from, setFrom] = useState(yearStart)
  const [to, setTo] = useState(today)
  const [mainTab, setMainTab] = useState<'outward' | 'inward'>('outward')

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Hero */}
      <div className="relative shadow-[0_8px_40px_rgba(109,40,217,0.25)]">
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>
        <div className="relative px-8 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
                <ArrowLeft size={16} className="text-white" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                <FileText size={26} className="text-violet-200" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Reports</p>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">TDS Report</h1>
                <p className="text-sm text-blue-200 mt-0.5">Tax Deducted at Source — outward (on payments) and inward (by customers)</p>
              </div>
            </div>
          </div>
          {/* Tabs pinned to bottom of hero */}
          <div className="flex items-center gap-1 mt-5">
            <button
              onClick={() => setMainTab('outward')}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all ${mainTab === 'outward' ? 'bg-white text-violet-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
            >
              TDS Outward
            </button>
            <button
              onClick={() => setMainTab('inward')}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all ${mainTab === 'inward' ? 'bg-white text-teal-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
            >
              TDS Inward
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-8 py-4 bg-white border-b border-gray-100 flex flex-wrap items-center gap-3">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
      </div>

      {outletId && mainTab === 'outward' && <TDSOutwardTab outletId={outletId} from={from} to={to} />}
      {outletId && mainTab === 'inward'  && <TDSInwardTab  outletId={outletId} from={from} to={to} />}
    </div>
  )
}
