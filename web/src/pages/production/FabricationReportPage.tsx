import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ChevronDown, Hammer, Download, ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react'
import { subDays } from 'date-fns'
import { productionReportApi } from '@/services/api'
import { processContractorApi } from '@/services/businessApi'

// ── Date helpers ───────────────────────────────────────────────────────────────

function fmtD(d: Date) { return d.toISOString().split('T')[0] }

function startOf(unit: 'week' | 'month' | 'year') {
  const r = new Date()
  if (unit === 'week') r.setDate(r.getDate() - r.getDay())
  else if (unit === 'month') r.setDate(1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}
function startOfLastMonth() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); return d }
function endOfLastMonth()   { const d = new Date(); d.setDate(0); d.setHours(0,0,0,0); return d }

const PRESETS = [
  { label: 'Today',        from: () => fmtD(new Date()),              to: () => fmtD(new Date()) },
  { label: 'Yesterday',    from: () => fmtD(subDays(new Date(), 1)),  to: () => fmtD(subDays(new Date(), 1)) },
  { label: 'Last 7 Days',  from: () => fmtD(subDays(new Date(), 6)),  to: () => fmtD(new Date()) },
  { label: 'Last 15 Days', from: () => fmtD(subDays(new Date(), 14)), to: () => fmtD(new Date()) },
  { label: 'Last 30 Days', from: () => fmtD(subDays(new Date(), 29)), to: () => fmtD(new Date()) },
  { label: 'This Week',    from: () => fmtD(startOf('week')),         to: () => fmtD(new Date()) },
  { label: 'This Month',   from: () => fmtD(startOf('month')),        to: () => fmtD(new Date()) },
  { label: 'Last Month',   from: () => fmtD(startOfLastMonth()),      to: () => fmtD(endOfLastMonth()) },
  { label: 'This Year',    from: () => fmtD(startOf('year')),         to: () => fmtD(new Date()) },
]

function dmy(iso: string) {
  if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`
}

function DateFilter({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo,   setTmpTo]   = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const active = PRESETS.find(p => from === p.from() && to === p.to())
  const label  = active ? active.label : (from || to) ? `${dmy(from)} – ${dmy(to)}` : 'All dates'

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setTmpFrom(from); setTmpTo(to); setOpen(v => !v) }}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95">
        <Calendar size={15} />{label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-60">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Quick Range</p>
          <div className="space-y-0.5 mb-3">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => { onChange(p.from(), p.to()); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm rounded-xl font-medium transition-colors ${
                  from === p.from() && to === p.to() ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}>{p.label}</button>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Custom Range</p>
            <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700" />
            <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700" />
            <div className="flex gap-2">
              <button onClick={() => { onChange('',''); setOpen(false) }}
                className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Clear</button>
              <button onClick={() => { onChange(tmpFrom, tmpTo); setOpen(false) }} disabled={!tmpFrom || !tmpTo}
                className="flex-1 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmt(n: number | string | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function exportCSV(rows: any[], from: string, to: string, contractorName: string) {
  const header = ['PO Number', 'Pipe Config', 'Dia (mm)', 'Pipes Fabricated', 'Kg/Pipe', 'Rate (₹/kg)', 'Amount (₹)']
  const data = rows.map(r => [r.poNumber, r.pipeConfig, r.diameterMm, r.fabPipesCompleted, fmt(r.fabKgPerPipe), fmt(r.fabRateKg), fmt(r.fabCost)])
  const total = rows.reduce((s, r) => s + Number(r.fabCost), 0)
  data.push(['', '', '', '', '', 'TOTAL', fmt(total)])
  const csv = [header, ...data].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([`Fabrication Report\nContractor: ${contractorName}\nPeriod: ${from||'All'} to ${to||'All'}\n\n${csv}`], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `fabrication-report-${from||'all'}-to-${to||'all'}.csv`; a.click()
  URL.revokeObjectURL(a.href)
}

function FabDetailPage({ row, onClose }: { row: any; onClose: () => void }) {
  const pipes     = Number(row.fabPipesCompleted)
  const kgPerPipe = Number(row.fabKgPerPipe)
  const rateKg    = Number(row.fabRateKg)
  const totalKg   = pipes * kgPerPipe
  const totalCost = totalKg * rateKg
  const noRate    = rateKg === 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 px-8 pt-6 pb-6 shadow-[0_8px_40px_rgba(29,78,216,0.30)]">
        <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="relative">
          <button onClick={onClose} className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors mb-4">
            <ArrowLeft size={18} /> Back to Report
          </button>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Hammer size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Fabrication Detail</p>
              <h1 className="text-2xl font-extrabold text-white font-mono tracking-tight">{row.poNumber}</h1>
              <p className="text-sm text-blue-200 mt-0.5">{row.pipeConfig}</p>
            </div>
          </div>
          <div className="mt-5 flex items-stretch gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10">
            {[
              { label: 'Pipes Fabricated', value: pipes.toLocaleString() },
              { label: 'Steel / Pipe',     value: kgPerPipe > 0 ? `${fmt(kgPerPipe)} kg` : '—' },
              { label: 'Rate / kg',        value: noRate ? 'Not set' : `₹${fmt(rateKg)}` },
              { label: 'Total Cost',       value: noRate || kgPerPipe === 0 ? '—' : `₹${fmt(totalCost)}` },
            ].map((s, i) => (
              <div key={i} className="flex-1 px-5 py-3 bg-white/5">
                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-0.5">{s.label}</p>
                <p className="text-lg font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {noRate && (
        <div className="mx-6 mt-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">Fabrication rate not configured</p>
            <p className="text-xs text-amber-600 mt-0.5">Set the ₹/kg rate in Business Settings to see costs and amounts.</p>
          </div>
          <a href="/business/settings" className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            Set Rate <ExternalLink size={12} />
          </a>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Pipe Details</h2>
          <div className="space-y-1">
            {[
              { label: 'Pipe Config',      value: row.pipeConfig },
              { label: 'Diameter',         value: `${row.diameterMm} mm` },
              { label: 'Pressure Class',   value: row.pressureClass || '—' },
              { label: 'Pipes Fabricated', value: pipes.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-6">
          <h2 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4">Cost Breakdown</h2>
          <div className="space-y-1">
            {[
              { label: 'Pipes fabricated', value: `${pipes.toLocaleString()} pipes` },
              { label: '× Steel per pipe', value: kgPerPipe > 0 ? `${fmt(kgPerPipe)} kg` : '—' },
              { label: '= Total steel',    value: totalKg > 0 ? `${fmt(totalKg)} kg` : '—', bold: true },
              { label: '× Rate per kg',    value: noRate ? 'Not set' : `₹${fmt(rateKg)}` },
            ].map(({ label, value, bold }: any) => (
              <div key={label} className="flex justify-between items-center py-2.5 border-b border-blue-100 last:border-0">
                <span className="text-sm text-blue-600">{label}</span>
                <span className={`text-sm ${bold ? 'font-bold text-blue-800' : 'font-medium text-blue-700'}`}>{value}</span>
              </div>
            ))}
            <div className="pt-4 flex justify-between items-center">
              <span className="text-base font-bold text-blue-800">Total Amount</span>
              <span className="text-xl font-extrabold text-blue-700">
                {noRate || kgPerPipe === 0 ? '—' : `₹${fmt(totalCost)}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FabricationReportPage() {
  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')
  const [selected, setSelected] = useState<any>(null)

  const params = { fromDate: from || undefined, toDate: to || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['fab-report', from, to],
    queryFn: () => productionReportApi.contractorCosts(params).then(r => r.data.data as any[]),
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['process-contractors'],
    queryFn:  processContractorApi.list,
  })

  const contractor = (assignments as any[]).find((a: any) => a.processType === 'FABRICATION')
  const contractorName = contractor?.supplier?.name ?? 'Fabrication Contractor'

  const rows = (data ?? []).filter((r: any) => Number(r.fabPipesCompleted) > 0)
  const total = rows.reduce((s: number, r: any) => s + Number(r.fabCost), 0)
  const totalPipes = rows.reduce((s: number, r: any) => s + Number(r.fabPipesCompleted), 0)
  const rateNotSet = rows.length > 0 && rows.every((r: any) => Number(r.fabRateKg) === 0)
  const fabRate = rows.find((r: any) => Number(r.fabRateKg) > 0)?.fabRateKg

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 px-8 pt-7 pb-6 shadow-[0_8px_40px_rgba(29,78,216,0.30)]">
        <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
              <Hammer size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Production · Contractor Report</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Fabrication Report</h1>
              <p className="text-sm text-blue-200 mt-0.5">{contractorName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DateFilter from={from} to={to} onChange={(f,t) => { setFrom(f); setTo(t) }} />
            <button
              onClick={() => exportCSV(rows, from, to, contractorName)}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40">
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative mt-5 flex items-stretch gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10">
          {[
            { label: 'Total Amount', value: `₹${fmt(total)}` },
            { label: 'Pipes Fabricated', value: totalPipes.toLocaleString() },
            { label: 'Production Orders', value: rows.length.toString() },
            { label: 'Rate / kg', value: fabRate ? `₹${fmt(fabRate)}/kg` : 'Not set' },
          ].map((s, i) => (
            <div key={i} className="flex-1 px-5 py-3 bg-white/5">
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-0.5">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        {rateNotSet && (
          <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">Fabrication rate not configured</p>
              <p className="text-xs text-amber-600 mt-0.5">Set the ₹/kg rate in Business Settings to see costs and amounts.</p>
            </div>
            <a href="/business/settings" className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              Set Rate <ExternalLink size={12} />
            </a>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Fabrication Entries</h2>
            <span className="text-xs text-gray-400 font-medium">Click any row for details · Rate: ₹/kg of steel</span>
          </div>

          {isLoading ? (
            <div className="p-8 space-y-3">
              {Array.from({length:5}).map((_,i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Hammer size={36} className="mb-3 opacity-30" />
              <p className="font-semibold text-gray-500">No fabrication entries found</p>
              <p className="text-sm mt-1">Try a different date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 border-b border-blue-100">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-blue-700 uppercase tracking-widest">PO Number</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-blue-700 uppercase tracking-widest">Pipe Config</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-blue-700 uppercase tracking-widest">Dia (mm)</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-blue-700 uppercase tracking-widest">Pipes Fabricated</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-blue-700 uppercase tracking-widest">Kg / Pipe</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-blue-700 uppercase tracking-widest">Rate (₹/kg)</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-blue-700 uppercase tracking-widest">Amount ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r: any, i: number) => (
                    <tr key={i} onClick={() => setSelected(r)}
                      className="hover:bg-blue-50/60 transition-colors cursor-pointer group">
                      <td className="px-4 py-3 font-mono text-xs text-violet-700 font-bold group-hover:text-violet-900">{r.poNumber}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{r.pipeConfig}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.diameterMm}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{Number(r.fabPipesCompleted).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(r.fabKgPerPipe)}</td>
                      <td className="px-4 py-3 text-right">
                        {Number(r.fabRateKg) === 0
                          ? <span className="text-xs text-amber-500 font-medium">Not set</span>
                          : <span className="text-gray-500">₹{fmt(r.fabRateKg)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">
                        {Number(r.fabCost) === 0 ? <span className="text-gray-300">—</span> : `₹${fmt(r.fabCost)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t border-blue-100">
                    <td colSpan={6} className="px-4 py-3 text-right text-sm font-bold text-gray-700">Total Fabrication Cost</td>
                    <td className="px-4 py-3 text-right text-base font-extrabold text-blue-700">₹{fmt(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
      {selected && <FabDetailPage row={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
