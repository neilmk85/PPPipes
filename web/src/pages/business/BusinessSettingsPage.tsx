import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, SlidersHorizontal, Loader2, Save,
  Bed, Users, Clock, Hammer, BedDouble, Paintbrush, RotateCw, UserCheck, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { businessRateConfigApi, coatingRatesApi, spinningRatesApi, processContractorApi, type BusinessRateConfig } from '@/services/businessApi'
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
]

function fmt(val: string) {
  const n = parseFloat(val)
  if (!val || isNaN(n)) return '—'
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Coating Rates ────────────────────────────────────────────────────────────

const COATING_DIAMETERS = [350, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2400, 2600]

function CoatingRatesSection() {
  const qc = useQueryClient()
  const [rates, setRates] = useState<Record<number, string>>({})

  const { data: existing, isLoading } = useQuery({
    queryKey: ['coating-rates'],
    queryFn:  coatingRatesApi.list,
  })

  useEffect(() => {
    if (existing) {
      const map: Record<number, string> = {}
      existing.forEach(r => { map[r.diameterMm] = r.ratePerPipe })
      setRates(map)
    }
  }, [existing])

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = COATING_DIAMETERS
        .filter(d => rates[d] && parseFloat(rates[d]) > 0)
        .map(d => ({ diameterMm: d, ratePerPipe: rates[d] }))
      return coatingRatesApi.upsert(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coating-rates'] })
      toast.success('Coating rates saved')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save coating rates'),
  })

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors'

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden ring-1 ring-gray-100">
      <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Paintbrush size={15} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Coating Contractor Rates</h2>
            <p className="text-xs text-blue-100">Rate per pipe paid to the coating contractor by diameter</p>
          </div>
        </div>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || isLoading}
          className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-4 py-2 rounded-xl font-semibold text-sm transition disabled:opacity-60"
        >
          {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Rates
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading rates…</span>
        </div>
      ) : (
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {COATING_DIAMETERS.map(dia => (
            <div key={dia}>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{dia} mm</p>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rates[dia] ?? ''}
                  onChange={e => setRates(prev => ({ ...prev, [dia]: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder="0.00"
                  className={`${inputCls} pl-7`}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">per pipe</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Spinning Rates ───────────────────────────────────────────────────────────

const SPINNING_DIAMETERS_LARGE       = [500, 600, 700, 800, 900, 1000, 1100, 1200]
const SPINNING_DIAMETERS_SMALL       = [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1600, 1700]
const SPINNING_DIAMETERS_EXTRA_LARGE = [500, 600, 700, 800, 900, 1000, 1100, 1200]
const ALL_SPINNING_DIAMETERS         = [...new Set([...SPINNING_DIAMETERS_LARGE, ...SPINNING_DIAMETERS_SMALL, ...SPINNING_DIAMETERS_EXTRA_LARGE])].sort((a, b) => a - b)

function SpinningRatesSection() {
  const qc = useQueryClient()
  // rates[bedSize][diameterMm] = ratePerPipe string
  const [rates, setRates] = useState<Record<string, Record<number, string>>>({
    SMALL_BED: {}, LARGE_BED: {}, EXTRA_LARGE_BED: {},
  })

  const { data: existing, isLoading } = useQuery({
    queryKey: ['spinning-rates'],
    queryFn:  spinningRatesApi.list,
  })

  useEffect(() => {
    if (existing) {
      const map: Record<string, Record<number, string>> = { SMALL_BED: {}, LARGE_BED: {}, EXTRA_LARGE_BED: {} }
      existing.forEach(r => {
        if (!map[r.bedSize]) map[r.bedSize] = {}
        map[r.bedSize][r.diameterMm] = r.ratePerPipe
      })
      setRates(map)
    }
  }, [existing])

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: { bedSize: string; diameterMm: number; ratePerPipe: string }[] = []
      for (const bed of ['SMALL_BED', 'LARGE_BED', 'EXTRA_LARGE_BED']) {
        for (const dia of ALL_SPINNING_DIAMETERS) {
          const v = rates[bed]?.[dia]
          if (v && parseFloat(v) > 0) payload.push({ bedSize: bed, diameterMm: dia, ratePerPipe: v })
        }
      }
      return spinningRatesApi.upsert(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spinning-rates'] })
      toast.success('Spinning rates saved')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save spinning rates'),
  })

  function setRate(bed: string, dia: number, val: string) {
    setRates(prev => ({
      ...prev,
      [bed]: { ...prev[bed], [dia]: val.replace(/[^0-9.]/g, '') },
    }))
  }

  const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors'

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden ring-1 ring-gray-100">
      <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <RotateCw size={15} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Spinning Contractor Rates</h2>
            <p className="text-xs text-blue-100">Rate per pipe by diameter and bed size (Small / Large / Extra Large)</p>
          </div>
        </div>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || isLoading}
          className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-4 py-2 rounded-xl font-semibold text-sm transition disabled:opacity-60"
        >
          {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Rates
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading rates…</span>
        </div>
      ) : (
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase">
                <th className="py-2 pr-6 text-left font-semibold tracking-wide">Dia (mm)</th>
                <th className="py-2 px-3 text-center font-semibold tracking-wide text-blue-700 bg-blue-50 rounded-t-lg">
                  Large Bed (₹/pipe)
                </th>
                <th className="py-2 px-3 text-center font-semibold tracking-wide text-amber-700 bg-amber-50 rounded-t-lg">
                  Small Bed (₹/pipe)
                </th>
                <th className="py-2 px-3 text-center font-semibold tracking-wide text-green-700 bg-green-50 rounded-t-lg">
                  Extra Large Bed (₹/pipe)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ALL_SPINNING_DIAMETERS.map(dia => {
                const hasSmall      = SPINNING_DIAMETERS_SMALL.includes(dia)
                const hasLarge      = SPINNING_DIAMETERS_LARGE.includes(dia)
                const hasExtraLarge = SPINNING_DIAMETERS_EXTRA_LARGE.includes(dia)
                return (
                  <tr key={dia} className="hover:bg-gray-50/60">
                    <td className="py-2 pr-6 font-semibold text-gray-700">{dia} mm</td>
                    <td className="py-2 px-3 bg-blue-50/30">
                      {hasLarge ? (
                        <div className="relative">
                          <span className="absolute inset-y-0 left-2.5 flex items-center text-gray-400 text-xs pointer-events-none">₹</span>
                          <input
                            type="text" inputMode="decimal"
                            value={rates.LARGE_BED?.[dia] ?? ''}
                            onChange={e => setRate('LARGE_BED', dia, e.target.value)}
                            placeholder="0.00"
                            className={`${inputCls} pl-6`}
                          />
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs pl-2">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 bg-amber-50/30">
                      {hasSmall ? (
                        <div className="relative">
                          <span className="absolute inset-y-0 left-2.5 flex items-center text-gray-400 text-xs pointer-events-none">₹</span>
                          <input
                            type="text" inputMode="decimal"
                            value={rates.SMALL_BED?.[dia] ?? ''}
                            onChange={e => setRate('SMALL_BED', dia, e.target.value)}
                            placeholder="0.00"
                            className={`${inputCls} pl-6`}
                          />
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs pl-2">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 bg-green-50/30">
                      {hasExtraLarge ? (
                        <div className="relative">
                          <span className="absolute inset-y-0 left-2.5 flex items-center text-gray-400 text-xs pointer-events-none">₹</span>
                          <input
                            type="text" inputMode="decimal"
                            value={rates.EXTRA_LARGE_BED?.[dia] ?? ''}
                            onChange={e => setRate('EXTRA_LARGE_BED', dia, e.target.value)}
                            placeholder="0.00"
                            className={`${inputCls} pl-6`}
                          />
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs pl-2">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
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
    FABRICATION: null, SPINNING: null, COATING: null,
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (assignments.length) {
      const m: Record<string, number | null> = { FABRICATION: null, SPINNING: null, COATING: null }
      assignments.forEach((a: any) => { m[a.processType] = a.supplierId })
      setSelected(m)
    }
  }, [assignments])

  async function save(processType: string) {
    const id = selected[processType]
    if (!id) return
    setSaving(s => ({ ...s, [processType]: true }))
    try {
      await processContractorApi.upsert(processType, id)
      qc.invalidateQueries({ queryKey: ['process-contractors'] })
      toast.success(`${processType.charAt(0) + processType.slice(1).toLowerCase()} contractor saved`)
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to save')
    } finally {
      setSaving(s => ({ ...s, [processType]: false }))
    }
  }

  const isLoading = loadingAssign || loadingVendors

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden ring-1 ring-gray-100">
      <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <UserCheck size={15} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Process Contractors</h2>
          <p className="text-xs text-blue-100">Assign a vendor to each factory process for payment tracking</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          {PROCESSES.map(p => {
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
    smallBedRate:      '',
    largeBedRate:      '',
    labourRatePerDay:  '',
    otRatePerHour:     '',
    fabricationRateKg: '',
  }

  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (cfg) {
      setForm({
        smallBedRate:      cfg.smallBedRate      ?? '',
        largeBedRate:      cfg.largeBedRate      ?? '',
        labourRatePerDay:  cfg.labourRatePerDay  ?? '',
        otRatePerHour:     cfg.otRatePerHour     ?? '',
        fabricationRateKg: cfg.fabricationRateKg ?? '',
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

          {/* ── Coating Contractor Rates ────────────────────────────── */}
          <CoatingRatesSection />

          {/* ── Spinning Contractor Rates ───────────────────────────── */}
          <SpinningRatesSection />

          {/* ── Process Contractors ─────────────────────────────────── */}
          <ProcessContractorsSection />
        </>
      )}
    </div>
  )
}
