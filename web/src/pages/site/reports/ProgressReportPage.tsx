import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { ChevronDown, TrendingUp, Hammer, Building2, CheckCircle, FileDown } from 'lucide-react'
import { siteReportsApi, siteProjectApi } from '@/services/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PHASE_COLORS: Record<string, string> = {
  EXCAVATION: '#ef4444',
  CONCRETE: '#f97316',
  PSC_PCCP: '#eab308',
  HDPE: '#22c55e',
  MS_SPECIALS: '#3b82f6',
  WUA: '#8b5cf6',
  TESTING: '#06b6d4',
  OTHER: '#6b7280',
}

const STATUS_COLOR: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
      />
    </div>
  )
}

export default function ProgressReportPage() {
  const [selectedProject, setSelectedProject] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [execFilter, setExecFilter] = useState('')

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })
  const projects: any[] = projectsData?.data?.data ?? []
  const projectId = selectedProject ? Number(selectedProject) : 0
  const selectedProjectName = projects.find((p) => String(p.id) === selectedProject)?.name ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['site-progress-report', projectId],
    queryFn: () => siteReportsApi.getProgressReport(projectId),
    enabled: !!projectId,
  })

  const d = data?.data?.data
  const allPackages: any[] = d?.packages ?? []
  const dailyTrend: any[] = d?.dailyTrend ?? []
  const labourBreakdown: any[] = d?.labourBreakdown ?? []

  const phases = [...new Set(allPackages.map((p) => p.phase))]

  const filtered = allPackages.filter(
    (p) =>
      (phaseFilter === '' || p.phase === phaseFilter) &&
      (execFilter === '' || p.executionType === execFilter),
  )

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(16)
    doc.text(`Progress Report — ${selectedProjectName}`, 14, 16)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 24)

    autoTable(doc, {
      startY: 30,
      head: [['Phase', 'Type', 'Description', 'Unit', 'Planned Qty', 'Completed Qty', '% Done', 'Status']],
      body: allPackages.map((p) => [
        p.phase,
        p.executionType,
        p.description,
        p.unit,
        p.plannedQty,
        p.completedQty,
        `${p.percentComplete.toFixed(1)}%`,
        p.status,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [55, 65, 81] },
    })

    doc.save(`progress-report-${selectedProjectName.replace(/\s+/g, '-')}.pdf`)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Progress Report</h1>
            <p className="text-sm text-gray-500">Phase-wise completion, daily trend & labour</p>
          </div>
        </div>
        {selectedProject && !isLoading && (
          <button onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <FileDown size={15} />
            Export PDF
          </button>
        )}
      </div>

      {/* Selectors */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative">
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[240px]">
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {selectedProject && !isLoading && (
          <>
            <div className="relative">
              <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}
                className="appearance-none border border-gray-300 rounded-lg px-3 py-2.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Phases</option>
                {phases.map((p) => <option key={p}>{p}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={execFilter} onChange={(e) => setExecFilter(e.target.value)}
                className="appearance-none border border-gray-300 rounded-lg px-3 py-2.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Types</option>
                <option value="INHOUSE">Inhouse</option>
                <option value="SUBCONTRACTED">Subcontracted</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </>
        )}
      </div>

      {!selectedProject ? (
        <div className="text-center py-20 text-gray-400">
          <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a project to view progress</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{allPackages.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Packages</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Hammer size={13} className="text-indigo-600" />
                <span className="text-xs text-indigo-500">Inhouse</span>
              </div>
              <p className="text-2xl font-bold text-indigo-700">{d?.totalInhouse ?? 0}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Building2 size={13} className="text-orange-600" />
                <span className="text-xs text-orange-500">Subcontracted</span>
              </div>
              <p className="text-2xl font-bold text-orange-700">{d?.totalSub ?? 0}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle size={13} className="text-green-600" />
                <span className="text-xs text-green-500">Completed</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{d?.completedCount ?? 0}</p>
            </div>
          </div>

          {/* Daily trend chart */}
          {dailyTrend.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Daily Progress — Last 30 Days</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip
                    labelFormatter={(l) => `Date: ${l}`}
                    formatter={(v: any) => [v, 'Qty Completed']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="qtyCompleted" radius={[3, 3, 0, 0]}>
                    {dailyTrend.map((_, i) => (
                      <Cell key={i} fill="#6366f1" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Work packages table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Work Packages</h3>
              <span className="text-xs text-gray-400">{filtered.length} shown</span>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No work packages found.</div>
            ) : (
              <table className="w-full text-left">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phase</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Planned</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Done</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase w-36">Progress</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((pkg, i) => {
                    const phaseColor = PHASE_COLORS[pkg.phase] ?? '#6b7280'
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{ backgroundColor: phaseColor + '20', color: phaseColor }}>
                            {pkg.phase}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">{pkg.description}</td>
                        <td className="px-4 py-3">
                          {pkg.executionType === 'INHOUSE'
                            ? <span className="inline-flex items-center gap-1 text-xs text-indigo-600"><Hammer size={11} />Inhouse</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-orange-600"><Building2 size={11} />Sub</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {pkg.plannedQty} <span className="text-gray-400 text-xs">{pkg.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-800 font-medium">
                          {pkg.executionType === 'INHOUSE'
                            ? <>{pkg.completedQty} <span className="text-gray-400 text-xs font-normal">{pkg.unit}</span></>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar pct={pkg.percentComplete} color={phaseColor} />
                            <span className="text-xs text-gray-500 w-10 text-right shrink-0">
                              {pkg.percentComplete.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[pkg.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {pkg.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Labour breakdown */}
          {labourBreakdown.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-800">Labour Summary by Category</h3>
              </div>
              <table className="w-full text-left">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Total Manpower (person-days)</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Total Wages</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {labourBreakdown.map((l, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{l.category}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{l.totalCount}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-emerald-700">
                        ₹{Number(l.totalWages).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
