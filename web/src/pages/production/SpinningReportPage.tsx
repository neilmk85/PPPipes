import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ChevronDown, Download, RotateCw } from 'lucide-react'
import { subDays } from 'date-fns'
import { productionReportApi } from '@/services/api'
import { processContractorApi } from '@/services/businessApi'

function fmtD(d: Date) { return d.toISOString().split('T')[0] }
function startOf(unit: 'week' | 'month' | 'year') {
  const r = new Date()
  if (unit === 'week') r.setDate(r.getDate() - r.getDay())
  else if (unit === 'month') r.setDate(1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0); return r
}
function startOfLastMonth() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); d.setHours(0,0,0,0); return d }
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

const BED_LABEL: Record<string, string> = { SMALL_BED: 'Small Bed', LARGE_BED: 'Large Bed', EXTRA_LARGE_BED: 'Extra Large Bed', UNKNOWN: 'Unknown' }

function dmy(iso: string) { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }

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
                  from === p.from() && to === p.to() ? 'bg-violet-50 text-violet-700' : 'text-gray-700 hover:bg-gray-50'
                }`}>{p.label}</button>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Custom Range</p>
            <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700" />
            <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700" />
            <div className="flex gap-2">
              <button onClick={() => { onChange('',''); setOpen(false) }}
                className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Clear</button>
              <button onClick={() => { onChange(tmpFrom, tmpTo); setOpen(false) }} disabled={!tmpFrom || !tmpTo}
                className="flex-1 py-1.5 text-xs font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-40">Apply</button>
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
  const header = ['PO Number', 'Pipe Config', 'Dia (mm)', 'Bed Size', 'Pipes Spun', 'Rate (₹/pipe)', 'Amount (₹)']
  const data = rows.map(r => [r.poNumber, r.pipeConfig, r.diameterMm, BED_LABEL[r.bedSize]??r.bedSize, r.spinPipesCompleted, fmt(r.ratePerPipe), fmt(r.spinCost)])
  const total = rows.reduce((s, r) => s + Number(r.spinCost), 0)
  data.push(['','','','','','TOTAL', fmt(total)])
  const csv = [header, ...data].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([`Spinning Report\nContractor: ${contractorName}\nPeriod: ${from||'All'} to ${to||'All'}\n\n${csv}`], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `spinning-report-${from||'all'}-to-${to||'all'}.csv`; a.click()
  URL.revokeObjectURL(a.href)
}

export default function SpinningReportPage() {
  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')

  const params = { fromDate: from || undefined, toDate: to || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['spin-report', from, to],
    queryFn: () => productionReportApi.spinningCosts(params).then(r => r.data.data as any[]),
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['process-contractors'],
    queryFn:  processContractorApi.list,
  })

  const contractor = (assignments as any[]).find((a: any) => a.processType === 'SPINNING')
  const contractorName = contractor?.supplier?.name ?? 'Spinning Contractor'

  const rows  = data ?? []
  const total = rows.reduce((s: number, r: any) => s + Number(r.spinCost), 0)
  const totalPipes = rows.reduce((s: number, r: any) => s + Number(r.spinPipesCompleted), 0)
  const smallBed      = rows.filter((r: any) => r.bedSize === 'SMALL_BED').reduce((s: number, r: any) => s + Number(r.spinPipesCompleted), 0)
  const largeBed      = rows.filter((r: any) => r.bedSize === 'LARGE_BED').reduce((s: number, r: any) => s + Number(r.spinPipesCompleted), 0)
  const extraLargeBed = rows.filter((r: any) => r.bedSize === 'EXTRA_LARGE_BED').reduce((s: number, r: any) => s + Number(r.spinPipesCompleted), 0)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-violet-600 to-purple-600 px-8 pt-7 pb-6 shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
              <RotateCw size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-200 uppercase tracking-widest mb-0.5">Production · Contractor Report</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Spinning Report</h1>
              <p className="text-sm text-violet-200 mt-0.5">{contractorName}</p>
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
            { label: 'Total Amount',      value: `₹${fmt(total)}` },
            { label: 'Pipes Spun',        value: totalPipes.toLocaleString() },
            { label: 'Small Bed',         value: smallBed.toLocaleString() },
            { label: 'Large Bed',         value: largeBed.toLocaleString() },
            { label: 'Extra Large Bed',   value: extraLargeBed.toLocaleString() },
          ].map((s, i) => (
            <div key={i} className="flex-1 px-5 py-3 bg-white/5">
              <p className="text-[10px] font-bold text-violet-200 uppercase tracking-widest mb-0.5">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Spinning Entries</h2>
            <span className="text-xs text-gray-400 font-medium">Rate: ₹/pipe by diameter × bed size</span>
          </div>

          {isLoading ? (
            <div className="p-8 space-y-3">
              {Array.from({length:5}).map((_,i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <RotateCw size={36} className="mb-3 opacity-30" />
              <p className="font-semibold text-gray-500">No spinning entries found</p>
              <p className="text-sm mt-1">Try a different date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-violet-50 border-b border-violet-100">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-700 uppercase tracking-widest">PO Number</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-700 uppercase tracking-widest">Pipe Config</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-700 uppercase tracking-widest">Dia (mm)</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-700 uppercase tracking-widest">Bed Size</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-700 uppercase tracking-widest">Pipes Spun</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-700 uppercase tracking-widest">Rate (₹/pipe)</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-700 uppercase tracking-widest">Amount ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-violet-50/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-violet-700 font-bold">{r.poNumber}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{r.pipeConfig}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.diameterMm}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.bedSize === 'SMALL_BED'       ? 'bg-amber-100 text-amber-700' :
                          r.bedSize === 'LARGE_BED'       ? 'bg-blue-100 text-blue-700' :
                          r.bedSize === 'EXTRA_LARGE_BED' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{BED_LABEL[r.bedSize] ?? r.bedSize}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{Number(r.spinPipesCompleted).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">₹{fmt(r.ratePerPipe)}</td>
                      <td className="px-4 py-3 text-right font-bold text-violet-700">₹{fmt(r.spinCost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-violet-50 border-t border-violet-100">
                    <td colSpan={6} className="px-4 py-3 text-right text-sm font-bold text-gray-700">Total Spinning Cost</td>
                    <td className="px-4 py-3 text-right text-base font-extrabold text-violet-700">₹{fmt(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
