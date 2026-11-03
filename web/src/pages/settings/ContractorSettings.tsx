import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, RefreshCw, HardHat, CalendarDays, ChevronDown, ChevronRight, Save, IndianRupee } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { contractorApi } from '@/services/api'
import { contractorProcessApi, CONTRACTOR_PROCESS_TYPES, type ContractorProcessAssignment, coatingRatesApi, spinningRatesApi, type CoatingContractorRate, type SpinningBedRate } from '@/services/businessApi'

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Master List ───────────────────────────────────────────────────────────────

function ContractorMasterList() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name,  setName]  = useState('')
  const [phone, setPhone] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['contractors-list'],
    queryFn:  () => contractorApi.getAll({ active: true }).then(r => r.data?.data ?? []),
  })
  const contractors: any[] = data ?? []

  const createMutation = useMutation({
    mutationFn: (d: any) => contractorApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contractors-list'] }); reset(); toast.success('Contractor added') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to add contractor'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: any) => contractorApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contractors-list'] }); reset(); toast.success('Contractor updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contractorApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contractors-list'] }); toast.success('Contractor removed') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to remove'),
  })

  function reset() { setShowForm(false); setEditing(null); setName(''); setPhone('') }

  function openEdit(c: any) { setEditing(c); setName(c.name); setPhone(c.phone ?? ''); setShowForm(true) }

  function handleSubmit() {
    if (!name.trim()) return toast.error('Name is required')
    const d = { name: name.trim(), phone: phone.trim() || undefined }
    if (editing) updateMutation.mutate({ id: editing.id, d })
    else createMutation.mutate(d)
  }

  const busy = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Contractor Master List</h3>
          <p className="text-xs text-gray-500 mt-0.5">All contractors in the system — used for process assignments</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors">
            <Plus size={13} /> Add Contractor
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-violet-700">{editing ? 'Edit Contractor' : 'New Contractor'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Contractor name"
                className="w-full border border-gray-300 rounded-lg text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full border border-gray-300 rounded-lg text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} disabled={busy}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60 transition-colors">
              {busy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
              {editing ? 'Save Changes' : 'Add Contractor'}
            </button>
            <button onClick={reset}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors">
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><RefreshCw size={16} className="animate-spin text-gray-400" /></div>
      ) : contractors.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <HardHat size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No contractors yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Phone</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contractors.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{c.phone || '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => { if (confirm(`Remove "${c.name}"?`)) deleteMutation.mutate(c.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Process Assignments ───────────────────────────────────────────────────────

function ProcessAssignments() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAddFor, setShowAddFor] = useState<string | null>(null)
  const [selectedContractor, setSelectedContractor] = useState('')
  const [commencedAt, setCommencedAt] = useState('')

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['contractor-process-assignments'],
    queryFn:  () => contractorProcessApi.list(),
  })

  const { data: contractorsData } = useQuery({
    queryKey: ['contractors-list'],
    queryFn:  () => contractorApi.getAll({ active: true }).then(r => r.data?.data ?? []),
  })
  const contractors: any[] = contractorsData ?? []

  const createMutation = useMutation({
    mutationFn: (d: { contractorId: number; processType: string; commencedAt: string }) =>
      contractorProcessApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contractor-process-assignments'] })
      setShowAddFor(null); setSelectedContractor(''); setCommencedAt('')
      toast.success('Assignment created')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contractorProcessApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contractor-process-assignments'] }); toast.success('Assignment removed') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to remove'),
  })

  // Group assignments by process type, sorted by commenced_at DESC
  const byProcess: Record<string, ContractorProcessAssignment[]> = {}
  for (const a of assignments) {
    if (!byProcess[a.processType]) byProcess[a.processType] = []
    byProcess[a.processType].push(a)
  }
  for (const k of Object.keys(byProcess)) {
    byProcess[k].sort((a, b) => new Date(b.commencedAt).getTime() - new Date(a.commencedAt).getTime())
  }

  function handleAdd(processType: string) {
    if (!selectedContractor || !commencedAt) return toast.error('Select contractor and commencement date')
    createMutation.mutate({ contractorId: Number(selectedContractor), processType, commencedAt })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Process Assignments</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Assign contractors to processes with a commencement date. Full history is kept — the most recent assignment is the current one.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><RefreshCw size={16} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-2">
          {CONTRACTOR_PROCESS_TYPES.map(({ key, label }) => {
            const rows = byProcess[key] ?? []
            const current = rows[0]
            const isOpen = expanded === key
            const isAdding = showAddFor === key

            return (
              <div key={key} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50/60 cursor-pointer transition-colors"
                  onClick={() => setExpanded(isOpen ? null : key)}>
                  <button className="text-gray-400 flex-shrink-0">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-800">{label}</span>
                    {current ? (
                      <span className="ml-2 text-[10px] font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                        {current.contractor?.name ?? `#${current.contractorId}`}
                        <span className="text-gray-400 ml-1">since {fmtDate(current.commencedAt)}</span>
                      </span>
                    ) : (
                      <span className="ml-2 text-[10px] text-gray-400 italic">No contractor assigned</span>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setShowAddFor(isAdding ? null : key); setExpanded(key); setSelectedContractor(''); setCommencedAt('') }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors flex-shrink-0">
                    <Plus size={10} /> Assign
                  </button>
                </div>

                {/* Expanded: add form + history */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/40">

                    {/* Add form */}
                    {isAdding && (
                      <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Contractor</label>
                          <select value={selectedContractor} onChange={e => setSelectedContractor(e.target.value)}
                            className="border border-gray-300 rounded-lg text-xs px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white min-w-40">
                            <option value="">Select contractor…</option>
                            {contractors.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Commencement Date</label>
                          <input type="date" value={commencedAt} onChange={e => setCommencedAt(e.target.value)}
                            className="border border-gray-300 rounded-lg text-xs px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAdd(key)} disabled={createMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60 transition-colors">
                            {createMutation.isPending ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                            Save
                          </button>
                          <button onClick={() => setShowAddFor(null)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-white transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* History */}
                    {rows.length === 0 ? (
                      <p className="px-4 py-3 text-[11px] text-gray-400 italic">No assignments yet</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Contractor</th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                              <CalendarDays size={10} className="inline mr-1" />Commenced
                            </th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                            <th className="px-4 py-2 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map((a, idx) => (
                            <tr key={a.id} className="hover:bg-gray-50/60">
                              <td className="px-4 py-2.5 font-medium text-gray-800">
                                {a.contractor?.name ?? `#${a.contractorId}`}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600">{fmtDate(a.commencedAt)}</td>
                              <td className="px-4 py-2.5 text-right">
                                {idx === 0 ? (
                                  <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Current</span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">Past</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => { if (confirm('Remove this assignment?')) deleteMutation.mutate(a.id) }}
                                  className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 size={11} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Coating Rates ─────────────────────────────────────────────────────────────

const COATING_DIAMETERS = [350, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1600, 1700]

function CoatingRates() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<number, string>>({})

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ['coating-rates'],
    queryFn: () => coatingRatesApi.list(),
  })

  const rateMap: Record<number, string> = Object.fromEntries(
    saved.map((r: CoatingContractorRate) => [r.diameterMm, r.ratePerPipe])
  )

  function startEdit() {
    setDraft(Object.fromEntries(COATING_DIAMETERS.map(d => [d, rateMap[d] ?? ''])))
    setEditing(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => coatingRatesApi.upsert(
      COATING_DIAMETERS
        .filter(d => draft[d] && Number(draft[d]) > 0)
        .map(d => ({ diameterMm: d, ratePerPipe: draft[d] }))
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coating-rates'] })
      setEditing(false)
      toast.success('Coating rates saved')
    },
    onError: () => toast.error('Failed to save coating rates'),
  })

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <IndianRupee size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900">Coating Rates</p>
          <p className="text-sm text-gray-500">₹ per pipe by diameter — used in Contractor Costs report</p>
        </div>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-gray-900 hover:bg-gray-100 transition-colors">
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>
      <div className="px-6 py-5">
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dia (mm)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate (₹/pipe)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {COATING_DIAMETERS.map(d => (
                  <tr key={d} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2 text-gray-700 font-medium tabular-nums">{d}</td>
                    <td className="px-4 py-2 text-right">
                      {editing ? (
                        <div className="flex justify-end">
                          <div className="relative inline-flex items-center">
                            <span className="absolute left-2.5 text-gray-400 text-xs">₹</span>
                            <input
                              type="number" min="0" step="1"
                              value={draft[d] ?? ''}
                              onChange={e => setDraft(prev => ({ ...prev, [d]: e.target.value }))}
                              className="w-28 pl-6 pr-3 py-1 text-right text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className={`font-semibold tabular-nums ${rateMap[d] && Number(rateMap[d]) > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                          {rateMap[d] && Number(rateMap[d]) > 0 ? `₹ ${Number(rateMap[d]).toLocaleString('en-IN')}` : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm disabled:opacity-60"
          >
            <Save size={14} /> Save Rates
          </button>
        </div>
      )}
    </div>
  )
}

// ── Spinning Rates ────────────────────────────────────────────────────────────

const SPIN_SMALL_DIAS  = [350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200]
const SPIN_LARGE_DIAS  = [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200]

function SpinningRates() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ['spinning-rates'],
    queryFn: () => spinningRatesApi.list(),
  })

  const rateKey = (bed: string, dia: number) => `${bed}_${dia}`
  const rateMap: Record<string, string> = Object.fromEntries(
    saved.map((r: SpinningBedRate) => [rateKey(r.bedSize, r.diameterMm), r.ratePerPipe])
  )

  function startEdit() {
    const d: Record<string, string> = {}
    SPIN_SMALL_DIAS.forEach(dia => { d[rateKey('SMALL_BED', dia)] = rateMap[rateKey('SMALL_BED', dia)] ?? '' })
    SPIN_LARGE_DIAS.forEach(dia => { d[rateKey('LARGE_BED', dia)] = rateMap[rateKey('LARGE_BED', dia)] ?? '' })
    setDraft(d)
    setEditing(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const rows: { bedSize: string; diameterMm: number; ratePerPipe: string }[] = []
      SPIN_SMALL_DIAS.forEach(d => {
        const k = rateKey('SMALL_BED', d)
        if (draft[k] && Number(draft[k]) > 0) rows.push({ bedSize: 'SMALL_BED', diameterMm: d, ratePerPipe: draft[k] })
      })
      SPIN_LARGE_DIAS.forEach(d => {
        const k = rateKey('LARGE_BED', d)
        if (draft[k] && Number(draft[k]) > 0) rows.push({ bedSize: 'LARGE_BED', diameterMm: d, ratePerPipe: draft[k] })
      })
      return spinningRatesApi.upsert(rows)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spinning-rates'] })
      setEditing(false)
      toast.success('Spinning rates saved')
    },
    onError: () => toast.error('Failed to save spinning rates'),
  })

  const beds = [
    { label: 'Small Bed',  key: 'SMALL_BED',  dias: SPIN_SMALL_DIAS },
    { label: 'Large Bed',  key: 'LARGE_BED',  dias: SPIN_LARGE_DIAS },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <IndianRupee size={18} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900">Spinning Rates</p>
          <p className="text-sm text-gray-500">₹ per pipe by diameter × bed size — used in Contractor Costs report</p>
        </div>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-gray-900 hover:bg-gray-100 transition-colors">
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>
      <div className="px-6 py-5">
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {beds.map(bed => (
              <div key={bed.key}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{bed.label}</p>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dia (mm)</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bed.dias.map(d => {
                        const k = rateKey(bed.key, d)
                        return (
                          <tr key={d} className="hover:bg-gray-50/60">
                            <td className="px-3 py-1.5 text-gray-700 font-medium tabular-nums">{d}</td>
                            <td className="px-3 py-1.5 text-right">
                              {editing ? (
                                <div className="relative inline-flex items-center">
                                  <span className="absolute left-2 text-gray-400 text-xs">₹</span>
                                  <input
                                    type="number" min="0" step="1"
                                    value={draft[k] ?? ''}
                                    onChange={e => setDraft(prev => ({ ...prev, [k]: e.target.value }))}
                                    className="w-24 pl-5 pr-2 py-1 text-right text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400"
                                  />
                                </div>
                              ) : (
                                <span className={`font-semibold tabular-nums ${rateMap[k] && Number(rateMap[k]) > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                  {rateMap[k] && Number(rateMap[k]) > 0 ? `₹ ${Number(rateMap[k]).toLocaleString('en-IN')}` : '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {editing && (
        <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-sm disabled:opacity-60"
          >
            <Save size={14} /> Save Rates
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function ContractorSettings() {
  return (
    <div className="space-y-10">
      <ContractorMasterList />
      <div className="border-t border-gray-100 pt-8">
        <ProcessAssignments />
      </div>
      <div className="border-t border-gray-100 pt-8 space-y-6">
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Contractor Rates</p>
        <CoatingRates />
        <SpinningRates />
      </div>
    </div>
  )
}
