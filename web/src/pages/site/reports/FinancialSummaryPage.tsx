import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown, IndianRupee, TrendingUp, TrendingDown, Building2,
  Users, AlertCircle, ArrowLeft, FileText, CheckCircle2, Clock,
} from 'lucide-react'
import { siteReportsApi, siteProjectApi, workBillApi } from '@/services/api'

function fmt(val: any) {
  const n = Number(val ?? 0)
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function pct(num: any, den: any) {
  const n = Number(num ?? 0), d = Number(den ?? 0)
  if (!d) return 0
  return Math.min(100, Math.round((n / d) * 100))
}

const BILL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: 'Draft',    color: 'bg-gray-100 text-gray-600' },
  SUBMITTED:{ label: 'Submitted',color: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  PAID:     { label: 'Paid',     color: 'bg-emerald-100 text-emerald-700' },
  PARTIAL:  { label: 'Partial',  color: 'bg-yellow-100 text-yellow-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
}

export default function FinancialSummaryPage() {
  const navigate = useNavigate()
  const [selectedProject, setSelectedProject] = useState('')

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })
  const projects: any[] = projectsData?.data?.data ?? []
  const projectId = selectedProject ? Number(selectedProject) : 0

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['site-financial-summary', projectId],
    queryFn: () => siteReportsApi.getFinancialSummary(projectId),
    enabled: !!projectId,
  })

  const { data: billsData } = useQuery({
    queryKey: ['work-bills-for-project', projectId],
    queryFn: () => workBillApi.getAll({ projectId }),
    enabled: !!projectId,
  })

  const d = summaryData?.data?.data
  const contractors: any[] = d?.byContractor ?? []
  const bills: any[] = (billsData?.data as any)?.data ?? billsData?.data ?? []

  const billedPct = pct(d?.totalBilled, d?.contractValue)
  const paidPct   = pct(d?.totalPaid,   d?.contractValue)
  const woPct     = pct(d?.contractedWOs, d?.contractValue)
  const outstanding = Number(d?.outstanding ?? 0)

  const selectedProjectObj = projects.find(p => String(p.id) === selectedProject)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 70%, #059669 100%)' }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative px-8 py-8">
          <button
            onClick={() => navigate('/site/main-contractor')}
            className="flex items-center gap-1.5 text-emerald-200 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={15} />
            Site Management
          </button>

          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <IndianRupee size={18} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Financial Report</h1>
              </div>
              <p className="text-emerald-200 text-sm mt-1">
                Billing, payments, outstanding balances and contractor costs
              </p>
            </div>

            {/* Project Selector */}
            <div className="relative min-w-[280px]">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full appearance-none bg-white/15 border border-white/30 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-sm"
              >
                <option value="" className="text-gray-900 bg-white">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="text-gray-900 bg-white">{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none" />
            </div>
          </div>

          {/* Stats Strip — only when project is selected and data loaded */}
          {d && (
            <div className="grid grid-cols-4 gap-4 mt-6">
              {[
                { label: 'Contract Value', value: fmt(d.contractValue), icon: <Building2 size={15} />, color: 'text-emerald-200' },
                { label: 'WO Contracted', value: fmt(d.contractedWOs), sub: `${woPct}% of contract`, icon: <TrendingUp size={15} />, color: 'text-blue-200' },
                { label: 'Total Billed', value: fmt(d.totalBilled), sub: `${billedPct}% billed`, icon: <IndianRupee size={15} />, color: 'text-yellow-200' },
                { label: 'Outstanding', value: fmt(d.outstanding), sub: `${fmt(d.totalPaid)} paid`, icon: <AlertCircle size={15} />, color: outstanding > 0 ? 'text-red-200' : 'text-green-200' },
              ].map(({ label, value, sub, icon, color }) => (
                <div key={label} className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
                  <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${color}`}>
                    {icon}
                    {label}
                  </div>
                  <div className="text-2xl font-bold text-white">{value}</div>
                  {sub && <div className="text-xs text-white/60 mt-0.5">{sub}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {!selectedProject ? (
          <div className="text-center py-24 text-gray-400">
            <IndianRupee size={40} className="mx-auto mb-4 opacity-20" />
            <p className="text-base font-medium text-gray-500">Select a project to view the financial report</p>
            <p className="text-sm text-gray-400 mt-1">Use the dropdown in the header above</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-24 text-gray-400 text-sm">Loading…</div>
        ) : (
          <>
            {/* Budget Utilization Bar */}
            {Number(d?.contractValue) > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Budget Utilization</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Work Orders Contracted', pctVal: woPct, color: 'bg-blue-500', value: fmt(d?.contractedWOs) },
                    { label: 'Billed to Date', pctVal: billedPct, color: 'bg-amber-400', value: fmt(d?.totalBilled) },
                    { label: 'Paid to Date', pctVal: paidPct, color: 'bg-emerald-500', value: fmt(d?.totalPaid) },
                  ].map(({ label, pctVal, color, value }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>{label}</span>
                        <span className="font-medium text-gray-700">{value} <span className="text-gray-400">({pctVal}%)</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${color}`}
                          style={{ width: `${pctVal}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>Contract Value: <span className="font-semibold text-gray-800">{fmt(d?.contractValue)}</span></span>
                  {selectedProjectObj?.clientName && (
                    <span>Client: <span className="font-medium text-gray-700">{selectedProjectObj.clientName}</span></span>
                  )}
                </div>
              </div>
            )}

            {/* KPI Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-orange-600 mb-3">
                  <IndianRupee size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Outstanding</span>
                </div>
                <p className={`text-3xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {fmt(d?.outstanding)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {outstanding > 0 ? 'Pending payment to contractors' : 'No outstanding dues'}
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-blue-600 mb-3">
                  <Users size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Inhouse Labour</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{fmt(d?.labourCost)}</p>
                <p className="text-xs text-gray-400 mt-1">Total wages paid to inhouse labour</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 mb-3">
                  <TrendingDown size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Total Cost</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {fmt(Number(d?.totalPaid ?? 0) + Number(d?.labourCost ?? 0))}
                </p>
                <p className="text-xs text-gray-400 mt-1">Contractor paid + inhouse labour</p>
              </div>
            </div>

            {/* By Contractor */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-6 py-4 border-b bg-gray-50">
                <Building2 size={15} className="text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-800">By Contractor</h3>
                <span className="ml-auto text-xs text-gray-400">{contractors.length} contractor{contractors.length !== 1 ? 's' : ''}</span>
              </div>
              {contractors.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No work orders linked to this project yet.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Contractor</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">WOs</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Contracted</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Billed</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Paid</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Outstanding</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Billed %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {contractors.map((c, i) => {
                      const cBilledPct = pct(c.billed, c.contractedValue)
                      return (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                {c.contractorName?.[0] ?? '?'}
                              </div>
                              <span className="text-sm font-medium text-gray-900">{c.contractorName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-center text-gray-600">{c.woCount}</td>
                          <td className="px-4 py-3.5 text-sm text-right text-gray-700">{fmt(c.contractedValue)}</td>
                          <td className="px-4 py-3.5 text-sm text-right text-amber-700 font-medium">{fmt(c.billed)}</td>
                          <td className="px-4 py-3.5 text-sm text-right text-emerald-700 font-medium">{fmt(c.paid)}</td>
                          <td className="px-4 py-3.5 text-sm text-right font-medium">
                            {Number(c.outstanding) > 0 ? (
                              <span className="text-red-600 flex items-center justify-end gap-1">
                                <AlertCircle size={11} />
                                {fmt(c.outstanding)}
                              </span>
                            ) : (
                              <span className="text-gray-400">{fmt(c.outstanding)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${cBilledPct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{cBilledPct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                    <tr>
                      <td className="px-6 py-3.5 text-xs font-bold text-gray-700 uppercase">Total</td>
                      <td className="px-4 py-3.5 text-sm text-center font-semibold text-gray-700">
                        {contractors.reduce((s, c) => s + c.woCount, 0)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-right font-semibold text-gray-700">{fmt(d?.contractedWOs)}</td>
                      <td className="px-4 py-3.5 text-sm text-right font-semibold text-amber-700">{fmt(d?.totalBilled)}</td>
                      <td className="px-4 py-3.5 text-sm text-right font-semibold text-emerald-700">{fmt(d?.totalPaid)}</td>
                      <td className="px-4 py-3.5 text-sm text-right font-semibold text-red-600">{fmt(d?.outstanding)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Work Bills */}
            {bills.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-6 py-4 border-b bg-gray-50">
                  <FileText size={15} className="text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Work Bills</h3>
                  <span className="ml-auto text-xs text-gray-400">{bills.length} bill{bills.length !== 1 ? 's' : ''}</span>
                </div>
                <table className="w-full text-left">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Bill No.</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contractor</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Amount</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Paid</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bills.map((b: any) => {
                      const st = BILL_STATUS_LABEL[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-600' }
                      return (
                        <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-sm font-mono font-medium text-gray-900">{b.billNumber ?? `#${b.id}`}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{b.contractorName ?? b.contractor?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{b.billDate?.slice(0, 10) ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{fmt(b.netAmount ?? b.totalAmount ?? b.amount)}</td>
                          <td className="px-4 py-3 text-sm text-right text-emerald-700">{fmt(b.totalPaid ?? b.paidAmount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                              {b.status === 'PAID' ? <CheckCircle2 size={10} /> : b.status === 'SUBMITTED' || b.status === 'APPROVED' ? <Clock size={10} /> : null}
                              {st.label}
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
    </div>
  )
}
