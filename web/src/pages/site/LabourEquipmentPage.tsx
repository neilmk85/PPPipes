import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, X, Pencil, Trash2, ArrowLeft, Users, Truck } from 'lucide-react'
import { labourAttendanceApi, equipmentLogApi, siteProjectApi } from '@/services/api'
import SiteFloatingNav, { SUB_CONTRACTOR_NAV } from './SiteFloatingNav'

const LABOUR_CATEGORIES = ['ENGINEER', 'SUPERVISOR', 'SKILLED', 'UNSKILLED', 'OPERATOR']
const EQUIPMENT_TYPES = ['EXCAVATOR', 'CRANE', 'TRUCK', 'PUMP', 'COMPRESSOR', 'ROLLER', 'OTHER']

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: "'Roboto', sans-serif",
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 4, display: 'block',
}

// ─── Labour Panel ─────────────────────────────────────────────────────────────
function LabourPanel({ projectId, entry, onClose, onSaved }: {
  projectId: number; entry?: any; onClose: () => void; onSaved: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [form, setForm] = useState(entry ?? {
    siteProjectId: projectId,
    date: new Date().toISOString().slice(0, 10),
    category: 'SKILLED',
    count: 0,
    wagePerHead: 0,
    totalWages: 0,
    notes: '',
  })

  const sf = (k: string, v: any) => {
    const next = { ...form, [k]: v }
    if (k === 'count' || k === 'wagePerHead') {
      next.totalWages = Number(k === 'count' ? v : form.count) * Number(k === 'wagePerHead' ? v : form.wagePerHead)
    }
    setForm(next)
  }

  useState(() => { requestAnimationFrame(() => setVisible(true)) })
  const handleClose = () => { setVisible(false); setTimeout(onClose, 300) }

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: () => entry
      ? labourAttendanceApi.update(entry.id, form)
      : labourAttendanceApi.create(form),
    onSuccess: () => { toast.success(entry ? 'Updated' : 'Labour entry saved'); qc.invalidateQueries({ queryKey: ['labour'] }); onSaved(); handleClose() },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', opacity: visible ? 1 : 0, transition: 'opacity 0.28s' }} onClick={handleClose} />
      <div style={{ width: 480, background: 'white', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: "'Roboto', sans-serif" }}>{entry ? 'Edit Labour Entry' : 'Record Labour'}</div>
          <button onClick={handleClose} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}><X size={16} color="#64748b" /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: "'Roboto', sans-serif" }}>
          <div><label style={labelStyle}>Date</label><input style={inputStyle} type="date" value={form.date} onChange={e => sf('date', e.target.value)} /></div>
          <div><label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => sf('category', e.target.value)}>
              {LABOUR_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Count (headcount)</label><input style={inputStyle} type="number" min="0" value={form.count || ''} onChange={e => sf('count', Number(e.target.value))} /></div>
          <div><label style={labelStyle}>Wage per Head (₹)</label><input style={inputStyle} type="number" min="0" value={form.wagePerHead || ''} onChange={e => sf('wagePerHead', Number(e.target.value))} /></div>
          <div style={{ background: '#f0fdfa', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 500, marginBottom: 2 }}>TOTAL WAGES</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0d9488' }}>₹{fmt(form.totalWages)}</div>
          </div>
          <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.notes} onChange={e => sf('notes', e.target.value)} /></div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={handleClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', fontSize: 13, cursor: 'pointer', color: '#64748b', fontFamily: "'Roboto', sans-serif" }}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0d9488', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Roboto', sans-serif" }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Equipment Panel ──────────────────────────────────────────────────────────
function EquipmentPanel({ projectId, entry, onClose, onSaved }: {
  projectId: number; entry?: any; onClose: () => void; onSaved: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [form, setForm] = useState(entry ?? {
    siteProjectId: projectId,
    date: new Date().toISOString().slice(0, 10),
    equipmentName: '',
    equipmentType: 'EXCAVATOR',
    hoursWorked: 0,
    idleHours: 0,
    fuelConsumed: 0,
    operatorName: '',
    remarks: '',
  })

  useState(() => { requestAnimationFrame(() => setVisible(true)) })
  const handleClose = () => { setVisible(false); setTimeout(onClose, 300) }
  const sf = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: () => entry
      ? equipmentLogApi.update(entry.id, form)
      : equipmentLogApi.create(form),
    onSuccess: () => { toast.success(entry ? 'Updated' : 'Equipment entry saved'); qc.invalidateQueries({ queryKey: ['equipment'] }); onSaved(); handleClose() },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', opacity: visible ? 1 : 0, transition: 'opacity 0.28s' }} onClick={handleClose} />
      <div style={{ width: 480, background: 'white', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: "'Roboto', sans-serif" }}>{entry ? 'Edit Equipment Entry' : 'Log Equipment'}</div>
          <button onClick={handleClose} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}><X size={16} color="#64748b" /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: "'Roboto', sans-serif" }}>
          <div><label style={labelStyle}>Date</label><input style={inputStyle} type="date" value={form.date} onChange={e => sf('date', e.target.value)} /></div>
          <div><label style={labelStyle}>Equipment Name</label><input style={inputStyle} value={form.equipmentName} onChange={e => sf('equipmentName', e.target.value)} placeholder="e.g. JCB 3DX" /></div>
          <div><label style={labelStyle}>Equipment Type</label>
            <select style={inputStyle} value={form.equipmentType} onChange={e => sf('equipmentType', e.target.value)}>
              {EQUIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Hours Worked</label><input style={inputStyle} type="number" min="0" step="0.5" value={form.hoursWorked || ''} onChange={e => sf('hoursWorked', Number(e.target.value))} /></div>
            <div><label style={labelStyle}>Idle Hours</label><input style={inputStyle} type="number" min="0" step="0.5" value={form.idleHours || ''} onChange={e => sf('idleHours', Number(e.target.value))} /></div>
          </div>
          <div><label style={labelStyle}>Fuel Consumed (litres)</label><input style={inputStyle} type="number" min="0" step="0.5" value={form.fuelConsumed || ''} onChange={e => sf('fuelConsumed', Number(e.target.value))} /></div>
          <div><label style={labelStyle}>Operator Name</label><input style={inputStyle} value={form.operatorName} onChange={e => sf('operatorName', e.target.value)} /></div>
          <div><label style={labelStyle}>Remarks</label><textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={form.remarks} onChange={e => sf('remarks', e.target.value)} /></div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={handleClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', fontSize: 13, cursor: 'pointer', color: '#64748b', fontFamily: "'Roboto', sans-serif" }}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0d9488', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Roboto', sans-serif" }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type PanelType = 'labour' | 'equipment' | null

export default function LabourEquipmentPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [projectId, setProjectId] = useState(0)
  const [activeTab, setActiveTab] = useState<'labour' | 'equipment'>('labour')
  const [panel, setPanel] = useState<PanelType>(null)
  const [editing, setEditing] = useState<any>(undefined)

  const { data: projects = [] } = useQuery({ queryKey: ['site-projects'], queryFn: () => siteProjectApi.getAll() })

  const { data: labour = [], isLoading: labourLoading } = useQuery({
    queryKey: ['labour', projectId],
    queryFn: () => labourAttendanceApi.getByProject(projectId),
    enabled: projectId > 0,
  })
  const { data: equipment = [], isLoading: eqLoading } = useQuery({
    queryKey: ['equipment', projectId],
    queryFn: () => equipmentLogApi.getByProject(projectId),
    enabled: projectId > 0,
  })

  const delLabour = useMutation({
    mutationFn: (id: number) => labourAttendanceApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['labour'] }) },
  })
  const delEquip = useMutation({
    mutationFn: (id: number) => equipmentLogApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['equipment'] }) },
  })

  const totalLabour = (labour as any[]).reduce((s, l) => s + Number(l.totalWages ?? 0), 0)
  const totalHeads = (labour as any[]).reduce((s, l) => s + Number(l.count ?? 0), 0)
  const totalHours = (equipment as any[]).reduce((s, e) => s + Number(e.hoursWorked ?? 0), 0)

  const tabBtn = (tab: 'labour' | 'equipment', label: string) => (
    <button onClick={() => setActiveTab(tab)} style={{
      padding: '8px 20px', borderRadius: 20, border: 'none',
      background: activeTab === tab ? '#0d9488' : 'white',
      color: activeTab === tab ? 'white' : '#64748b',
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
      boxShadow: activeTab === tab ? '0 2px 8px rgba(13,148,136,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
      fontFamily: "'Roboto', sans-serif",
    }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ background: 'linear-gradient(150deg, #011512 0%, #042f2e 28%, #134e4a 55%, #0f766e 78%, #0d9488 100%)', padding: '28px 48px 36px', fontFamily: "'Roboto', sans-serif" }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <button onClick={() => navigate('/site/sub-contractor')} style={{ position: 'absolute', left: 0, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={16} />
          </button>
          <SiteFloatingNav inline items={SUB_CONTRACTOR_NAV} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>RESOURCES</div>
            <h1 style={{ fontSize: 24, fontWeight: 300, color: 'white', marginBottom: 4 }}>Labour & Equipment</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>Track manpower deployed and equipment hours on site</p>
          </div>
          <select value={projectId} onChange={e => setProjectId(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 13, cursor: 'pointer', fontFamily: "'Roboto', sans-serif" }}>
            <option value={0} style={{ color: '#0f172a' }}>Select Project</option>
            {(projects as any[]).map((p: any) => <option key={p.id} value={p.id} style={{ color: '#0f172a' }}>{p.name}</option>)}
          </select>
        </div>
        {projectId > 0 && (
          <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
            {[
              { label: 'Total Headcount', value: String(totalHeads) },
              { label: 'Labour Cost', value: `₹${fmt(totalLabour)}` },
              { label: 'Equipment Hours', value: `${totalHours.toFixed(1)} hrs` },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 18, fontWeight: 300, color: 'white' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 400, letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {projectId > 0 && (
        <div style={{ padding: '20px 48px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {tabBtn('labour', 'Labour Attendance')}
            {tabBtn('equipment', 'Equipment Log')}
          </div>
          <button
            onClick={() => { setEditing(undefined); setPanel(activeTab) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Roboto', sans-serif" }}>
            <Plus size={14} /> {activeTab === 'labour' ? 'Record Labour' : 'Log Equipment'}
          </button>
        </div>
      )}

      <div style={{ padding: '20px 48px 64px' }}>
        {!projectId ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8', fontSize: 14, fontFamily: "'Roboto', sans-serif" }}>Select a project to view records</div>
        ) : activeTab === 'labour' ? (
          labourLoading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontFamily: "'Roboto', sans-serif" }}>Loading…</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Roboto', sans-serif" }}>
                <thead>
                  <tr style={{ background: 'white', borderBottom: '2px solid #e2e8f0' }}>
                    {['Date', 'Category', 'Count', 'Wage/Head', 'Total Wages', 'Notes', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: ['Count', 'Wage/Head', 'Total Wages'].includes(h) ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(labour as any[]).length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>No labour entries yet</td></tr>
                  ) : (labour as any[]).map((l: any) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{l.date}</td>
                      <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: '#f0fdfa', color: '#0d9488' }}>{l.category}</span></td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{l.count}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>₹{fmt(l.wagePerHead)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0d9488' }}>₹{fmt(l.totalWages)}</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>{l.notes ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditing(l); setPanel('labour') }} style={{ padding: '5px 6px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b', display: 'flex' }}><Pencil size={12} /></button>
                          <button onClick={() => { if (confirm('Delete?')) delLabour.mutate(l.id) }} style={{ padding: '5px 6px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex' }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          eqLoading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontFamily: "'Roboto', sans-serif" }}>Loading…</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Roboto', sans-serif" }}>
                <thead>
                  <tr style={{ background: 'white', borderBottom: '2px solid #e2e8f0' }}>
                    {['Date', 'Equipment', 'Type', 'Hours Worked', 'Idle Hrs', 'Fuel (L)', 'Operator', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: ['Hours Worked', 'Idle Hrs', 'Fuel (L)'].includes(h) ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(equipment as any[]).length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>No equipment entries yet</td></tr>
                  ) : (equipment as any[]).map((e: any) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{e.date}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{e.equipmentName}</td>
                      <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: '#f8fafc', color: '#64748b' }}>{e.equipmentType}</span></td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{Number(e.hoursWorked).toFixed(1)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>{Number(e.idleHours).toFixed(1)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>{Number(e.fuelConsumed).toFixed(1)}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{e.operatorName ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditing(e); setPanel('equipment') }} style={{ padding: '5px 6px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b', display: 'flex' }}><Pencil size={12} /></button>
                          <button onClick={() => { if (confirm('Delete?')) delEquip.mutate(e.id) }} style={{ padding: '5px 6px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex' }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {panel === 'labour' && (
        <LabourPanel projectId={projectId} entry={editing} onClose={() => { setPanel(null); setEditing(undefined) }} onSaved={() => {}} />
      )}
      {panel === 'equipment' && (
        <EquipmentPanel projectId={projectId} entry={editing} onClose={() => { setPanel(null); setEditing(undefined) }} onSaved={() => {}} />
      )}
    </div>
  )
}
