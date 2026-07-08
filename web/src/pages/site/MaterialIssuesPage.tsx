import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Trash2, Truck, ChevronDown, Building2, Hammer,
  Package, CalendarDays, ClipboardList, Search, X, ArrowLeft,
} from 'lucide-react'
import { materialIssueApi, siteProjectApi, contractorApi } from '@/services/api'

const UNITS = ['Nos', 'm', 'm²', 'm³', 'RMT', 'MT', 'KG', 'Bags', 'Litres', 'LS']

const issueSchema = z.object({
  siteProjectId: z.string().min(1, 'Project is required'),
  workOrderId: z.string().optional(),
  issuedTo: z.enum(['SUBCONTRACTOR', 'INHOUSE']),
  contractorId: z.string().optional(),
  contractorName: z.string().optional(),
  materialName: z.string().min(1, 'Material name is required'),
  specification: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  qty: z.string().min(1, 'Qty is required'),
  issueDate: z.string().min(1, 'Issue date is required'),
  issuedBy: z.string().optional(),
  vehicleNo: z.string().optional(),
  notes: z.string().optional(),
})

type IssueFormData = z.infer<typeof issueSchema>

interface MaterialIssue {
  id: number
  siteProjectId: number
  workOrderId?: number
  issuedTo: 'SUBCONTRACTOR' | 'INHOUSE'
  contractorId?: number
  contractorName?: string
  materialName: string
  specification?: string
  unit: string
  qty: string
  issueDate: string
  issuedBy?: string
  vehicleNo?: string
  notes?: string
}

// ─── Issue Panel (slide-in form) ────────────────────────────────────────────

function IssuePanel({
  editing,
  defaultProjectId,
  onClose,
}: {
  editing: MaterialIssue | null
  defaultProjectId?: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll({ status: 'ACTIVE' }),
  })
  const { data: contractorsData } = useQuery({
    queryKey: ['site-contractors'],
    queryFn: () => contractorApi.getAll({ active: true }),
  })

  const projects: any[] = projectsData?.data?.data ?? []
  const contractors: any[] = contractorsData?.data?.data ?? []
  const today = new Date().toISOString().slice(0, 10)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: editing
      ? {
          siteProjectId: String(editing.siteProjectId),
          workOrderId: editing.workOrderId ? String(editing.workOrderId) : '',
          issuedTo: editing.issuedTo,
          contractorId: editing.contractorId ? String(editing.contractorId) : '',
          contractorName: editing.contractorName ?? '',
          materialName: editing.materialName,
          specification: editing.specification ?? '',
          unit: editing.unit,
          qty: String(editing.qty),
          issueDate: editing.issueDate,
          issuedBy: editing.issuedBy ?? '',
          vehicleNo: editing.vehicleNo ?? '',
          notes: editing.notes ?? '',
        }
      : {
          siteProjectId: defaultProjectId ?? '',
          issuedTo: 'SUBCONTRACTOR',
          unit: 'Nos',
          qty: '1',
          issueDate: today,
        },
  })

  const issuedTo = watch('issuedTo')
  const selectedContractorId = watch('contractorId')

  const handleContractorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setValue('contractorId', id)
    const c = contractors.find((c) => String(c.id) === id)
    if (c) setValue('contractorName', c.name)
  }

  const saveMutation = useMutation({
    mutationFn: (data: IssueFormData) => {
      const payload = {
        ...data,
        siteProjectId: Number(data.siteProjectId),
        workOrderId: data.workOrderId ? Number(data.workOrderId) : undefined,
        contractorId: data.contractorId ? Number(data.contractorId) : undefined,
      }
      return editing
        ? materialIssueApi.update(editing.id, payload)
        : materialIssueApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-issues'] })
      toast.success(editing ? 'Material issue updated' : 'Material issue recorded')
      onClose()
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[201] w-full max-w-3xl bg-white shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-7 py-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? 'Edit Material Issue' : 'Record Material Issue'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Track material dispatched to contractors or inhouse teams</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
          className="flex-1 overflow-y-auto px-7 py-5 space-y-5"
        >
          {/* Row 1: Project + Issued To */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Project *</label>
              <div className="relative">
                <select
                  {...register('siteProjectId')}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.siteProjectId && <p className="text-xs text-red-500 mt-1">{errors.siteProjectId.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Issued To *</label>
              <div className="flex gap-2">
                {(['SUBCONTRACTOR', 'INHOUSE'] as const).map((t) => {
                  const active = watch('issuedTo') === t
                  return (
                    <label
                      key={t}
                      className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                        active ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input type="radio" value={t} {...register('issuedTo')} className="sr-only" />
                      {t === 'SUBCONTRACTOR' ? <Building2 size={14} className={active ? 'text-green-600' : 'text-gray-400'} /> : <Hammer size={14} className={active ? 'text-green-600' : 'text-gray-400'} />}
                      <span className={`text-sm font-medium ${active ? 'text-green-700' : 'text-gray-600'}`}>
                        {t === 'SUBCONTRACTOR' ? 'Subcontractor' : 'Inhouse'}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Contractor (full width, only if SUBCONTRACTOR) */}
          {issuedTo === 'SUBCONTRACTOR' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contractor</label>
              <div className="relative">
                <select
                  value={selectedContractorId ?? ''}
                  onChange={handleContractorChange}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select contractor…</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Row 3: Material Name + Specification */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Material Name *</label>
              <input
                {...register('materialName')}
                placeholder="e.g. PSC Pipe 600mm dia"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.materialName && <p className="text-xs text-red-500 mt-1">{errors.materialName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Specification</label>
              <input
                {...register('specification')}
                placeholder="e.g. IS 784, Class NP3"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Row 4: Qty + Unit + Issue Date */}
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Qty *</label>
              <input
                {...register('qty')}
                type="number"
                step="0.001"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.qty && <p className="text-xs text-red-500 mt-1">{errors.qty.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit *</label>
              <div className="relative">
                <select
                  {...register('unit')}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Issue Date *</label>
              <input
                {...register('issueDate')}
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.issueDate && <p className="text-xs text-red-500 mt-1">{errors.issueDate.message}</p>}
            </div>
          </div>

          {/* Row 5: Issued By + Vehicle No */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Issued By</label>
              <input
                {...register('issuedBy')}
                placeholder="Engineer name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle No.</label>
              <input
                {...register('vehicleNo')}
                placeholder="e.g. GJ 01 AB 1234"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Optional remarks"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
        </form>

        <div className="px-7 py-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit((d) => saveMutation.mutate(d))}
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 font-medium"
          >
            {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Record Issue'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MaterialIssuesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialIssue | null>(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterIssuedTo, setFilterIssuedTo] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })

  const params: any = {}
  if (filterProject) params.siteProjectId = Number(filterProject)
  if (filterIssuedTo) params.issuedTo = filterIssuedTo

  const { data, isLoading } = useQuery({
    queryKey: ['site-material-issues', filterProject, filterIssuedTo],
    queryFn: () => materialIssueApi.getAll(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => materialIssueApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-issues'] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const projects: any[] = projectsData?.data?.data ?? []
  const allIssues: MaterialIssue[] = data?.data?.data ?? []

  // Client-side filtering for search and date range
  const issues = allIssues.filter((i) => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !i.materialName.toLowerCase().includes(q) &&
        !(i.specification ?? '').toLowerCase().includes(q) &&
        !(i.contractorName ?? '').toLowerCase().includes(q) &&
        !(i.vehicleNo ?? '').toLowerCase().includes(q)
      ) return false
    }
    if (dateFrom && i.issueDate < dateFrom) return false
    if (dateTo && i.issueDate > dateTo) return false
    return true
  })

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]))

  // Stats
  const subCount = allIssues.filter((i) => i.issuedTo === 'SUBCONTRACTOR').length
  const inhouseCount = allIssues.filter((i) => i.issuedTo === 'INHOUSE').length
  const thisMonth = (() => {
    const m = new Date().toISOString().slice(0, 7)
    return allIssues.filter((i) => i.issueDate.startsWith(m)).length
  })()

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this material issue entry?')) deleteMutation.mutate(id)
  }

  const handleEdit = (issue: MaterialIssue) => {
    setEditing(issue)
    setPanelOpen(true)
  }

  const openNew = () => {
    setEditing(null)
    setPanelOpen(true)
  }

  const closePanel = () => {
    setPanelOpen(false)
    setEditing(null)
  }

  const hasFilters = !!(filterProject || filterIssuedTo || search || dateFrom || dateTo)

  const clearFilters = () => {
    setFilterProject('')
    setFilterIssuedTo('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 40%, #15803d 70%, #16a34a 100%)' }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative px-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <button
                onClick={() => navigate('/site')}
                className="flex items-center gap-1.5 text-green-200 hover:text-white text-sm mb-3 transition-colors"
              >
                <ArrowLeft size={15} />
                Site Management
              </button>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Truck size={18} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Material Issues</h1>
              </div>
              <p className="text-green-200 text-sm mt-1">
                Track materials dispatched to sub-contractors and inhouse teams
              </p>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-green-700 text-sm font-semibold rounded-xl hover:bg-green-50 transition-colors shadow"
            >
              <Plus size={16} />
              Record Issue
            </button>
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Total Issues', value: allIssues.length, icon: <ClipboardList size={15} />, color: 'text-green-200' },
              { label: 'To Subcontractors', value: subCount, icon: <Building2 size={15} />, color: 'text-orange-200' },
              { label: 'Inhouse', value: inhouseCount, icon: <Hammer size={15} />, color: 'text-blue-200' },
              { label: 'This Month', value: thisMonth, icon: <CalendarDays size={15} />, color: 'text-yellow-200' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
                <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${color}`}>
                  {icon}
                  {label}
                </div>
                <div className="text-2xl font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-5 shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search material, contractor, vehicle…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Project filter */}
            <div className="relative">
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[160px]"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Issued To filter */}
            <div className="relative">
              <select
                value={filterIssuedTo}
                onChange={(e) => setFilterIssuedTo(e.target.value)}
                className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Types</option>
                <option value="SUBCONTRACTOR">Subcontractor</option>
                <option value="INHOUSE">Inhouse</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>

          {hasFilters && issues.length !== allIssues.length && (
            <p className="text-xs text-gray-500 mt-2">
              Showing {issues.length} of {allIssues.length} records
            </p>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
          ) : issues.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package size={36} className="mx-auto mb-3 opacity-25" />
              <p className="text-sm font-medium text-gray-500">
                {hasFilters ? 'No issues match your filters' : 'No material issues recorded yet'}
              </p>
              {!hasFilters && (
                <button onClick={openNew} className="mt-3 text-sm text-green-600 hover:underline font-medium">
                  + Record first issue
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  {!filterProject && (
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Project</th>
                  )}
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Material</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Issued To</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">By</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {issues.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    projectName={filterProject ? undefined : projectMap[issue.siteProjectId]}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {panelOpen && (
        <IssuePanel
          editing={editing}
          defaultProjectId={filterProject || undefined}
          onClose={closePanel}
        />
      )}
    </div>
  )
}

// ─── Issue Row ───────────────────────────────────────────────────────────────

function IssueRow({
  issue,
  projectName,
  onEdit,
  onDelete,
}: {
  issue: MaterialIssue
  projectName?: string
  onEdit: (i: MaterialIssue) => void
  onDelete: (id: number) => void
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{issue.issueDate.slice(0, 10)}</td>
      {projectName !== undefined && (
        <td className="px-4 py-3">
          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
            {projectName ?? '—'}
          </span>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{issue.materialName}</div>
        {issue.specification && (
          <div className="text-xs text-gray-400 mt-0.5">{issue.specification}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">
        {issue.qty} <span className="text-gray-400 font-normal">{issue.unit}</span>
      </td>
      <td className="px-4 py-3">
        {issue.issuedTo === 'SUBCONTRACTOR' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
            <Building2 size={11} />
            {issue.contractorName ?? 'Subcontractor'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            <Hammer size={11} />
            Inhouse
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{issue.vehicleNo ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{issue.issuedBy ?? '—'}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(issue)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(issue.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}
