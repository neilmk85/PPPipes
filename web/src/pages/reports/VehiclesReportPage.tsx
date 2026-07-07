import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Truck, ArrowUpDown } from 'lucide-react'
import { vehiclesApi, VehicleEntry } from '@/services/businessApi'
import { DateRangePicker } from '@/components/DateRangePicker'

function isoToday() { return new Date().toISOString().slice(0, 10) }
function isoStartOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }

function dmy(iso: string) {
  const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`
}
function n2(v: number | string) {
  const x = Number(v)
  return isNaN(x) ? '—' : x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function exportCsv(rows: VehicleEntry[], from: string, to: string) {
  const header = 'Date,Crane Enabled,Crane Diesel (L),Crane Hours,JCB Enabled,JCB Diesel (L),JCB Hours,Notes\n'
  const body = rows.map(r =>
    `${r.date},${r.craneEnabled},${r.craneDiesel},${r.craneHours},${r.jcbEnabled},${r.jcbDiesel},${r.jcbHours},"${(r.notes ?? '').replace(/"/g, '""')}"`
  ).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + header + body], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = `Vehicles_Report_${from}_${to}.csv`; a.click()
  URL.revokeObjectURL(url)
}

type VehicleFilter = 'all' | 'crane' | 'jcb'

export default function VehiclesReportPage() {
  const [from, setFrom] = useState(isoStartOfMonth())
  const [to,   setTo]   = useState(isoToday())
  const [filter, setFilter] = useState<VehicleFilter>('all')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['biz-vehicles-report', from, to],
    queryFn:  () => vehiclesApi.list(from, to),
    staleTime: 0,
  })

  // Totals
  const craneRows = useMemo(() => rows.filter(r => r.craneEnabled), [rows])
  const jcbRows   = useMemo(() => rows.filter(r => r.jcbEnabled),   [rows])
  const totalCraneDiesel = craneRows.reduce((s, r) => s + Number(r.craneDiesel || 0), 0)
  const totalCraneHours  = craneRows.reduce((s, r) => s + Number(r.craneHours  || 0), 0)
  const totalJcbDiesel   = jcbRows.reduce((s, r)   => s + Number(r.jcbDiesel  || 0), 0)
  const totalJcbHours    = jcbRows.reduce((s, r)   => s + Number(r.jcbHours   || 0), 0)
  const totalDiesel      = totalCraneDiesel + totalJcbDiesel

  // Daily diesel breakdown (for chart-like bars)
  const maxDiesel = useMemo(() => {
    return rows.reduce((m, r) => {
      const d = Number(r.craneDiesel || 0) + Number(r.jcbDiesel || 0)
      return d > m ? d : m
    }, 0)
  }, [rows])

  const filtered = useMemo(() => {
    let data = rows
    if (filter === 'crane') data = craneRows
    if (filter === 'jcb')   data = jcbRows
    return data
  }, [rows, filter, craneRows, jcbRows])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? ''; const bv = (b as any)[sortKey] ?? ''
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
      <th onClick={() => toggleSort(col)} className={`px-3 py-2.5 cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'} hover:bg-blue-50 transition-colors`}>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-blue-700' : 'text-gray-500'}`}>
          {label}<ArrowUpDown size={9} className={active ? 'text-blue-500' : 'text-gray-300'} />
        </span>
      </th>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 rounded-2xl shadow-[0_8px_40px_rgba(29,78,216,0.30)] overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Truck size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Vehicles Report</h1>
                <p className="text-sm text-white/60 mt-0.5">Crane & JCB usage — diesel consumption and hours</p>
              </div>
            </div>
            <button onClick={() => exportCsv(rows, from, to)} disabled={rows.length === 0}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
              <Download size={11} /> Export CSV
            </button>
          </div>

          <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        </div>

        {/* Stats strip */}
        <div className={`grid grid-cols-6 divide-x divide-white/10 border-t border-white/10 mt-2 ${isFetching ? 'animate-pulse' : ''}`}>
          {[
            { label: 'Total Days',      value: rows.length },
            { label: 'Crane Days',      value: craneRows.length },
            { label: 'Crane Diesel (L)',value: n2(totalCraneDiesel) },
            { label: 'Crane Hours',     value: n2(totalCraneHours) + 'h' },
            { label: 'JCB Days',        value: jcbRows.length },
            { label: 'JCB Diesel (L)',  value: n2(totalJcbDiesel) },
          ].map((c, i) => (
            <div key={i} className="px-3 py-3 text-center">
              <p className="text-sm font-bold text-white">{isFetching ? '…' : c.value}</p>
              <p className="text-[10px] text-white/50 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {!isFetching && rows.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Crane — Total Diesel', value: `${n2(totalCraneDiesel)} L`, sub: `${craneRows.length} active days`, color: 'from-blue-500 to-blue-600' },
            { label: 'Crane — Total Hours',  value: `${n2(totalCraneHours)} h`,  sub: `avg ${craneRows.length > 0 ? n2(totalCraneHours / craneRows.length) : '0'} h/day`, color: 'from-sky-500 to-sky-600' },
            { label: 'JCB — Total Diesel',   value: `${n2(totalJcbDiesel)} L`,   sub: `${jcbRows.length} active days`,  color: 'from-cyan-500 to-teal-600' },
            { label: 'JCB — Total Hours',    value: `${n2(totalJcbHours)} h`,    sub: `avg ${jcbRows.length > 0 ? n2(totalJcbHours / jcbRows.length) : '0'} h/day`,  color: 'from-teal-500 to-emerald-600' },
          ].map((c, i) => (
            <div key={i} className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white shadow-sm`}>
              <p className="text-xs text-white/70 mb-1">{c.label}</p>
              <p className="text-xl font-bold">{c.value}</p>
              <p className="text-xs text-white/60 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Daily diesel usage bars ─────────────────────────────────────────── */}
      {!isFetching && rows.length > 0 && maxDiesel > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Diesel Usage</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {[...rows].sort((a, b) => a.date.localeCompare(b.date)).map(r => {
              const craneDiesel = Number(r.craneDiesel || 0)
              const jcbDiesel   = Number(r.jcbDiesel   || 0)
              const total = craneDiesel + jcbDiesel
              if (total === 0) return null
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-mono w-20 shrink-0">{dmy(r.date)}</span>
                  <div className="flex-1 flex gap-1 h-5">
                    {craneDiesel > 0 && (
                      <div
                        className="bg-blue-400 rounded-sm flex items-center justify-end pr-1"
                        style={{ width: `${(craneDiesel / maxDiesel) * 100}%` }}
                        title={`Crane: ${craneDiesel}L`}
                      >
                        {craneDiesel > maxDiesel * 0.15 && <span className="text-[9px] text-white font-bold">{craneDiesel}L</span>}
                      </div>
                    )}
                    {jcbDiesel > 0 && (
                      <div
                        className="bg-cyan-400 rounded-sm flex items-center justify-end pr-1"
                        style={{ width: `${(jcbDiesel / maxDiesel) * 100}%` }}
                        title={`JCB: ${jcbDiesel}L`}
                      >
                        {jcbDiesel > maxDiesel * 0.15 && <span className="text-[9px] text-white font-bold">{jcbDiesel}L</span>}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 tabular-nums w-14 text-right">{n2(total)}L</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-400" /><span className="text-xs text-gray-500">Crane</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cyan-400" /><span className="text-xs text-gray-500">JCB</span></div>
          </div>
        </div>
      )}

      {/* ── Filter + Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50/80">
          {(['all', 'crane', 'jcb'] as VehicleFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {f === 'all' ? 'All Entries' : f === 'crane' ? `Crane Only (${craneRows.length})` : `JCB Only (${jcbRows.length})`}
            </button>
          ))}
          <span className="ml-auto text-xs text-blue-700 font-medium bg-blue-50 px-2.5 py-1 rounded-lg">
            {sorted.length} record{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <Th col="date"        label="Date" />
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50/40" colSpan={2}>
                  🏗 Crane
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-cyan-600 bg-cyan-50/40" colSpan={2}>
                  🚜 JCB
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Notes</th>
              </tr>
              <tr className="border-b">
                <th className="px-3 py-1" />
                <th className="px-3 py-1 text-right text-[10px] font-semibold text-blue-500 bg-blue-50/40">Diesel (L)</th>
                <th className="px-3 py-1 text-right text-[10px] font-semibold text-blue-500 bg-blue-50/40">Hours</th>
                <th className="px-3 py-1 text-right text-[10px] font-semibold text-cyan-500 bg-cyan-50/40">Diesel (L)</th>
                <th className="px-3 py-1 text-right text-[10px] font-semibold text-cyan-500 bg-cyan-50/40">Hours</th>
                <th className="px-3 py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isFetching ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded" /></td>)}</tr>
                ))
              ) : sorted.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-gray-400 text-sm">No vehicle data for this period</td></tr>
              ) : (
                <>
                  {sorted.map(r => (
                    <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{dmy(r.date)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${r.craneEnabled ? 'text-blue-700 font-medium' : 'text-gray-300'} bg-blue-50/20`}>
                        {r.craneEnabled ? n2(r.craneDiesel) : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${r.craneEnabled ? 'text-blue-700' : 'text-gray-300'} bg-blue-50/20`}>
                        {r.craneEnabled ? n2(r.craneHours) + 'h' : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${r.jcbEnabled ? 'text-cyan-700 font-medium' : 'text-gray-300'} bg-cyan-50/20`}>
                        {r.jcbEnabled ? n2(r.jcbDiesel) : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${r.jcbEnabled ? 'text-cyan-700' : 'text-gray-300'} bg-cyan-50/20`}>
                        {r.jcbEnabled ? n2(r.jcbHours) + 'h' : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[180px] truncate">{r.notes || '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/50 border-t-2 border-blue-100 font-semibold text-sm">
                    <td className="px-3 py-3 text-blue-700">Grand Total</td>
                    <td className="px-3 py-3 text-right tabular-nums text-blue-700 bg-blue-50/40">{n2(sorted.filter(r => r.craneEnabled).reduce((s, r) => s + Number(r.craneDiesel || 0), 0))}L</td>
                    <td className="px-3 py-3 text-right tabular-nums text-blue-700 bg-blue-50/40">{n2(sorted.filter(r => r.craneEnabled).reduce((s, r) => s + Number(r.craneHours || 0), 0))}h</td>
                    <td className="px-3 py-3 text-right tabular-nums text-cyan-700 bg-cyan-50/40">{n2(sorted.filter(r => r.jcbEnabled).reduce((s, r) => s + Number(r.jcbDiesel || 0), 0))}L</td>
                    <td className="px-3 py-3 text-right tabular-nums text-cyan-700 bg-cyan-50/40">{n2(sorted.filter(r => r.jcbEnabled).reduce((s, r) => s + Number(r.jcbHours || 0), 0))}h</td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
