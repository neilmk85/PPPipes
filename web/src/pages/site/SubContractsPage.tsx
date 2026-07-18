import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, X, ChevronDown, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { siteProjectApi } from '@/services/api'
import SiteFloatingNav, { SUB_CONTRACTOR_NAV } from './SiteFloatingNav'
import api from '@/services/api'

// ─── API ──────────────────────────────────────────────────────────────────────
const subContractApi = {
  getAll: (p: { siteProjectId?: number; status?: string }) =>
    api.get('/sub-contracts', { params: p }).then(r => r.data.data ?? []),
  getById: (id: number) => api.get(`/sub-contracts/${id}`).then(r => r.data.data),
  create: (d: any) => api.post('/sub-contracts', d).then(r => r.data.data),
  update: (id: number, d: any) => api.put(`/sub-contracts/${id}`, d).then(r => r.data.data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/sub-contracts/${id}/status`, { status }).then(r => r.data),
  delete: (id: number) => api.delete(`/sub-contracts/${id}`).then(r => r.data),
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface SCItem { id?: number; description: string; unit: string; qty: number; rate: number; amount: number; sortOrder: number }
interface SubContract {
  id: number; siteProjectId: number; agreementNumber: string; agreementDate: string
  mainContractorName: string; projectName: string; location?: string; scopeDescription?: string
  startDate?: string; endDate?: string; contractValue: string; status: string; notes?: string
  items: SCItem[]
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  DRAFT:       { bg: '#1e293b', text: '#94a3b8' },
  ACTIVE:      { bg: '#042f2e', text: '#5eead4' },
  COMPLETED:   { bg: '#1e3a5f', text: '#60a5fa' },
  TERMINATED:  { bg: '#3b0f0f', text: '#f87171' },
}

const STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'TERMINATED']
const UNITS = ['m', 'RMT', 'm²', 'm³', 'MT', 'Nos', 'LS', 'Job']

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Blank item ───────────────────────────────────────────────────────────────
const blankItem = (): SCItem => ({ description: '', unit: 'm', qty: 0, rate: 0, amount: 0, sortOrder: 0 })
const blankForm = () => ({
  siteProjectId: 0, agreementNumber: '', agreementDate: new Date().toISOString().slice(0, 10),
  mainContractorName: '', projectName: '', location: '', scopeDescription: '',
  startDate: '', endDate: '', contractValue: 0, status: 'DRAFT', notes: '',
  items: [blankItem()],
})

// ─── Form Panel ───────────────────────────────────────────────────────────────
function FormPanel({ projectId, sc, onClose, onSaved }: {
  projectId: number; sc?: SubContract; onClose: () => void; onSaved: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [form, setForm] = useState<any>(sc ? { ...sc, contractValue: Number(sc.contractValue) } : { ...blankForm(), siteProjectId: projectId })

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const setItem = (i: number, k: string, v: any) => {
    const items = [...form.items]
    items[i] = { ...items[i], [k]: v }
    if (k === 'qty' || k === 'rate') {
      const qty = k === 'qty' ? Number(v) : Number(items[i].qty)
      const rate = k === 'rate' ? Number(v) : Number(items[i].rate)
      items[i].amount = qty * rate
    }
    setForm((f: any) => ({ ...f, items }))
  }

  const addItem = () => setForm((f: any) => ({ ...f, items: [...f.items, blankItem()] }))
  const removeItem = (i: number) => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, j: number) => j !== i) }))

  const subtotal = form.items.reduce((s: number, it: SCItem) => s + Number(it.amount), 0)

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, items: form.items.map((it: SCItem, i: number) => ({ ...it, sortOrder: i })) }
      return sc ? subContractApi.update(sc.id, payload) : subContractApi.create(payload)
    },
    onSuccess: () => { toast.success(sc ? 'Agreement updated' : 'Agreement created'); qc.invalidateQueries({ queryKey: ['sub-contracts'] }); onSaved(); handleClose() },
    onError: () => toast.error('Failed to save'),
  })

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: "'Roboto', sans-serif" }
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 4, display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', transition: `opacity 0.28s`, opacity: visible ? 1 : 0 }} onClick={handleClose} />
      <div style={{ width: 720, background: 'white', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>SUB-CONTRACT AGREEMENT</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{sc ? `Edit — ${sc.agreementNumber}` : 'New Agreement'}</div>
          </div>
          <button onClick={handleClose} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} color="#64748b" /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Agreement details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Agreement Number</label>
              <input style={inputStyle} value={form.agreementNumber} onChange={e => setField('agreementNumber', e.target.value)} placeholder="Auto-generated if blank" />
            </div>
            <div>
              <label style={labelStyle}>Agreement Date *</label>
              <input style={inputStyle} type="date" value={form.agreementDate} onChange={e => setField('agreementDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Main Contractor Name *</label>
              <input style={inputStyle} value={form.mainContractorName} onChange={e => setField('mainContractorName', e.target.value)} placeholder="Name of main contractor" />
            </div>
            <div>
              <label style={labelStyle}>Project Name</label>
              <input style={inputStyle} value={form.projectName} onChange={e => setField('projectName', e.target.value)} placeholder="e.g. RWS Phase 2" />
            </div>
            <div>
              <label style={labelStyle}>Location / Chainage</label>
              <input style={inputStyle} value={form.location} onChange={e => setField('location', e.target.value)} placeholder="e.g. Km 12 to Km 24" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => setField('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input style={inputStyle} type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input style={inputStyle} type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Scope Description</label>
            <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.scopeDescription} onChange={e => setField('scopeDescription', e.target.value)} placeholder="Brief description of the scope of work..." />
          </div>

          {/* Items */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Scope Items</div>
              <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: '#0d9488', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
                <Plus size={12} /> Add Item
              </button>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Description', 'Unit', 'Qty', 'Rate', 'Amount', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Amount' || h === 'Qty' || h === 'Rate' ? 'right' : 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it: SCItem, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 10px' }}>
                        <input style={{ ...inputStyle, border: 'none', padding: '4px 0' }} value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="Work description" />
                      </td>
                      <td style={{ padding: '6px 10px', width: 80 }}>
                        <select style={{ ...inputStyle, border: 'none', padding: '4px 0' }} value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)}>
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 10px', width: 90 }}>
                        <input style={{ ...inputStyle, border: 'none', padding: '4px 0', textAlign: 'right' }} type="number" value={it.qty || ''} onChange={e => setItem(i, 'qty', e.target.value)} />
                      </td>
                      <td style={{ padding: '6px 10px', width: 100 }}>
                        <input style={{ ...inputStyle, border: 'none', padding: '4px 0', textAlign: 'right' }} type="number" value={it.rate || ''} onChange={e => setItem(i, 'rate', e.target.value)} />
                      </td>
                      <td style={{ padding: '6px 10px', width: 110, textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>
                        ₹{fmt(it.amount)}
                      </td>
                      <td style={{ padding: '6px 8px', width: 32 }}>
                        {form.items.length > 1 && (
                          <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 2 }}><X size={13} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc' }}>
                    <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a', textAlign: 'right' }}>Total Contract Value</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0d9488', textAlign: 'right' }}>₹{fmt(subtotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any additional terms or notes..." />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={handleClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', fontSize: 13, cursor: 'pointer', color: '#64748b' }}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0d9488', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: save.isPending ? 0.7 : 1 }}>
            {save.isPending ? 'Saving…' : sc ? 'Update Agreement' : 'Create Agreement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubContractsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [projectId, setProjectId] = useState(0)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SubContract | undefined>()

  const { data: projects = [] } = useQuery({ queryKey: ['site-projects'], queryFn: () => siteProjectApi.getAll().then(r => r.data.data ?? []) })
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['sub-contracts', projectId, filterStatus],
    queryFn: () => subContractApi.getAll({ siteProjectId: projectId || undefined, status: filterStatus }),
    enabled: projectId > 0,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => subContractApi.delete(id),
    onSuccess: () => { toast.success('Agreement deleted'); qc.invalidateQueries({ queryKey: ['sub-contracts'] }) },
    onError: () => toast.error('Failed to delete'),
  })

  const totalValue = contracts.reduce((s: number, c: SubContract) => s + Number(c.contractValue), 0)
  const active = contracts.filter((c: SubContract) => c.status === 'ACTIVE').length

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(150deg, #011512 0%, #042f2e 28%, #134e4a 55%, #0f766e 78%, #0d9488 100%)', padding: '28px 48px 36px', fontFamily: "'Roboto', sans-serif" }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <button onClick={() => navigate('/site/sub-contractor')} style={{ position: 'absolute', left: 0, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={16} />
          </button>
          <SiteFloatingNav inline items={SUB_CONTRACTOR_NAV} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>SUB-CONTRACT AGREEMENT</div>
            <h1 style={{ fontSize: 24, fontWeight: 300, color: 'white', marginBottom: 4 }}>Agreements</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>Work orders and scope received from main contractors</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={projectId} onChange={e => setProjectId(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 13, cursor: 'pointer', fontFamily: "'Roboto', sans-serif" }}>
              <option value={0} style={{ color: '#0f172a' }}>Select Project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id} style={{ color: '#0f172a' }}>{p.name}</option>)}
            </select>
            <button onClick={() => { setEditing(undefined); setShowForm(true) }}
              disabled={!projectId}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: projectId ? 'white' : 'rgba(255,255,255,0.3)', color: projectId ? '#0d9488' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: projectId ? 'pointer' : 'not-allowed', fontFamily: "'Roboto', sans-serif" }}>
              <Plus size={14} /> New Agreement
            </button>
          </div>
        </div>

        {/* Stat strip */}
        {projectId > 0 && (
          <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
            {[
              { label: 'Total Agreements', value: String(contracts.length) },
              { label: 'Active', value: String(active) },
              { label: 'Total Value', value: `₹${fmt(totalValue)}` },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 18, fontWeight: 300, color: 'white' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 400, letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {projectId > 0 && (
        <div style={{ padding: '16px 48px 0', display: 'flex', gap: 6 }}>
          {['ALL', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterStatus === s ? '#0d9488' : '#e2e8f0'}`, background: filterStatus === s ? '#0d9488' : 'white', color: filterStatus === s ? 'white' : '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'Roboto', sans-serif" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '24px 48px 64px' }}>
        {!projectId ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8', fontSize: 14, fontFamily: "'Roboto', sans-serif" }}>Select a project to view agreements</div>
        ) : isLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8', fontSize: 14, fontFamily: "'Roboto', sans-serif" }}>Loading…</div>
        ) : contracts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 14, color: '#94a3b8', fontFamily: "'Roboto', sans-serif" }}>No agreements found</div>
            <button onClick={() => setShowForm(true)} style={{ marginTop: 16, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Roboto', sans-serif" }}>
              <Plus size={14} /> Create first agreement
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {contracts.map((c: SubContract) => {
              const sc = STATUS_COLOR[c.status] ?? STATUS_COLOR.DRAFT
              return (
                <div key={c.id} style={{ background: 'white', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 20, fontFamily: "'Roboto', sans-serif" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{c.agreementNumber}</div>
                      <div style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.text }}>{c.status}</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>{c.mainContractorName} — {c.projectName}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {c.location && `${c.location} · `}
                      {c.startDate && `${c.startDate} → ${c.endDate ?? '—'}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0d9488' }}>₹{fmt(c.contractValue)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.items?.length ?? 0} items</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditing(c); setShowForm(true) }} style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}><Pencil size={13} /></button>
                    <button onClick={() => { if (confirm('Delete this agreement?')) deleteMut.mutate(c.id) }} style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <FormPanel
          projectId={projectId}
          sc={editing}
          onClose={() => { setShowForm(false); setEditing(undefined) }}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
