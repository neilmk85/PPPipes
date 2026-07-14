import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, SlidersHorizontal, Loader2, Save,
  Bed, Users, Clock, Hammer, BedDouble, Paintbrush, UserCheck, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { businessRateConfigApi, processContractorApi, type BusinessRateConfig } from '@/services/businessApi'
import { vendorApi } from '@/services/api'

// ─── Field config ─────────────────────────────────────────────────────────────

const RATE_FIELDS: {
  key:         keyof Omit<BusinessRateConfig, 'id' | 'createdAt' | 'updatedAt'>
  label:       string
  unit:        string
  description: string
  icon:        React.ReactNode
  color:       string
  iconColor:   string
}[] = [
  {
    key:         'smallBedRate',
    label:       'Small Bed Rate',
    unit:        '₹ / pipe',
    description: 'Rate charged per pipe produced on the small bed',
    icon:        <Bed size={20} />,
    color:       'bg-violet-100',
    iconColor:   'text-violet-600',
  },
  {
    key:         'largeBedRate',
    label:       'Large Bed Rate',
    unit:        '₹ / pipe',
    description: 'Rate charged per pipe produced on the large bed',
    icon:        <BedDouble size={20} />,
    color:       'bg-blue-100',
    iconColor:   'text-blue-600',
  },
  {
    key:         'labourRatePerDay',
    label:       'Labour Rate',
    unit:        '₹ / labour / day',
    description: 'Default daily wage rate per labour',
    icon:        <Users size={20} />,
    color:       'bg-emerald-100',
    iconColor:   'text-emerald-600',
  },
  {
    key:         'otRatePerHour',
    label:       'OT Rate',
    unit:        '₹ / labour / hour',
    description: 'Overtime rate per labour per hour worked beyond regular shift',
    icon:        <Clock size={20} />,
    color:       'bg-amber-100',
    iconColor:   'text-amber-600',
  },
  {
    key:         'fabricationRateKg',
    label:       'Fabrication Rate',
    unit:        '₹ / kg',
    description: 'Rate applied per kilogram of material for fabrication work',
    icon:        <Hammer size={20} />,
    color:       'bg-rose-100',
    iconColor:   'text-rose-600',
  },
  {
    key:         'spinningSmallBedRate',
    label:       'Spinning Small Bed',
    unit:        '₹ / pipe',
    description: 'Rate per pipe paid to the spinning contractor for small bed',
    icon:        <Bed size={20} />,
    color:       'bg-violet-100',
    iconColor:   'text-violet-600',
  },
  {
    key:         'spinningLargeBedRate',
    label:       'Spinning Large Bed',
    unit:        '₹ / pipe',
    description: 'Rate per pipe paid to the spinning contractor for large bed',
    icon:        <BedDouble size={20} />,
    color:       'bg-purple-100',
    iconColor:   'text-purple-600',
  },
  {
    key:         'spinningExtraLargeBedRate',
    label:       'Spinning Extra Large Bed',
    unit:        '₹ / pipe',
    description: 'Rate per pipe paid to the spinning contractor for extra large bed',
    icon:        <BedDouble size={20} />,
    color:       'bg-indigo-100',
    iconColor:   'text-indigo-600',
  },
  {
    key:         'coatingRate',
    label:       'Coating Rate',
    unit:        '₹ / pipe',
    description: 'Flat rate per pipe paid to the coating contractor',
    icon:        <Paintbrush size={20} />,
    color:       'bg-cyan-100',
    iconColor:   'text-cyan-600',
  },
]

function fmt(val: string) {
  const n = parseFloat(val)
  if (!val || isNaN(n)) return '—'
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Process Contractor Assignments ──────────────────────────────────────────

const PROCESSES: { type: 'FABRICATION' | 'SPINNING' | 'COATING'; label: string; color: string; dotColor: string }[] = [
  { type: 'FABRICATION', label: 'Fabrication', color: 'bg-amber-50 border-amber-200',  dotColor: 'bg-amber-500' },
  { type: 'SPINNING',    label: 'Spinning',    color: 'bg-violet-50 border-violet-200', dotColor: 'bg-violet-500' },
  { type: 'COATING',     label: 'Coating',     color: 'bg-blue-50 border-blue-200',    dotColor: 'bg-blue-500' },
]

function ProcessContractorsSection() {
  const qc = useQueryClient()

  const { data: assignments = [], isLoading: loadingAssign } = useQuery({
    queryKey: ['process-contractors'],
    queryFn:  processContractorApi.list,
  })

  const { data: vendorRes, isLoading: loadingVendors } = useQuery({
    queryKey: ['vendors-active'],
    queryFn:  () => vendorApi.getAll({ active: true, size: 200 }).then(r => r.data.data?.content ?? []),
  })
  const vendors: any[] = vendorRes ?? []

  const [selected, setSelected] = useState<Record<string, number | null>>({
    FABRICATION: null, COATING: null,
  })
  const [spinningAdd, setSpinningAdd] = useState<number | null>(null)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [removing, setRemoving] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (assignments.length) {
      const m: Record<string, number | null> = { FABRICATION: null, COATING: null }
      assignments.forEach((a: any) => {
        if (a.processType !== 'SPINNING') m[a.processType] = a.supplierId
      })
      setSelected(m)
    }
  }, [assignments])

  async function save(processType: string) {
    const id = processType === 'SPINNING' ? spinningAdd : selected[processType]
    if (!id) return
    setSaving(s => ({ ...s, [processType]: true }))
    try {
      await processContractorApi.upsert(processType, id)
      qc.invalidateQueries({ queryKey: ['process-contractors'] })
      toast.success(`${processType.charAt(0) + processType.slice(1).toLowerCase()} contractor saved`)
      if (processType === 'SPINNING') setSpinningAdd(null)
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to save')
    } finally {
      setSaving(s => ({ ...s, [processType]: false }))
    }
  }

  async function removeContractor(id: number) {
    setRemoving(r => ({ ...r, [id]: true }))
    try {
      await processContractorApi.remove(id)
      qc.invalidateQueries({ queryKey: ['process-contractors'] })
      toast.success('Contractor removed')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to remove')
    } finally {
      setRemoving(r => ({ ...r, [id]: false }))
    }
  }

  const isLoading = loadingAssign || loadingVendors
  const spinningAssignments: any[] = assignments.filter((a: any) => a.processType === 'SPINNING')
  const assignedSpinningIds = new Set(spinningAssignments.map((a: any) => a.supplierId))

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden ring-1 ring-gray-100">
      <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <UserCheck size={15} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Process Contractors</h2>
          <p className="text-xs text-blue-100">Assign vendors to factory processes for payment tracking</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          {/* FABRICATION & COATING — single contractor */}
          {PROCESSES.filter(p => p.type !== 'SPINNING').map(p => {
            const current = assignments.find((a: any) => a.processType === p.type)
            const currentName = current?.supplier?.name ?? null
            return (
              <div key={p.type} className={`rounded-xl border p-4 ${p.color}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${p.dotColor}`} />
                  <p className="text-sm font-bold text-gray-700">{p.label}</p>
                  {currentName && (
                    <span className="ml-auto text-xs text-gray-500 font-medium">Current: <span className="font-bold text-gray-700">{currentName}</span></span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select
                      value={selected[p.type] ?? ''}
                      onChange={e => setSelected(s => ({ ...s, [p.type]: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors text-gray-700"
                    >
                      <option value="">— Select contractor —</option>
                      {vendors.map((v: any) => (
                        <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ''}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  <button
                    onClick={() => save(p.type)}
                    disabled={!selected[p.type] || saving[p.type]}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all whitespace-nowrap"
                  >
                    {saving[p.type] ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Assign
                  </button>
                </div>
              </div>
            )
          })}

          {/* SPINNING — multiple contractors */}
          <div className="rounded-xl border p-4 bg-violet-50 border-violet-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <p className="text-sm font-bold text-gray-700">Spinning</p>
              <span className="ml-auto text-xs text-gray-400">{spinningAssignments.length} contractor{spinningAssignments.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Existing spinning contractors as chips */}
            {spinningAssignments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {spinningAssignments.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-1.5 bg-white border border-violet-200 rounded-lg px-3 py-1.5">
                    <span className="text-sm font-medium text-gray-700">{a.supplier?.name ?? `Vendor #${a.supplierId}`}</span>
                    <button
                      onClick={() => removeContractor(a.id)}
                      disabled={removing[a.id]}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-1 disabled:opacity-40"
                    >
                      {removing[a.id] ? <Loader2 size={11} className="animate-spin" /> : <span className="text-xs leading-none">✕</span>}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new spinning contractor */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={spinningAdd ?? ''}
                  onChange={e => setSpinningAdd(e.target.value ? Number(e.target.value) : null)}
                  className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors text-gray-700"
                >
                  <option value="">— Add contractor —</option>
                  {vendors
                    .filter((v: any) => !assignedSpinningIds.has(v.id))
                    .map((v: any) => (
                      <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ''}</option>
                    ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <button
                onClick={() => save('SPINNING')}
                disabled={!spinningAdd || saving['SPINNING']}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all whitespace-nowrap"
              >
                {saving['SPINNING'] ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Add
              </button>
            </div>
          </div>

          {vendors.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              No vendors found. Add vendors in the Vendors section first.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessSettingsPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { data: cfg, isLoading } = useQuery({
    queryKey: ['business-rate-config'],
    queryFn:  businessRateConfigApi.get,
  })

  const emptyForm = {
    smallBedRate:              '',
    largeBedRate:              '',
    labourRatePerDay:          '',
    otRatePerHour:             '',
    fabricationRateKg:         '',
    spinningSmallBedRate:      '',
    spinningLargeBedRate:      '',
    spinningExtraLargeBedRate: '',
    coatingRate:               '',
  }

  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (cfg) {
      setForm({
        smallBedRate:              cfg.smallBedRate              ?? '',
        largeBedRate:              cfg.largeBedRate              ?? '',
        labourRatePerDay:          cfg.labourRatePerDay          ?? '',
        otRatePerHour:             cfg.otRatePerHour             ?? '',
        fabricationRateKg:         cfg.fabricationRateKg         ?? '',
        spinningSmallBedRate:      cfg.spinningSmallBedRate      ?? '',
        spinningLargeBedRate:      cfg.spinningLargeBedRate      ?? '',
        spinningExtraLargeBedRate: cfg.spinningExtraLargeBedRate ?? '',
        coatingRate:               cfg.coatingRate               ?? '',
      })
    }
  }, [cfg])

  const saveMut = useMutation({
    mutationFn: businessRateConfigApi.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-rate-config'] })
      toast.success('Rate settings saved')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save settings'),
  })

  function setField(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v.replace(/[^0-9.]/g, '') }))
  }

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors'

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-5">

      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 shadow-[0_8px_32px_rgba(109,40,217,0.25)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/business')}
              className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 flex items-center justify-center transition"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
              <SlidersHorizontal size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-200 uppercase tracking-widest mb-0.5">Business</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Rate Settings</h1>
              <p className="text-sm text-violet-200 mt-0.5">Configure default rates used across business modules</p>
            </div>
          </div>
          <button
            onClick={() => saveMut.mutate(form)}
            disabled={saveMut.isPending}
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition backdrop-blur-sm disabled:opacity-60"
          >
            {saveMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Settings
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm">Loading settings…</span>
        </div>
      ) : (
        <>
          {/* ── Current saved rates ─────────────────────────────────── */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Current Rates</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {RATE_FIELDS.map(f => (
                <div
                  key={f.key}
                  className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex flex-col gap-2"
                >
                  <div className={`w-9 h-9 rounded-xl ${f.color} flex items-center justify-center ${f.iconColor}`}>
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest leading-none">{f.label}</p>
                    <p className="text-lg font-extrabold text-gray-800 tabular-nums mt-1 leading-none">
                      {fmt(cfg?.[f.key] ?? '')}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{f.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Edit form ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden ring-1 ring-gray-100">

            {/* Form header */}
            <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <SlidersHorizontal size={15} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-white">Edit Rates</h2>
            </div>

            {/* Fields */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {RATE_FIELDS.map(f => (
                <div key={f.key}>
                  {/* Label row */}
                  <div className="mb-2">
                    <p className="text-[11px] font-bold text-gray-700 uppercase tracking-widest leading-none">{f.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{f.unit}</p>
                  </div>
                  {/* Input */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center text-gray-400 text-sm pointer-events-none">₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form[f.key]}
                      onChange={e => setField(f.key, e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">{f.description}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => navigate('/business')}
                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMut.mutate(form)}
                disabled={saveMut.isPending}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 shadow-sm hover:shadow-md disabled:opacity-60 transition-all"
              >
                {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Settings
              </button>
            </div>
          </div>

          {/* ── Process Contractors ─────────────────────────────────── */}
          <ProcessContractorsSection />
        </>
      )}
    </div>
  )
}
