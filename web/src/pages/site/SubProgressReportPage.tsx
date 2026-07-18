import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, Users, Truck, FileText } from 'lucide-react'
import { siteProjectApi, dailyProgressApi, labourAttendanceApi, equipmentLogApi } from '@/services/api'
import SiteFloatingNav, { SUB_CONTRACTOR_NAV } from './SiteFloatingNav'

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#0f172a', fontFamily: "'Roboto', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 32 }}>
      <div style={{ color: '#0d9488' }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', fontFamily: "'Roboto', sans-serif" }}>{title}</div>
    </div>
  )
}

export default function SubProgressReportPage() {
  const navigate = useNavigate()
  const [projectId, setProjectId] = useState(0)

  const { data: projects = [] } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll().then(r => r.data.data),
  })

  const enabled = projectId > 0

  const { data: dailyProgress = [], isLoading: dpLoading } = useQuery({
    queryKey: ['site-daily-progress', projectId],
    queryFn: () => dailyProgressApi.getByProject(projectId).then(r => r.data.data ?? []),
    enabled,
  })

  const { data: labour = [], isLoading: labourLoading } = useQuery({
    queryKey: ['site-labour', projectId],
    queryFn: () => labourAttendanceApi.getByProject(projectId).then(r => r.data.data ?? []),
    enabled,
  })

  const { data: equipment = [], isLoading: eqLoading } = useQuery({
    queryKey: ['site-equipment', projectId],
    queryFn: () => equipmentLogApi.getByProject(projectId).then(r => r.data.data ?? []),
    enabled,
  })

  const loading = dpLoading || labourLoading || eqLoading

  // Daily progress stats
  const dpList = dailyProgress as any[]
  const labourList = labour as any[]
  const eqList = equipment as any[]

  const totalQty = dpList.reduce((s, d) => s + Number(d.qtyCompleted ?? 0), 0)
  const workingDays = new Set(dpList.map((d: any) => d.date)).size

  // Labour stats
  const totalWages = labourList.reduce((s, l) => s + Number(l.totalWages ?? 0), 0)
  const totalHeads = labourList.reduce((s, l) => s + Number(l.count ?? 0), 0)
  const uniqueLabourDays = new Set(labourList.map((l: any) => l.date)).size

  // Equipment stats
  const totalHours = eqList.reduce((s, e) => s + Number(e.hoursWorked ?? 0), 0)
  const totalFuel = eqList.reduce((s, e) => s + Number(e.fuelConsumed ?? 0), 0)

  // Group daily progress by date for timeline
  const byDate: Record<string, any[]> = {}
  dpList.forEach(d => {
    if (!byDate[d.date]) byDate[d.date] = []
    byDate[d.date].push(d)
  })
  const dates = Object.keys(byDate).sort().reverse().slice(0, 14)

  // Group labour by category
  const byCategory: Record<string, { count: number; wages: number }> = {}
  labourList.forEach(l => {
    if (!byCategory[l.category]) byCategory[l.category] = { count: 0, wages: 0 }
    byCategory[l.category].count += Number(l.count ?? 0)
    byCategory[l.category].wages += Number(l.totalWages ?? 0)
  })

  // Group equipment by type
  const byEquipType: Record<string, { hours: number; fuel: number; entries: number }> = {}
  eqList.forEach(e => {
    if (!byEquipType[e.equipmentType]) byEquipType[e.equipmentType] = { hours: 0, fuel: 0, entries: 0 }
    byEquipType[e.equipmentType].hours += Number(e.hoursWorked ?? 0)
    byEquipType[e.equipmentType].fuel += Number(e.fuelConsumed ?? 0)
    byEquipType[e.equipmentType].entries++
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Roboto', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(150deg, #011512 0%, #042f2e 28%, #134e4a 55%, #0f766e 78%, #0d9488 100%)', padding: '28px 48px 36px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <button onClick={() => navigate('/site/sub-contractor')} style={{ position: 'absolute', left: 0, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={16} />
          </button>
          <SiteFloatingNav inline items={SUB_CONTRACTOR_NAV} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>ANALYTICS</div>
            <h1 style={{ fontSize: 24, fontWeight: 300, color: 'white', marginBottom: 4 }}>Progress Report</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>Physical progress, manpower deployed and equipment utilisation</p>
          </div>
          <select
            value={projectId}
            onChange={e => setProjectId(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 13, cursor: 'pointer', fontFamily: "'Roboto', sans-serif" }}
          >
            <option value={0} style={{ color: '#0f172a' }}>Select Project</option>
            {(projects as any[]).map((p: any) => (
              <option key={p.id} value={p.id} style={{ color: '#0f172a' }}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ padding: '32px 48px 64px' }}>
        {!projectId ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8', fontSize: 14 }}>
            Select a project to view the progress report
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading report…</div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 8 }}>
              <StatCard label="WORKING DAYS" value={String(workingDays)} sub="days with activity" />
              <StatCard label="TOTAL QTY DONE" value={totalQty.toFixed(2)} sub="cumulative" accent="#0d9488" />
              <StatCard label="LABOUR WAGES" value={`₹${fmt(totalWages)}`} sub={`${totalHeads} total headcount`} accent="#059669" />
              <StatCard label="EQUIPMENT HOURS" value={`${totalHours.toFixed(1)} hrs`} sub={`${totalFuel.toFixed(1)} L fuel`} accent="#7c3aed" />
            </div>

            {/* Daily Progress Timeline */}
            <SectionHeader icon={<TrendingUp size={18} />} title="Daily Progress (Last 14 Days)" />
            {dpList.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 13, padding: '24px 0' }}>No daily progress entries recorded yet.</div>
            ) : (
              <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {['Date', 'Description', 'Unit', 'Qty Completed', 'Weather', 'Remarks'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Qty Completed' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map(date => byDate[date].map((d: any, i: number) => (
                      <tr key={`${date}-${i}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {i === 0 && (
                          <td rowSpan={byDate[date].length} style={{ padding: '10px 16px', color: '#64748b', fontWeight: 500, verticalAlign: 'top', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>{date}</td>
                        )}
                        <td style={{ padding: '10px 16px', color: '#334155' }}>{d.description ?? '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{d.unit ?? '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#0d9488' }}>{Number(d.qtyCompleted).toFixed(2)}</td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{d.weatherCondition ?? '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{d.remarks ?? '—'}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Labour by Category */}
            <SectionHeader icon={<Users size={18} />} title="Labour Summary by Category" />
            {labourList.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 13, padding: '24px 0' }}>No labour attendance recorded yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                {Object.entries(byCategory).map(([cat, data]) => (
                  <div key={cat} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', letterSpacing: '0.06em', marginBottom: 10 }}>{cat}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{data.count}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>headcount</div>
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 13, fontWeight: 600, color: '#059669' }}>
                      ₹{fmt(data.wages)}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>total wages</div>
                  </div>
                ))}
              </div>
            )}

            {/* Labour detail table */}
            {labourList.length > 0 && (
              <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginTop: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {['Date', 'Category', 'Count', 'Wage/Head', 'Total Wages', 'Notes'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: ['Count', 'Wage/Head', 'Total Wages'].includes(h) ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labourList.slice().sort((a: any, b: any) => b.date.localeCompare(a.date)).map((l: any) => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', color: '#64748b' }}>{l.date}</td>
                        <td style={{ padding: '10px 16px' }}><span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: '#f0fdfa', color: '#0d9488' }}>{l.category}</span></td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{l.count}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#475569' }}>₹{fmt(l.wagePerHead)}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>₹{fmt(l.totalWages)}</td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{l.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                      <td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700, color: '#166534', fontSize: 13 }}>TOTAL</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{totalHeads}</td>
                      <td />
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>₹{fmt(totalWages)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Equipment by Type */}
            <SectionHeader icon={<Truck size={18} />} title="Equipment Utilisation by Type" />
            {eqList.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 13, padding: '24px 0' }}>No equipment entries recorded yet.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                  {Object.entries(byEquipType).map(([type, data]) => (
                    <div key={type} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', letterSpacing: '0.06em', marginBottom: 10 }}>{type}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{data.hours.toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>hours worked</div>
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                        {data.fuel.toFixed(1)} L
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>fuel consumed</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginTop: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {['Date', 'Equipment', 'Type', 'Hours', 'Idle', 'Fuel (L)', 'Operator'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: ['Hours', 'Idle', 'Fuel (L)'].includes(h) ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {eqList.slice().sort((a: any, b: any) => b.date.localeCompare(a.date)).map((e: any) => (
                        <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>{e.date}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0f172a' }}>{e.equipmentName}</td>
                          <td style={{ padding: '10px 16px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f5f3ff', color: '#7c3aed', fontWeight: 500 }}>{e.equipmentType}</span></td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{Number(e.hoursWorked).toFixed(1)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#94a3b8' }}>{Number(e.idleHours).toFixed(1)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#475569' }}>{Number(e.fuelConsumed).toFixed(1)}</td>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>{e.operatorName ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Print hint */}
            <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12 }}>
              <FileText size={14} />
              <span>Use Ctrl+P / Cmd+P to print or save this report as PDF</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
