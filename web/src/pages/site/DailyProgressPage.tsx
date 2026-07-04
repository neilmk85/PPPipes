import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CalendarDays,
  Hammer,
  Users,
  Truck,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  X,
  Cloud,
  Sun,
  CloudRain,
} from 'lucide-react'
import {
  dailyProgressApi,
  labourAttendanceApi,
  equipmentLogApi,
  siteProjectApi,
  workPackageApi,
} from '@/services/api'

const WEATHER_OPTIONS = ['SUNNY', 'CLOUDY', 'RAINY', 'STORMY']
const WEATHER_ICONS: Record<string, React.ReactNode> = {
  SUNNY: <Sun size={13} />,
  CLOUDY: <Cloud size={13} />,
  RAINY: <CloudRain size={13} />,
  STORMY: <CloudRain size={13} className="text-red-500" />,
}

const LABOUR_CATEGORIES = ['ENGINEER', 'SUPERVISOR', 'SKILLED', 'UNSKILLED', 'OPERATOR']
const UNITS = ['m', 'm²', 'm³', 'LS', 'Nos', 'RMT', 'MT', 'KG']

// ─── Small inline form panels ─────────────────────────────────────────────────

function ProgressForm({
  siteProjectId,
  date,
  packages,
  editing,
  onClose,
}: {
  siteProjectId: number
  date: string
  packages: any[]
  editing: any | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    workPackageId: editing?.workPackageId ? String(editing.workPackageId) : '',
    qtyCompleted: editing ? String(editing.qtyCompleted) : '0',
    unit: editing?.unit ?? 'LS',
    weatherCondition: editing?.weatherCondition ?? '',
    remarks: editing?.remarks ?? '',
    recordedBy: editing?.recordedBy ?? '',
  })

  const saveMutation = useMutation({
    mutationFn: (d: typeof form) =>
      editing
        ? dailyProgressApi.update(editing.id, { ...d, siteProjectId, date, workPackageId: Number(d.workPackageId) })
        : dailyProgressApi.create({ ...d, siteProjectId, date, workPackageId: Number(d.workPackageId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-daily-progress', siteProjectId, date] })
      toast.success(editing ? 'Updated' : 'Progress recorded')
      onClose()
    },
    onError: () => toast.error('Failed to save'),
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Work Package</label>
          <div className="relative">
            <select
              value={form.workPackageId}
              onChange={(e) => {
                const id = e.target.value
                set('workPackageId', id)
                const pkg = packages.find((p) => String(p.id) === id)
                if (pkg) set('unit', pkg.unit)
              }}
              className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select package…</option>
              {packages.filter((p) => p.executionType === 'INHOUSE').map((p) => (
                <option key={p.id} value={p.id}>{p.description} ({p.phase})</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Qty Done</label>
            <input type="number" step="0.001" min="0" value={form.qtyCompleted}
              onChange={(e) => set('qtyCompleted', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
            <div className="relative">
              <select value={form.unit} onChange={(e) => set('unit', e.target.value)}
                className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-7 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Weather</label>
          <div className="relative">
            <select value={form.weatherCondition} onChange={(e) => set('weatherCondition', e.target.value)}
              className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">—</option>
              {WEATHER_OPTIONS.map((w) => <option key={w}>{w}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Recorded By</label>
          <input value={form.recordedBy} onChange={(e) => set('recordedBy', e.target.value)}
            placeholder="Engineer name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
        <input value={form.remarks} onChange={(e) => set('remarks', e.target.value)}
          placeholder="Optional remarks"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
        <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.workPackageId}
          className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
          {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function LabourForm({
  siteProjectId,
  date,
  editing,
  onClose,
}: {
  siteProjectId: number
  date: string
  editing: any | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    category: editing?.category ?? 'SKILLED',
    count: editing ? String(editing.count) : '1',
    wagePerHead: editing ? String(editing.wagePerHead) : '0',
    totalWages: editing ? String(editing.totalWages) : '0',
    recordedBy: editing?.recordedBy ?? '',
    notes: editing?.notes ?? '',
  })

  const set = (k: string, v: string) => setForm((f) => {
    const next = { ...f, [k]: v }
    if (k === 'count' || k === 'wagePerHead') {
      const total = (Number(next.count) * Number(next.wagePerHead)).toFixed(2)
      next.totalWages = total
    }
    return next
  })

  const saveMutation = useMutation({
    mutationFn: (d: typeof form) =>
      editing
        ? labourAttendanceApi.update(editing.id, { ...d, siteProjectId, date, count: Number(d.count) })
        : labourAttendanceApi.create({ ...d, siteProjectId, date, count: Number(d.count) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-labour', siteProjectId, date] })
      toast.success(editing ? 'Updated' : 'Labour attendance recorded')
      onClose()
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <div className="relative">
            <select value={form.category} onChange={(e) => set('category', e.target.value)}
              className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              {LABOUR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Count</label>
            <input type="number" min="0" value={form.count} onChange={(e) => set('count', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Wage/Head</label>
            <input type="number" step="0.01" min="0" value={form.wagePerHead} onChange={(e) => set('wagePerHead', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Total</label>
            <input type="number" step="0.01" value={form.totalWages} onChange={(e) => set('totalWages', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Recorded By</label>
          <input value={form.recordedBy} onChange={(e) => set('recordedBy', e.target.value)}
            placeholder="Engineer name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
        <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}
          className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60">
          {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function EquipmentForm({
  siteProjectId,
  date,
  editing,
  onClose,
}: {
  siteProjectId: number
  date: string
  editing: any | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    equipmentName: editing?.equipmentName ?? '',
    equipmentType: editing?.equipmentType ?? '',
    hoursWorked: editing ? String(editing.hoursWorked) : '0',
    idleHours: editing ? String(editing.idleHours) : '0',
    fuelConsumed: editing ? String(editing.fuelConsumed) : '0',
    operatorName: editing?.operatorName ?? '',
    remarks: editing?.remarks ?? '',
    recordedBy: editing?.recordedBy ?? '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const saveMutation = useMutation({
    mutationFn: (d: typeof form) =>
      editing
        ? equipmentLogApi.update(editing.id, { ...d, siteProjectId, date })
        : equipmentLogApi.create({ ...d, siteProjectId, date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-equipment', siteProjectId, date] })
      toast.success(editing ? 'Updated' : 'Equipment log recorded')
      onClose()
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Equipment Name</label>
          <input value={form.equipmentName} onChange={(e) => set('equipmentName', e.target.value)}
            placeholder="e.g. JCB 3CX, Compressor"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <input value={form.equipmentType} onChange={(e) => set('equipmentType', e.target.value)}
            placeholder="e.g. Excavator, Generator"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hours Worked</label>
          <input type="number" step="0.5" min="0" value={form.hoursWorked} onChange={(e) => set('hoursWorked', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Idle Hours</label>
          <input type="number" step="0.5" min="0" value={form.idleHours} onChange={(e) => set('idleHours', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fuel (L)</label>
          <input type="number" step="0.5" min="0" value={form.fuelConsumed} onChange={(e) => set('fuelConsumed', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Operator</label>
          <input value={form.operatorName} onChange={(e) => set('operatorName', e.target.value)}
            placeholder="Operator name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
          <input value={form.remarks} onChange={(e) => set('remarks', e.target.value)}
            placeholder="Optional"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
        <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.equipmentName}
          className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60">
          {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title,
  icon,
  color,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  color: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3 border-b ${color}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <span className="text-xs font-medium opacity-70">{count} entries</span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DailyProgressPage() {
  const today = new Date().toISOString().slice(0, 10)
  const queryClient = useQueryClient()

  const [selectedProject, setSelectedProject] = useState('')
  const [selectedDate, setSelectedDate] = useState(today)

  // inline form states
  const [showProgressForm, setShowProgressForm] = useState(false)
  const [editingProgress, setEditingProgress] = useState<any>(null)
  const [showLabourForm, setShowLabourForm] = useState(false)
  const [editingLabour, setEditingLabour] = useState<any>(null)
  const [showEquipForm, setShowEquipForm] = useState(false)
  const [editingEquip, setEditingEquip] = useState<any>(null)

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })
  const projects: any[] = projectsData?.data?.data ?? []

  const projectId = selectedProject ? Number(selectedProject) : 0

  const { data: packagesData } = useQuery({
    queryKey: ['site-work-packages', projectId],
    queryFn: () => workPackageApi.getByProject(projectId),
    enabled: !!projectId,
  })
  const packages: any[] = packagesData?.data?.data ?? []

  const { data: progressData } = useQuery({
    queryKey: ['site-daily-progress', projectId, selectedDate],
    queryFn: () => dailyProgressApi.getByProject(projectId, { date: selectedDate }),
    enabled: !!projectId,
  })
  const { data: labourData } = useQuery({
    queryKey: ['site-labour', projectId, selectedDate],
    queryFn: () => labourAttendanceApi.getByProject(projectId, { date: selectedDate }),
    enabled: !!projectId,
  })
  const { data: equipData } = useQuery({
    queryKey: ['site-equipment', projectId, selectedDate],
    queryFn: () => equipmentLogApi.getByProject(projectId, { date: selectedDate }),
    enabled: !!projectId,
  })

  const progressRecords: any[] = progressData?.data?.data ?? []
  const labourRecords: any[] = labourData?.data?.data ?? []
  const equipRecords: any[] = equipData?.data?.data ?? []

  const deleteProgress = useMutation({
    mutationFn: dailyProgressApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['site-daily-progress', projectId, selectedDate] }); toast.success('Deleted') },
  })
  const deleteLabour = useMutation({
    mutationFn: labourAttendanceApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['site-labour', projectId, selectedDate] }); toast.success('Deleted') },
  })
  const deleteEquip = useMutation({
    mutationFn: equipmentLogApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['site-equipment', projectId, selectedDate] }); toast.success('Deleted') },
  })

  const totalLabour = labourRecords.reduce((s, r) => s + r.count, 0)
  const totalWages = labourRecords.reduce((s, r) => s + Number(r.totalWages), 0)
  const totalFuel = equipRecords.reduce((s, r) => s + Number(r.fuelConsumed), 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center">
          <CalendarDays size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Progress Entry</h1>
          <p className="text-sm text-gray-500">Work done · Labour attendance · Equipment log</p>
        </div>
      </div>

      {/* Project + Date selectors */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="relative">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
          >
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {!selectedProject ? (
        <div className="text-center py-20 text-gray-400">
          <CalendarDays size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a project to start entry</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xl font-bold text-indigo-700">{progressRecords.length}</p>
              <p className="text-xs text-indigo-500 mt-0.5">Work Entries</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xl font-bold text-orange-700">{totalLabour}</p>
              <p className="text-xs text-orange-500 mt-0.5">
                Total Manpower · ₹{totalWages.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xl font-bold text-teal-700">{equipRecords.length}</p>
              <p className="text-xs text-teal-500 mt-0.5">
                Equipment · {totalFuel} L fuel
              </p>
            </div>
          </div>

          {/* Work Progress Section */}
          <Section
            title="Work Progress"
            icon={<Hammer size={16} className="text-indigo-700" />}
            color="bg-indigo-50 text-indigo-800"
            count={progressRecords.length}
          >
            {progressRecords.map((rec) =>
              editingProgress?.id === rec.id ? (
                <ProgressForm key={rec.id} siteProjectId={projectId} date={selectedDate}
                  packages={packages} editing={rec}
                  onClose={() => setEditingProgress(null)} />
              ) : (
                <div key={rec.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {rec.workPackage?.description ?? `Package #${rec.workPackageId}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rec.qtyCompleted} {rec.unit}
                        {rec.weatherCondition && (
                          <span className="ml-2 inline-flex items-center gap-1 text-gray-400">
                            {WEATHER_ICONS[rec.weatherCondition]}
                            {rec.weatherCondition}
                          </span>
                        )}
                        {rec.recordedBy && <span className="ml-2">· {rec.recordedBy}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditingProgress(rec); setShowProgressForm(false) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Pencil size={13} /></button>
                    <button onClick={() => window.confirm('Delete?') && deleteProgress.mutate(rec.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            )}
            {showProgressForm ? (
              <ProgressForm siteProjectId={projectId} date={selectedDate}
                packages={packages} editing={null}
                onClose={() => setShowProgressForm(false)} />
            ) : (
              <button onClick={() => { setShowProgressForm(true); setEditingProgress(null) }}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <Plus size={14} /> Add progress entry
              </button>
            )}
          </Section>

          {/* Labour Attendance Section */}
          <Section
            title="Labour Attendance"
            icon={<Users size={16} className="text-orange-700" />}
            color="bg-orange-50 text-orange-800"
            count={labourRecords.length}
          >
            {labourRecords.map((rec) =>
              editingLabour?.id === rec.id ? (
                <LabourForm key={rec.id} siteProjectId={projectId} date={selectedDate}
                  editing={rec} onClose={() => setEditingLabour(null)} />
              ) : (
                <div key={rec.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                      {rec.category}
                    </span>
                    <span className="text-sm text-gray-800 font-medium">{rec.count} persons</span>
                    {Number(rec.wagePerHead) > 0 && (
                      <span className="text-xs text-gray-500">
                        ₹{Number(rec.wagePerHead).toLocaleString('en-IN')}/head · ₹{Number(rec.totalWages).toLocaleString('en-IN')} total
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditingLabour(rec); setShowLabourForm(false) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Pencil size={13} /></button>
                    <button onClick={() => window.confirm('Delete?') && deleteLabour.mutate(rec.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            )}
            {showLabourForm ? (
              <LabourForm siteProjectId={projectId} date={selectedDate}
                editing={null} onClose={() => setShowLabourForm(false)} />
            ) : (
              <button onClick={() => { setShowLabourForm(true); setEditingLabour(null) }}
                className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-800 font-medium">
                <Plus size={14} /> Add labour entry
              </button>
            )}
          </Section>

          {/* Equipment Log Section */}
          <Section
            title="Equipment Log"
            icon={<Truck size={16} className="text-teal-700" />}
            color="bg-teal-50 text-teal-800"
            count={equipRecords.length}
          >
            {equipRecords.map((rec) =>
              editingEquip?.id === rec.id ? (
                <EquipmentForm key={rec.id} siteProjectId={projectId} date={selectedDate}
                  editing={rec} onClose={() => setEditingEquip(null)} />
              ) : (
                <div key={rec.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {rec.equipmentName}
                        {rec.equipmentType && <span className="text-gray-400 font-normal"> · {rec.equipmentType}</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rec.hoursWorked}h worked
                        {Number(rec.idleHours) > 0 && ` · ${rec.idleHours}h idle`}
                        {Number(rec.fuelConsumed) > 0 && ` · ${rec.fuelConsumed}L fuel`}
                        {rec.operatorName && ` · ${rec.operatorName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditingEquip(rec); setShowEquipForm(false) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Pencil size={13} /></button>
                    <button onClick={() => window.confirm('Delete?') && deleteEquip.mutate(rec.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            )}
            {showEquipForm ? (
              <EquipmentForm siteProjectId={projectId} date={selectedDate}
                editing={null} onClose={() => setShowEquipForm(false)} />
            ) : (
              <button onClick={() => { setShowEquipForm(true); setEditingEquip(null) }}
                className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 font-medium">
                <Plus size={14} /> Add equipment entry
              </button>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}
