import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteFloatingNav from './SiteFloatingNav'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, X, Loader2, MapPin, Building2, Calendar,
  IndianRupee, ArrowLeft, Edit2, Trash2, CheckCircle2,
  Clock, PauseCircle, ChevronRight, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { siteProjectApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiteProject {
  id: number
  name: string
  clientName: string
  location: string
  contractNo?: string
  contractValue?: number
  startDate?: string
  endDate?: string
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD'
  notes?: string
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Active',
    icon: <Clock size={12} />,
    classes: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  COMPLETED: {
    label: 'Completed',
    icon: <CheckCircle2 size={12} />,
    classes: 'bg-green-50 text-green-700 border-green-200',
  },
  ON_HOLD: {
    label: 'On Hold',
    icon: <PauseCircle size={12} />,
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
  },
}

function fmt(val?: number) {
  if (val == null) return '—'
  return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Create / Edit Panel ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', clientName: '', location: '',
  contractNo: '', contractValue: '',
  startDate: '', endDate: '', status: 'ACTIVE', notes: '',
}

function SitePanel({ project, onClose, onSaved }: {
  project?: SiteProject
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!project
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name ?? '',
        clientName: project.clientName ?? '',
        location: project.location ?? '',
        contractNo: project.contractNo ?? '',
        contractValue: project.contractValue != null ? String(project.contractValue) : '',
        startDate: project.startDate ?? '',
        endDate: project.endDate ?? '',
        status: project.status ?? 'ACTIVE',
        notes: project.notes ?? '',
      })
    }
  }, [project])

  function handleClose() { setVisible(false); setTimeout(onClose, 300) }
  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Project name is required'); return }
    if (!form.clientName.trim()) { toast.error('Client name is required'); return }
    if (!form.location.trim()) { toast.error('Location is required'); return }
    setSaving(true)
    try {
      const payload: any = {
        name: form.name.trim(),
        clientName: form.clientName.trim(),
        location: form.location.trim(),
        contractNo: form.contractNo || undefined,
        contractValue: form.contractValue ? parseFloat(form.contractValue) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        status: form.status,
        notes: form.notes || undefined,
      }
      if (isEdit) {
        await siteProjectApi.update(project!.id, payload)
        toast.success('Project updated')
      } else {
        await siteProjectApi.create(payload)
        toast.success('Project created')
      }
      onSaved()
      handleClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, opts?: {
    placeholder?: string; type?: string; required?: boolean
  }) => (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
        {label}{opts?.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder ?? ''}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors"
      />
    </div>
  )

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div className={`fixed inset-y-0 right-0 w-[680px] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Building2 size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">
                  {isEdit ? `Edit · ${project!.name}` : 'New Site Project'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isEdit ? 'Update project details' : 'Register a new site project'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClose} className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold shadow-sm transition-colors">
                {saving && <Loader2 size={13} className="animate-spin" />}
                {isEdit ? 'Update Project' : 'Save Project'}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-6 space-y-5">

              {/* Project Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Project Details</p>
                {field('Project Name', 'name', { placeholder: 'e.g. Narmada Water Supply Phase 2', required: true })}
                <div className="grid grid-cols-2 gap-4">
                  {field('Client / Owner', 'clientName', { placeholder: 'e.g. MPJAL / Irrigation Dept.', required: true })}
                  {field('Location', 'location', { placeholder: 'e.g. Jabalpur, MP', required: true })}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {field('Contract No.', 'contractNo', { placeholder: 'e.g. MPJAL/2024/001' })}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                      Contract Value (₹)
                    </label>
                    <div className="relative">
                      <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        value={form.contractValue}
                        onChange={e => set('contractValue', e.target.value)}
                        placeholder="0"
                        className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Schedule</p>
                <div className="grid grid-cols-2 gap-4">
                  {field('Start Date', 'startDate', { type: 'date' })}
                  {field('End Date (Planned)', 'endDate', { type: 'date' })}
                </div>
              </div>

              {/* Status */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
                <div className="flex gap-3">
                  {(['ACTIVE', 'ON_HOLD', 'COMPLETED'] as const).map(s => {
                    const cfg = STATUS_CONFIG[s]
                    return (
                      <button
                        key={s}
                        onClick={() => set('status', s)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          form.status === s
                            ? cfg.classes + ' shadow-sm scale-[1.02]'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300 bg-white'
                        }`}
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={3}
                  placeholder="Project scope, special conditions, remarks…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors resize-none"
                />
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex justify-end gap-2.5 shrink-0">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold shadow-sm transition-colors">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {isEdit ? 'Update Project' : 'Save Project'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onEdit, onDelete }: {
  project: SiteProject
  onEdit: (p: SiteProject) => void
  onDelete: (p: SiteProject) => void
}) {
  const navigate = useNavigate()
  const cfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.ACTIVE

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      {/* Top bar */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-gray-900 leading-snug truncate">{project.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{project.clientName}</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.classes} shrink-0`}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <MapPin size={12} className="text-gray-400 shrink-0" />
          <span>{project.location}</span>
        </div>
        {project.contractNo && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FileText size={12} className="text-gray-400 shrink-0" />
            <span className="font-mono">{project.contractNo}</span>
          </div>
        )}
        {project.contractValue != null && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <IndianRupee size={12} className="text-gray-400 shrink-0" />
            <span className="font-semibold text-gray-700">{fmt(project.contractValue)}</span>
          </div>
        )}
        {(project.startDate || project.endDate) && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar size={12} className="text-gray-400 shrink-0" />
            <span>{fmtDate(project.startDate)} → {fmtDate(project.endDate)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 flex items-center gap-2">
        <button
          onClick={() => navigate(`/site/projects/${project.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
        >
          Open Project <ChevronRight size={13} />
        </button>
        <button
          onClick={() => onEdit(project)}
          className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(project)}
          className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'ON_HOLD', label: 'On Hold' },
  { key: 'COMPLETED', label: 'Completed' },
]

export default function SitesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showPanel, setShowPanel] = useState(false)
  const [editProject, setEditProject] = useState<SiteProject | undefined>()

  const { data = [], isLoading } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll().then(r => r.data.data ?? []),
  })

  const projects: SiteProject[] = data.filter((p: SiteProject) => {
    const matchStatus = !statusFilter || p.status === statusFilter
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase()) ||
      (p.contractNo ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts = {
    '': data.length,
    ACTIVE: data.filter((p: SiteProject) => p.status === 'ACTIVE').length,
    ON_HOLD: data.filter((p: SiteProject) => p.status === 'ON_HOLD').length,
    COMPLETED: data.filter((p: SiteProject) => p.status === 'COMPLETED').length,
  } as Record<string, number>

  async function handleDelete(p: SiteProject) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    try {
      await siteProjectApi.delete(p.id)
      toast.success('Project deleted')
      qc.invalidateQueries({ queryKey: ['site-projects'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to delete')
    }
  }

  return (
    <>
      {/* Header */}
      <div
        className="animate-gradient border-b border-gray-200 px-6 py-5 flex items-center gap-4"
      >
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => navigate('/site')} className="text-blue-700 hover:text-blue-900 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Site Projects</h1>
            <p className="text-xs text-gray-500">Manage all water supply pipeline projects</p>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <SiteFloatingNav theme="light" inline />
        </div>
        <button
          onClick={() => { setEditProject(undefined); setShowPanel(true) }}
          className="shrink-0 active:scale-95"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            border: 'none',
            color: '#3b82f6',
            fontSize: 22, fontWeight: 300,
            fontFamily: '"Roboto", sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', lineHeight: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          }}
        >
          +
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 pt-3 flex items-center gap-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors relative ${
                statusFilter === tab.key
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  statusFilter === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, client, location, contract no…"
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
          <span className="text-sm text-gray-400 font-medium">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <Building2 size={28} className="text-blue-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              {search || statusFilter ? 'No projects found' : 'No site projects yet'}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {search || statusFilter ? 'Try adjusting your filters' : 'Create your first site project to get started'}
            </p>
            {!search && !statusFilter && (
              <button
                onClick={() => { setEditProject(undefined); setShowPanel(true) }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Plus size={15} /> New Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={proj => { setEditProject(proj); setShowPanel(true) }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {showPanel && (
        <SitePanel
          project={editProject}
          onClose={() => { setShowPanel(false); setEditProject(undefined) }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['site-projects'] })}
        />
      )}
    </>
  )
}
