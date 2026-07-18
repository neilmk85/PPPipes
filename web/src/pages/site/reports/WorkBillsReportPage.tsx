import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, FileText, HardHat, Calendar, IndianRupee, CheckCircle2, Clock, AlertCircle, ArrowLeft, Search, X, CreditCard } from 'lucide-react'
import { workBillApi, siteProjectApi } from '@/services/api'
import SiteFloatingNav from '../SiteFloatingNav'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  if (!d) return '—'
  const s = d.includes('T') ? d : d + 'T00:00:00+05:30'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function fmtPeriod(from?: string, to?: string) {
  if (!from && !to) return '—'
  return `${from ? fmtDate(from) : '?'} – ${to ? fmtDate(to) : '?'}`
}

function calcBill(items: any[], tdsRate: any, supplyType: string) {
  const subtotal = items.reduce((s: number, it: any) => s + Number(it.actualQty) * Number(it.rate), 0)
  const gstTotal = items.reduce((s: number, it: any) => s + Number(it.actualQty) * Number(it.rate) * Number(it.gstRate) / 100, 0)
  const tds = subtotal * Number(tdsRate) / 100
  const netPayable = subtotal + gstTotal - tds
  const cgst = supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const sgst = supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const igst = supplyType === 'INTER_STATE' ? gstTotal : 0
  return { subtotal, gstTotal, cgst, sgst, igst, tds, netPayable }
}

const PAY_MODE_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', UPI: 'UPI', CASH: 'Cash',
}

// ─── Bill Detail Panel ───────────────────────────────────────────────────────

function BillDetailPanel({ bill, onClose }: { bill: any; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])
  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  const calc = calcBill(bill.items, bill.tdsRate, bill.supplyType)
  const paid = bill.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
  const balance = calc.netPayable - paid
  const cfg = STATUS_CONFIG[bill.status as string] ?? STATUS_CONFIG.DRAFT

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div className={`fixed inset-y-0 right-0 w-[60vw] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-gray-900">{bill.billNumber}</h2>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{bill.woNumber} · {bill.woTitle || bill.contractorName}</p>
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
                  { l: 'Period', v: fmtPeriod(bill.billingPeriodFrom, bill.billingPeriodTo) },
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
                  {bill.items.map((it: any) => (
                    <tr key={it.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800">{it.description}</p>
                        <p className="text-xs text-gray-400">{it.unit}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{Number(it.actualQty).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">₹{fmt(Number(it.rate))}</td>
                      <td className="px-3 py-2.5 text-center text-blue-500 text-xs font-semibold">{it.gstRate}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800">₹{fmt(Number(it.actualQty) * Number(it.rate))}</td>
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
                ...(Number(bill.tdsRate) > 0 ? [{ l: `TDS (${bill.tdsRate}%)`, v: `−₹${fmt(calc.tds)}`, cls: 'text-gray-500' }] : []),
              ].map(r => (
                <div key={r.l} className={`flex justify-between ${r.cls}`}>
                  <span>{r.l}</span><span className="tabular-nums">{r.v}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base border-t pt-2.5 mt-1 text-gray-900">
                <span>Net Payable</span>
                <span className="tabular-nums">₹{fmt(calc.netPayable)}</span>
              </div>
            </div>

            {/* Payment history */}
            {bill.payments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Payment History</p>
                <div className="space-y-2">
                  {bill.payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CreditCard size={13} className="text-gray-400" />
                        <span className="font-medium text-gray-800">₹{fmt(Number(p.amount))}</span>
                        <span className="text-gray-400 text-xs">{PAY_MODE_LABELS[p.mode] ?? p.mode}</span>
                        {p.reference && <span className="text-gray-400 text-xs">· {p.reference}</span>}
                      </div>
                      <span className="text-xs text-gray-400">{fmtDate(p.date)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                    <span className="text-green-600">Paid</span>
                    <span className="text-green-600 tabular-nums">₹{fmt(paid)}</span>
                  </div>
                  {balance > 0.01 && (
                    <div className="flex justify-between text-sm font-bold text-orange-500">
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

          {/* Footer */}
          <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0">
            <button onClick={handleClose}
              className="w-full py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',    color: 'text-gray-500',  icon: <Clock size={10} /> },
  SUBMITTED: { label: 'Draft',    color: 'text-gray-500',  icon: <Clock size={10} /> },
  APPROVED:  { label: 'Approved', color: 'text-blue-600',  icon: <CheckCircle2 size={10} /> },
  PAID:      { label: 'Paid',     color: 'text-violet-600', icon: <IndianRupee size={10} /> },
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function WorkBillsReportPage() {
  const navigate = useNavigate()
  const [selectedProject, setSelectedProject] = useState('')
  const [search, setSearch] = useState('')
  const [detailBill, setDetailBill] = useState<any>(null)

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })
  const projects: any[] = projectsData?.data?.data ?? []
  const projectId = selectedProject ? Number(selectedProject) : 0

  const { data: billsData, isLoading } = useQuery({
    queryKey: ['site-work-bills-report', projectId],
    queryFn: () => workBillApi.getAll({ projectId, status: 'ALL' }),
    enabled: !!projectId,
  })
  const allBills: any[] = billsData?.data?.data ?? []

  // Group by contractor, filtered by search
  const q = search.trim().toLowerCase()
  const contractorMap = new Map<string, any[]>()
  for (const bill of allBills) {
    const key = bill.contractorName || '(No contractor)'
    if (q && !key.toLowerCase().includes(q) && !bill.billNumber?.toLowerCase().includes(q) && !bill.woNumber?.toLowerCase().includes(q)) continue
    if (!contractorMap.has(key)) contractorMap.set(key, [])
    contractorMap.get(key)!.push(bill)
  }
  const contractors = Array.from(contractorMap.entries())

  // Grand totals
  let grandBilled = 0, grandPaid = 0, grandGST = 0, grandTDS = 0
  for (const bill of allBills) {
    const c = calcBill(bill.items, bill.tdsRate, bill.supplyType)
    grandBilled += c.netPayable
    grandGST += c.gstTotal
    grandTDS += c.tds
    grandPaid += bill.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
  }

  return (
    <>
      {/* Header — matches WorkBillsPage style */}
      <div style={{ background: 'linear-gradient(180deg, #ddd6fe 0%, #ede9fe 35%, #f5f3ff 65%, #faf9ff 85%, #ffffff 100%)' }}>
        {/* Nav row */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-4">
          <button onClick={() => navigate('/site/main-contractor')}
            className="text-violet-500 hover:text-violet-900 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 flex justify-center">
            <SiteFloatingNav theme="light" inline />
          </div>
        </div>

        {/* Title + project selector */}
        <div className="px-6 pt-6 pb-5 flex items-center justify-between">
          <div className="shrink-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Contractor Ledger</h1>
            <p className="text-xs text-gray-500">Contractor-wise summary of invoices received, payments made and outstanding dues</p>
          </div>
          <div className="relative shrink-0">
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              className="appearance-none border border-violet-200 bg-white rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[220px] shadow-sm">
              <option value="">Select project…</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

      </div>

      {/* Stat strip + search bar */}
      {allBills.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <div className="flex items-center divide-x divide-gray-200 mr-auto">
            <div className="pr-6" style={{ filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Contractors</p>
              <p className="text-sm font-bold text-gray-900">{contractors.length} <span className="text-xs font-normal text-gray-400">({allBills.length} bills)</span></p>
            </div>
            <div className="px-6" style={{ filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Net Billed</p>
              <p className="text-sm font-bold text-gray-900">₹{fmt(grandBilled)}</p>
            </div>
            <div className="px-6" style={{ filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Total Paid</p>
              <p className="text-sm font-bold text-green-600">₹{fmt(grandPaid)}</p>
            </div>
            <div className="pl-6" style={{ filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Outstanding</p>
              <p className="text-sm font-bold text-orange-600">₹{fmt(grandBilled - grandPaid)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all min-w-[260px]">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contractor, bill no, work order…"
              className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
            {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400" /></button>}
          </div>
        </div>
      )}

      <div className="p-6">

      {!selectedProject ? (
        <div className="text-center py-20 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a project to view contractor-wise bills</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : allBills.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No work bills found for this project</p>
        </div>
      ) : (
        <>

          {/* Per-contractor sections */}
          <div className="space-y-8">
            {contractors.map(([contractorName, bills]) => {
              let ctBilled = 0, ctPaid = 0
              const billRows = bills.map((bill: any) => {
                const c = calcBill(bill.items, bill.tdsRate, bill.supplyType)
                const paid = bill.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
                ctBilled += c.netPayable
                ctPaid += paid
                return { bill, c, paid }
              })

              const cfg = STATUS_CONFIG

              return (
                <div key={contractorName} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Contractor header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <HardHat size={14} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{contractorName}</p>
                        <p className="text-xs text-gray-400">{bills.length} bill{bills.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bills table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Bill No</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Work Order</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Bill Date</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Subtotal</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">GST</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">TDS</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Net Payable</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Paid</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Due</th>
                          <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billRows.map(({ bill, c, paid }: any, idx: number) => {
                          const due = c.netPayable - paid
                          const st = cfg[bill.status as string] ?? cfg.DRAFT
                          return (
                            <tr key={bill.id} onClick={() => setDetailBill(bill)}
                              className={`border-b border-gray-50 cursor-pointer hover:bg-violet-50/60 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                              <td className="px-5 py-3 font-mono text-xs font-bold text-blue-600">{bill.billNumber}</td>
                              <td className="px-3 py-3 text-xs text-gray-600">{bill.woNumber || '—'}</td>
                              <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                                <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(bill.billDate)}</span>
                              </td>
                              <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtPeriod(bill.billingPeriodFrom, bill.billingPeriodTo)}</td>
                              <td className="px-3 py-3 text-xs text-right text-gray-900 tabular-nums">₹{fmt(c.subtotal)}</td>
                              <td className="px-3 py-3 text-xs text-right text-gray-900 tabular-nums">₹{fmt(c.gstTotal)}</td>
                              <td className="px-3 py-3 text-xs text-right text-gray-900 tabular-nums">−₹{fmt(c.tds)}</td>
                              <td className="px-3 py-3 text-xs text-right font-semibold text-gray-900 tabular-nums">₹{fmt(c.netPayable)}</td>
                              <td className="px-3 py-3 text-xs text-right text-gray-900 tabular-nums">₹{fmt(paid)}</td>
                              <td className="px-3 py-3 text-xs text-right tabular-nums">
                                {due > 0.01
                                  ? <span className="text-gray-900">₹{fmt(due)}</span>
                                  : <span className="text-gray-900">Nil</span>}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${st.color}`}>
                                  {st.icon} {st.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                        {/* Contractor subtotal */}
                        <tr className="bg-purple-50/60 border-t border-purple-100">
                          <td colSpan={7} className="px-5 py-2.5 text-xs font-bold text-purple-800">Subtotal — {contractorName}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-right text-gray-900 tabular-nums">₹{fmt(ctBilled)}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-right text-green-700 tabular-nums">₹{fmt(ctPaid)}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-right text-orange-600 tabular-nums">₹{fmt(ctBilled - ctPaid)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Grand total */}
          <div className="mt-6 bg-gray-900 rounded-2xl px-6 py-4 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Grand Total — {allBills.length} bills across {contractors.length} contractor{contractors.length !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-8 text-right">
              <div>
                <p className="text-[11px] text-gray-400">Net Billed</p>
                <p className="text-sm font-bold text-white">₹{fmt(grandBilled)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Paid</p>
                <p className="text-sm font-bold text-green-400">₹{fmt(grandPaid)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Outstanding</p>
                <p className="text-sm font-bold text-orange-400">₹{fmt(grandBilled - grandPaid)}</p>
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      {detailBill && <BillDetailPanel bill={detailBill} onClose={() => setDetailBill(null)} />}
    </>
  )
}
