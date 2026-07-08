import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Trash2, Download, TrendingDown, AlertTriangle, BarChart2, ArrowUpDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { discardsApi } from '@/services/businessApi'
import { DateRangePicker } from '@/components/DateRangePicker'

function isoToday() { return new Date().toISOString().slice(0, 10) }
function isoStartOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }

const PROCESS_COLORS: Record<string, string> = {
  'Fabrication':          '#7c3aed',
  'Fabrication Testing':  '#6d28d9',
  'Moulding':             '#2563eb',
  'Spinning':             '#0891b2',
  'Demoulding':           '#059669',
  'Curing 1':             '#d97706',
  'Winding':              '#ea580c',
  'Coating':              '#dc2626',
  'Final Testing':        '#be185d',
  'General / Other':      '#64748b',
}
const DEFAULT_COLOR = '#94a3b8'

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function exportCsv(rows: any[], from: string, to: string) {
  const header = 'Date,Process,Pipe Name,Quantity,Notes\n'
  const body = rows.map(r =>
    `${r.date},"${r.process}","${r.pipeName}",${r.quantity},"${(r.notes ?? '').replace(/"/g, '""')}"`
  ).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + header + body], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = `Scrap_Report_${from}_${to}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <p className={`text-xs font-semibold mb-1 ${color}`}>{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="tabular-nums">{p.value} pipes</span>
        </p>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ScrapReportPage() {
  const [from, setFrom] = useState(isoStartOfMonth())
  const [to,   setTo]   = useState(isoToday())
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['scrap-report', from, to],
    queryFn:  () => discardsApi.list(from, to),
    staleTime: 0,
  })

  // ── Aggregations ────────────────────────────────────────────────────────────
  const totalQty = useMemo(() =>
    rows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0), [rows])

  const byProcess = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach(r => {
      const q = parseFloat(r.quantity) || 0
      map[r.process] = (map[r.process] ?? 0) + q
    })
    return Object.entries(map)
      .map(([process, qty]) => ({ process, qty }))
      .sort((a, b) => b.qty - a.qty)
  }, [rows])

  const byPipe = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach(r => {
      const q = parseFloat(r.quantity) || 0
      map[r.pipeName] = (map[r.pipeName] ?? 0) + q
    })
    return Object.entries(map)
      .map(([pipe, qty]) => ({ pipe, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 12)
  }, [rows])

  const byMonth = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach(r => {
      const key = r.date.slice(0, 7) // YYYY-MM
      const q = parseFloat(r.quantity) || 0
      map[key] = (map[key] ?? 0) + q
    })
    return Object.entries(map)
      .map(([month, qty]) => ({ month: format(parseISO(month + '-01'), 'MMM yy'), qty }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [rows])

  const topProcess = byProcess[0]?.process ?? '—'
  const topPipe    = byPipe[0]?.pipe ?? '—'
  const uniquePipes = new Set(rows.map(r => r.pipeName)).size

  // ── Filtered + Sorted table ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.pipeName.toLowerCase().includes(q) ||
      r.process.toLowerCase().includes(q) ||
      (r.notes ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? ''
      const bv = (b as any)[sortKey] ?? ''
      const na = Number(av), nb = Number(bv)
      const cmp = isNaN(na) || isNaN(nb) ? String(av).localeCompare(String(bv)) : na - nb
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(col: string) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  function Th({ col, label, right }: { col: string; label: string; right?: boolean }) {
    const active = col === sortKey
    return (
      <th onClick={() => toggleSort(col)}
        className={`px-4 py-3 cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'} hover:bg-red-50 transition-colors`}>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-red-600' : 'text-gray-500'}`}>
          {label}<ArrowUpDown size={9} className={active ? 'text-red-400' : 'text-gray-300'} />
        </span>
      </th>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(220,38,38,0.20)]">
        <div className="absolute inset-0 bg-gradient-to-br from-red-700 via-red-600 to-orange-500" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-orange-300/20 blur-3xl" />

        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <Trash2 size={28} className="text-red-200" />
            <div>
              <p className="text-red-200 text-xs font-semibold tracking-widest uppercase">Reports</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Scrap Report</h1>
              <p className="text-red-200/70 text-xs mt-0.5">Pipe discards and rejections across all production stages</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-center">
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Total Discarded</p>
              <p className="text-white font-bold text-lg tabular-nums">{totalQty.toLocaleString('en-IN')} pipes</p>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-center">
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Pipe Types</p>
              <p className="text-white font-bold text-lg tabular-nums">{uniquePipes}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="relative flex items-center gap-3 px-8 pb-5">
          <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          {isFetching && <span className="text-white/50 text-xs animate-pulse">Loading…</span>}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Discards" value={totalQty.toLocaleString('en-IN') + ' pipes'} sub={`${rows.length} entries`} color="text-red-600" />
        <StatCard label="Unique Pipe Types" value={uniquePipes} sub="affected" color="text-orange-600" />
        <StatCard label="Worst Stage" value={topProcess} sub={`${byProcess[0]?.qty ?? 0} pipes`} color="text-violet-600" />
        <StatCard label="Most Discarded Pipe" value={topPipe} sub={`${byPipe[0]?.qty ?? 0} pipes`} color="text-blue-600" />
      </div>

      {rows.length > 0 && (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-2 gap-5">
            {/* By Process */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-violet-500" />
                Discards by Production Stage
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byProcess} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="process" tick={{ fontSize: 11 }} width={130} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="qty" name="Discarded" radius={[0, 4, 4, 0]}>
                    {byProcess.map(d => (
                      <Cell key={d.process} fill={PROCESS_COLORS[d.process] ?? DEFAULT_COLOR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By Pipe */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <TrendingDown size={16} className="text-red-500" />
                Top Discarded Pipe Types
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byPipe} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="pipe" tick={{ fontSize: 10 }} width={150} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="qty" name="Discarded" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Trend */}
          {byMonth.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-500" />
                Monthly Scrap Trend
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={byMonth} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="qty" name="Discarded" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Detail Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">Discard Log</h3>
          <div className="flex items-center gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search pipe, process…"
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:outline-none w-52" />
            <button onClick={() => exportCsv(sorted, from, to)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trash2 size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">{rows.length === 0 ? 'No discard entries for selected period' : 'No entries match your search'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100">
                  <Th col="date"     label="Date" />
                  <Th col="process"  label="Stage / Process" />
                  <Th col="pipeName" label="Pipe Name" />
                  <Th col="quantity" label="Qty (pipes)" right />
                  <Th col="notes"    label="Notes" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(r => (
                  <tr key={r.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: (PROCESS_COLORS[r.process] ?? DEFAULT_COLOR) + '18', color: PROCESS_COLORS[r.process] ?? DEFAULT_COLOR }}>
                        {r.process}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{r.pipeName}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums">{parseFloat(r.quantity).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.notes || <span className="text-gray-300 italic">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-xs font-extrabold text-red-600 uppercase tracking-widest">
                    Total ({sorted.length} entries)
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold text-red-600 tabular-nums text-base">
                    {sorted.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0).toLocaleString('en-IN')} pipes
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
