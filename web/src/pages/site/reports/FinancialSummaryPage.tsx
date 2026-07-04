import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, IndianRupee, TrendingUp, TrendingDown, Building2, Users, AlertCircle } from 'lucide-react'
import { siteReportsApi, siteProjectApi } from '@/services/api'

function fmt(val: any) {
  const n = Number(val ?? 0)
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string
  value: string
  sub?: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${color}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium opacity-70">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

export default function FinancialSummaryPage() {
  const [selectedProject, setSelectedProject] = useState('')

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })
  const projects: any[] = projectsData?.data?.data ?? []
  const projectId = selectedProject ? Number(selectedProject) : 0

  const { data, isLoading } = useQuery({
    queryKey: ['site-financial-summary', projectId],
    queryFn: () => siteReportsApi.getFinancialSummary(projectId),
    enabled: !!projectId,
  })

  const d = data?.data?.data
  const contractors: any[] = d?.byContractor ?? []

  const utilizationPct = d?.contractValue && Number(d.contractValue) > 0
    ? Math.min(100, Math.round((Number(d.contractedWOs) / Number(d.contractValue)) * 100))
    : null

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center">
          <IndianRupee size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Financial Summary</h1>
          <p className="text-sm text-gray-500">Subcontracted billing, payments & inhouse costs</p>
        </div>
      </div>

      {/* Project selector */}
      <div className="relative mb-6 w-fit">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="appearance-none border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[240px]">
          <option value="">Select project…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {!selectedProject ? (
        <div className="text-center py-20 text-gray-400">
          <IndianRupee size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a project to view financial summary</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="space-y-6">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Contract Value" value={fmt(d?.contractValue)}
              color="bg-blue-50 border-blue-200 text-blue-800"
              icon={<Building2 size={15} className="text-blue-600" />} />
            <KpiCard label="Work Orders (Contracted)" value={fmt(d?.contractedWOs)}
              sub={utilizationPct != null ? `${utilizationPct}% of contract` : undefined}
              color="bg-indigo-50 border-indigo-200 text-indigo-800"
              icon={<TrendingUp size={15} className="text-indigo-600" />} />
            <KpiCard label="Total Billed" value={fmt(d?.totalBilled)}
              color="bg-orange-50 border-orange-200 text-orange-800"
              icon={<IndianRupee size={15} className="text-orange-600" />} />
            <KpiCard label="Total Paid" value={fmt(d?.totalPaid)}
              sub={`Outstanding: ${fmt(d?.outstanding)}`}
              color={Number(d?.outstanding) > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}
              icon={<TrendingDown size={15} className={Number(d?.outstanding) > 0 ? 'text-red-600' : 'text-green-600'} />} />
          </div>

          {/* Labour cost */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">Inhouse Labour Cost</h3>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">{fmt(d?.labourCost)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Total wages paid to inhouse labour</p>
              </div>
            </div>
          </div>

          {/* By Contractor */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b bg-gray-50">
              <Building2 size={15} className="text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">By Contractor</h3>
            </div>
            {contractors.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No work orders linked to this project yet.</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">Contractor</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">WOs</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Contracted</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Billed</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Paid</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contractors.map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{c.contractorName}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{c.woCount}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{fmt(c.contractedValue)}</td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600">{fmt(c.billed)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700">{fmt(c.paid)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        <span className={Number(c.outstanding) > 0 ? 'text-red-600' : 'text-gray-400'}>
                          {Number(c.outstanding) > 0 && <AlertCircle size={11} className="inline mr-1" />}
                          {fmt(c.outstanding)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-5 py-3 text-xs font-bold text-gray-700 uppercase">Total</td>
                    <td className="px-4 py-3 text-sm text-center font-semibold text-gray-700">
                      {contractors.reduce((s, c) => s + c.woCount, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-700">{fmt(d?.contractedWOs)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-orange-700">{fmt(d?.totalBilled)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">{fmt(d?.totalPaid)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">{fmt(d?.outstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
