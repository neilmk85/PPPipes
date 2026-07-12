import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Trash2, RefreshCw,
  Cylinder, TrendingDown, Scale, PackagePlus,
  RotateCw, Paintbrush, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { siloFillsApi, type SiloFill, type SiloStat } from '@/services/businessApi'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtMT(val: number, decimals = 3): string {
  if (!val && val !== 0) return '—'
  return `${val.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} MT`
}

function fmtKg(mt: number): string {
  if (!mt && mt !== 0) return '—'
  const kg = mt * 1000
  return `${kg.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg`
}

function pct(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0
  return Math.min(100, Math.max(0, (part / whole) * 100))
}

// ── Silo stat card ────────────────────────────────────────────────────────────

interface SiloCardProps {
  stat: SiloStat
  accent: { from: string; to: string; ring: string; bar: string; badge: string }
  stageLabel: string
  StageIcon: React.ElementType
}

function SiloCard({ stat, accent, stageLabel, StageIcon }: SiloCardProps) {
  const filled   = stat.totalFilledMt
  const consumed = stat.consumedMt
  const balance  = stat.balanceMt
  const usedPct  = pct(consumed, filled)
  const isShort  = balance < 0

  return (
    <div className={`bg-white rounded-2xl ring-1 ${accent.ring} shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden`}>
      {/* Header */}
      <div className={`relative overflow-hidden px-5 py-4 bg-gradient-to-br ${accent.from} ${accent.to}`}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="relative flex items-center justify-between gap-2">
          {/* Left: icon + stage */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
              <Cylinder size={16} className="text-white" />
            </div>
            <div className={`inline-flex items-center gap-1 text-[9px] font-semibold ${accent.badge} px-1.5 py-0.5 rounded-full whitespace-nowrap`}>
              <StageIcon size={8} />
              {stageLabel.replace(/ \(Silo \d\)/, '')}
            </div>
          </div>
          {/* Centre: S1 / S2 / S3 */}
          <div className="flex-1 flex justify-center">
            <p className="text-4xl font-black text-white/90 tracking-tight leading-none">
              S{stat.siloNumber}
            </p>
          </div>
          {/* Right: total filled + alert */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="text-right">
              <p className="text-[9px] font-semibold text-white/60 uppercase tracking-widest leading-none mb-0.5">Total</p>
              <p className="text-sm font-extrabold text-white tabular-nums leading-tight">{fmtMT(filled, 1)}</p>
            </div>
            {isShort
              ? <AlertTriangle size={14} className="text-white/80 animate-pulse" />
              : <CheckCircle2 size={14} className="text-white/60" />
            }
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        <div className="px-4 py-3 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Filled</p>
          <p className="text-sm font-extrabold text-gray-800 tabular-nums">{fmtMT(filled)}</p>
          <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">{fmtKg(filled)}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Consumed</p>
          <p className="text-sm font-extrabold text-orange-600 tabular-nums">{fmtMT(consumed)}</p>
          <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">{fmtKg(consumed)}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Balance</p>
          <p className={`text-sm font-extrabold tabular-nums ${isShort ? 'text-red-600' : 'text-emerald-600'}`}>
            {isShort ? '−' : ''}{fmtMT(Math.abs(balance))}
          </p>
          <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">{isShort ? '−' : ''}{fmtKg(Math.abs(balance))}</p>
        </div>
      </div>

      {/* Usage progress bar */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Used</span>
          <span className={`text-[11px] font-bold tabular-nums ${isShort ? 'text-red-500' : 'text-gray-600'}`}>
            {isShort ? '>100' : usedPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isShort ? 'bg-red-400' : accent.bar}`}
            style={{ width: `${Math.min(100, usedPct)}%` }}
          />
        </div>
        {isShort && (
          <p className="text-[10px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
            <AlertTriangle size={10} /> Fill required — {fmtMT(Math.abs(balance))} short
          </p>
        )}
      </div>
    </div>
  )
}

// ── Fill form ─────────────────────────────────────────────────────────────────

function FillForm({ onSaved }: { onSaved: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [siloNumber, setSiloNumber] = useState<number>(1)
  const [quantityMt, setQuantityMt] = useState('')
  const [date, setDate]             = useState(today)
  const [notes, setNotes]           = useState('')

  const mut = useMutation({
    mutationFn: () => siloFillsApi.create({ siloNumber, quantityMt: parseFloat(quantityMt), date, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['silo-fills'] })
      qc.invalidateQueries({ queryKey: ['silo-summary'] })
      toast.success(`Silo ${siloNumber} fill of ${quantityMt} MT recorded`)
      setQuantityMt('')
      setNotes('')
      onSaved()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save'),
  })

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 transition'
  const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'

  const siloMeta = [
    { n: 1, label: 'Silo 1', stage: 'Spinning', active: 'bg-blue-600 text-white border-blue-600' },
    { n: 2, label: 'Silo 2', stage: 'Spinning', active: 'bg-indigo-600 text-white border-indigo-600' },
    { n: 3, label: 'Silo 3', stage: 'Coating',  active: 'bg-violet-600 text-white border-violet-600' },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100 overflow-hidden">
      {/* Header */}
      <div className="relative overflow-hidden flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-teal-400 to-emerald-300">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="relative w-8 h-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
          <PackagePlus size={16} className="text-white" />
        </div>
        <div className="relative">
          <p className="text-sm font-bold text-white">Record Cement Fill</p>
          <p className="text-xs text-teal-100 mt-0.5">Enter how much cement was loaded into a silo (MT)</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Silo selector */}
        <div>
          <label className={labelCls}>Select Silo *</label>
          <div className="grid grid-cols-3 gap-3">
            {siloMeta.map(s => (
              <button
                key={s.n}
                type="button"
                onClick={() => setSiloNumber(s.n)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 transition-all font-semibold text-sm ${
                  siloNumber === s.n ? s.active : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                }`}
              >
                <Cylinder size={18} />
                <span>{s.label}</span>
                <span className={`text-[10px] font-normal ${siloNumber === s.n ? 'text-white/80' : 'text-gray-400'}`}>
                  {s.stage}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity + Date row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Quantity (MT) *</label>
            <div className="relative">
              <input
                type="number" min="0.001" step="0.001"
                value={quantityMt}
                onChange={e => setQuantityMt(e.target.value)}
                placeholder="e.g. 10.5"
                className={`${inputCls} pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">MT</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Supplier, truck number, bill ref…"
            className={inputCls}
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          disabled={!quantityMt || parseFloat(quantityMt) <= 0 || mut.isPending}
          onClick={() => mut.mutate()}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold shadow-md shadow-teal-200 transition-all"
        >
          <PackagePlus size={15} />
          {mut.isPending ? 'Saving…' : `Record Fill — Silo ${siloNumber}`}
        </button>
      </div>
    </div>
  )
}

// ── Fill history table ────────────────────────────────────────────────────────

const SILO_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700 border-blue-200',
  2: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  3: 'bg-violet-100 text-violet-700 border-violet-200',
}
const SILO_STAGE: Record<number, string> = { 1: 'Spinning', 2: 'Spinning', 3: 'Coating' }

function FillHistoryTable({ fills, onDelete }: { fills: SiloFill[]; onDelete: (id: number) => void }) {
  if (fills.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-gray-400">
        No fill records yet. Record the first cement fill using the form.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100">
            <th className="text-left px-4 py-3 text-[10px] font-bold text-teal-600 uppercase tracking-widest">Date</th>
            <th className="text-center px-4 py-3 text-[10px] font-bold text-teal-600 uppercase tracking-widest">Silo</th>
            <th className="text-center px-4 py-3 text-[10px] font-bold text-teal-600 uppercase tracking-widest">Stage</th>
            <th className="text-right px-4 py-3 text-[10px] font-bold text-teal-600 uppercase tracking-widest">Qty (MT)</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold text-teal-600 uppercase tracking-widest">Notes</th>
            <th className="px-4 py-3 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {fills.map((f, idx) => (
            <tr key={f.id}
              className={`border-t border-gray-50 hover:bg-gray-50/60 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
              <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                {new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${SILO_COLORS[f.siloNumber] ?? ''}`}>
                  <Cylinder size={9} />
                  Silo {f.siloNumber}
                </span>
              </td>
              <td className="px-4 py-2.5 text-center text-gray-500 font-medium">{SILO_STAGE[f.siloNumber] ?? '—'}</td>
              <td className="px-4 py-2.5 text-right font-extrabold text-emerald-700 tabular-nums">
                {parseFloat(f.quantityMt).toLocaleString('en-IN', { minimumFractionDigits: 3 })}
                <span className="text-[10px] font-semibold text-emerald-400 ml-0.5">MT</span>
              </td>
              <td className="px-4 py-2.5 text-gray-400 max-w-[180px] truncate">{f.notes || '—'}</td>
              <td className="px-4 py-2.5">
                <button
                  onClick={() => onDelete(f.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest" colSpan={3}>Total Filled</td>
            <td className="px-4 py-2.5 text-right font-extrabold text-emerald-700 tabular-nums text-sm">
              {fills.reduce((s, f) => s + parseFloat(f.quantityMt), 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 3 })}
              <span className="text-xs font-semibold text-emerald-400 ml-0.5">MT</span>
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SiloPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['silo-summary'],
    queryFn:  () => siloFillsApi.summary(),
    refetchInterval: 60_000,
  })

  const { data: fills = [], isLoading: fillsLoading } = useQuery({
    queryKey: ['silo-fills'],
    queryFn:  () => siloFillsApi.list(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => siloFillsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['silo-fills'] })
      qc.invalidateQueries({ queryKey: ['silo-summary'] })
      toast.success('Fill record deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  function handleDelete(id: number) {
    if (!confirm('Delete this fill record? This will affect the balance.')) return
    deleteMut.mutate(id)
  }

  const siloAccents = [
    { from: 'from-blue-400',   to: 'to-cyan-300',   ring: 'ring-blue-100',   bar: 'bg-blue-300',   badge: 'bg-blue-400/30 text-blue-50'   },
    { from: 'from-indigo-400', to: 'to-blue-300',   ring: 'ring-indigo-100', bar: 'bg-indigo-300', badge: 'bg-indigo-400/30 text-indigo-50' },
    { from: 'from-violet-400', to: 'to-purple-300', ring: 'ring-violet-100', bar: 'bg-violet-300', badge: 'bg-violet-400/30 text-violet-50' },
  ]
  const stageIcons  = [RotateCw, RotateCw, Paintbrush]
  const stageLabels = ['Spinning (Silo 1)', 'Spinning (Silo 2)', 'Coating (Silo 3)']

  const totalFilled   = summary?.silos.reduce((s, x) => s + x.totalFilledMt, 0) ?? 0
  const totalConsumed = (summary?.spinningConsumedMt ?? 0) + (summary?.coatingConsumedMt ?? 0)
  const netBalance    = summary?.silos.reduce((s, x) => s + x.balanceMt, 0) ?? 0
  const anyShort      = summary?.silos.some(s => s.balanceMt < 0) ?? false

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative px-6 pt-6 pb-5">
          <button onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-teal-200 hover:text-white text-xs font-semibold mb-4 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center flex-shrink-0">
                <Cylinder size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight">Cement Silos</h1>
                <p className="text-sm text-teal-200 mt-0.5">
                  Silo 1 &amp; 2 → Spinning &nbsp;·&nbsp; Silo 3 → Coating &nbsp;·&nbsp; Auto-computed from production
                </p>
              </div>
            </div>
            <button
              onClick={() => { qc.invalidateQueries({ queryKey: ['silo-summary'] }); qc.invalidateQueries({ queryKey: ['silo-fills'] }) }}
              className="flex-shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {/* Summary strip */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Total Filled',   value: fmtMT(totalFilled),   icon: PackagePlus,  color: 'text-emerald-200' },
              { label: 'Total Consumed', value: fmtMT(totalConsumed), icon: TrendingDown, color: 'text-orange-200'  },
              { label: 'Net Balance',    value: fmtMT(netBalance),    icon: Scale,        color: anyShort ? 'text-red-300' : 'text-teal-200' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <stat.icon size={11} className={stat.color} />
                  <span className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">{stat.label}</span>
                </div>
                <p className={`text-sm font-extrabold tabular-nums ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">

        {/* ── Silo status cards — all 3 in one row ── */}
        {summaryLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl ring-1 ring-gray-100 h-48 animate-pulse" />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-3 gap-4">
            {summary.silos.map((s, i) => (
              <SiloCard key={s.siloNumber} stat={s} accent={siloAccents[i]} stageLabel={stageLabels[i]} StageIcon={stageIcons[i]} />
            ))}
          </div>
        ) : null}

        {/* ── Form + History ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <FillForm onSaved={() => {}} />
          </div>
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100">
                <div className="flex items-center gap-2">
                  <Cylinder size={14} className="text-teal-600" />
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Fill History</span>
                </div>
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {fills.length} record{fills.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="p-4">
                {fillsLoading
                  ? <div className="text-center py-8 text-sm text-gray-400 animate-pulse">Loading…</div>
                  : <FillHistoryTable fills={fills} onDelete={handleDelete} />
                }
              </div>
            </div>
          </div>
        </div>

        {/* ── Production consumption breakdown ── */}
        {summary && (
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <TrendingDown size={14} className="text-orange-600" />
              <span className="text-[10px] font-bold text-orange-700 uppercase tracking-widest">Cement Consumption from Production</span>
              <span className="ml-auto text-[10px] text-gray-400">Auto-computed · updates with every production entry</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              {[
                {
                  label:    'Spinning — Silos 1 & 2',
                  consumed: summary.spinningConsumedMt,
                  Icon:     RotateCw,
                  color:    'text-blue-600',
                  bg:       'bg-blue-50',
                  note:     'Total cement consumed across all Spinning production entries',
                },
                {
                  label:    'Coating — Silo 3',
                  consumed: summary.coatingConsumedMt,
                  Icon:     Paintbrush,
                  color:    'text-violet-600',
                  bg:       'bg-violet-50',
                  note:     'Total cement consumed across all Coating production entries',
                },
              ].map(item => (
                <div key={item.label} className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center`}>
                      <item.Icon size={13} className={item.color} />
                    </div>
                    <p className="text-xs font-bold text-gray-700">{item.label}</p>
                  </div>
                  <p className="text-2xl font-extrabold text-orange-600 tabular-nums">{fmtMT(item.consumed)}</p>
                  <p className="text-[10px] text-gray-400 mt-1.5">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
