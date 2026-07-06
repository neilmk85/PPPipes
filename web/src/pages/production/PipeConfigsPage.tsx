import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit, ToggleLeft, ToggleRight, Settings, Pipette } from 'lucide-react'
import toast from 'react-hot-toast'
import { pipeConfigApi } from '@/services/api'
import { PipeConfig, PIPE_DIAMETERS, PRESSURE_CLASSES } from '@/types'

export default function PipeConfigsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterDiam, setFilterDiam] = useState('')
  const [filterPc, setFilterPc] = useState('')
  const [filterLen, setFilterLen] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['pipe-configs', filterDiam, filterPc],
    queryFn: () => pipeConfigApi.getAll({
      diameterMm: filterDiam ? Number(filterDiam) : undefined,
      pressureClass: filterPc || undefined,
      size: 200,
    }).then(r => r.data.data),
  })

  const toggleMut = useMutation({
    mutationFn: (id: number) => pipeConfigApi.toggleActive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipe-configs'] })
      toast.success('Updated')
    },
  })

  const configs: PipeConfig[] = data?.content ?? []
  const filtered = configs.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterLen && String(c.lengthM ?? 5.25) !== filterLen) return false
    return true
  })

  const group525 = filtered.filter(c => (c.lengthM ?? 5.25) === 5.25)
  const group65  = filtered.filter(c => (c.lengthM ?? 5.25) === 6.5)

  const activeCount   = configs.filter(c => c.active).length
  const inactiveCount = configs.length - activeCount

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        <div className="pointer-events-none absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <Settings size={26} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Production</p>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Pipe Configurations</h1>
                <div className="flex items-center gap-3">
                  <span className="text-white text-sm font-bold tabular-nums">{configs.length} total</span>
                  <span className="w-px h-3.5 bg-white/30" />
                  <span className="text-green-200 text-sm font-bold tabular-nums">{activeCount} active</span>
                  {inactiveCount > 0 && (
                    <>
                      <span className="w-px h-3.5 bg-white/30" />
                      <span className="text-amber-200 text-sm font-bold tabular-nums">{inactiveCount} inactive</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-blue-200 mt-0.5">Manage PCCP pipe types and raw material formulas</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/production/pipe-configs/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 border border-white/25 text-white text-sm font-semibold rounded-xl backdrop-blur-sm hover:bg-white/25 transition-all"
          >
            <Plus size={16} /> New Pipe Config
          </button>
        </div>

        {/* Search & Filters */}
        <div className="relative border-t border-white/10 px-8 py-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="pl-9 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all w-52"
            />
          </div>
          <select
            value={filterDiam}
            onChange={e => setFilterDiam(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 transition-all [&>option]:text-gray-900"
          >
            <option value="">All Diameters</option>
            {PIPE_DIAMETERS.map(d => <option key={d} value={d}>{d}mm</option>)}
          </select>
          <select
            value={filterPc}
            onChange={e => setFilterPc(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 transition-all [&>option]:text-gray-900"
          >
            <option value="">All Pressure Classes</option>
            {PRESSURE_CLASSES.map(pc => <option key={pc} value={pc}>{pc}</option>)}
          </select>
          <select
            value={filterLen}
            onChange={e => setFilterLen(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/30 transition-all [&>option]:text-gray-900"
          >
            <option value="">All Lengths</option>
            <option value="5.25">5.25m</option>
            <option value="6.5">6.5m</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Settings size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pipe configurations found</p>
          <p className="text-sm mt-1">Click "New Pipe Config" to add one</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { label: '5.25m Pipes', sublabel: 'Standard length', color: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-500', items: group525 },
            { label: '6.5m Pipes',  sublabel: 'Extended length', color: 'bg-violet-50 border-violet-200 text-violet-800', dot: 'bg-violet-500', items: group65 },
          ].map(group => {
            if (filterLen && group.items.length === 0) return null
            if (group.items.length === 0) return null
            return (
              <div key={group.label}>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold mb-4 ${group.color}`}>
                  <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                  {group.label}
                  <span className="text-xs font-normal opacity-70">— {group.sublabel} · {group.items.length} configs</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.items.map(cfg => (
                    <div
                      key={cfg.id}
                      className={`bg-white rounded-xl border p-4 space-y-2 ${!cfg.active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{cfg.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {cfg.diameterMm}mm · {cfg.pressureClass}
                          </p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {cfg.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {cfg.materials?.length ?? 0} materials configured
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => navigate(`/production/pipe-configs/${cfg.id}/edit`)}
                          className="flex-1 flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-violet-50/40"
                        >
                          <Edit size={12} />
                          Edit
                        </button>
                        <button
                          onClick={() => toggleMut.mutate(cfg.id)}
                          className="flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-violet-50/40"
                          title={cfg.active ? 'Deactivate' : 'Activate'}
                        >
                          {cfg.active ? <ToggleRight size={14} className="text-green-600" /> : <ToggleLeft size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">{filtered.length} configurations</p>
    </div>
  )
}
