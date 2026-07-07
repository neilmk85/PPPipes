import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Download, Search, X, Users, ArrowUpDown } from 'lucide-react'
import { labourApi, LabourEntry } from '@/services/businessApi'
import { DateRangePicker } from '@/components/DateRangePicker'

function dmy(iso: string) {
  const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`
}
function inr(v: number) {
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function n2(v: number) {
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function dailyCost(r: LabourEntry) {
  const rate = Number(r.ratePerDay || 0)
  return rate > 0 ? rate * r.labourCount : 0
}
function otCost(r: LabourEntry) {
  const hours = Number(r.overtimeHours || 0)
  const rate  = Number(r.overtimeRatePerHour || 0)
  return hours > 0 && rate > 0 ? hours * r.overtimeLabourCount * rate : 0
}

function exportCsv(rows: LabourEntry[], from: string, to: string) {
  const header = 'Date,Contractor,Labours,Rate/Day,Daily Total,OT Hours,OT Labours,OT Rate/Hr,OT Cost,Notes\n'
  const body = rows.map(r => {
    const dc = dailyCost(r), oc = otCost(r)
    return `${r.date},"${r.contractorName}",${r.labourCount},${r.ratePerDay},${dc},${r.overtimeHours},${r.overtimeLabourCount},${r.overtimeRatePerHour},${oc},"${(r.notes ?? '').replace(/"/g, '""')}"`
  }).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + header + body], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = `Labour_Report_${from}_${to}.csv`; a.click()
  URL.revokeObjectURL(url)
}

type Tab = 'labour' | 'ot' | 'contractor'

export default function LabourReportPage() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [tab, setTab]   = useState<Tab>('labour')
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['biz-labour-report', from, to],
    queryFn:  () => labourApi.list(from, to),
    staleTime: 0,
  })

  // OT rows only (those with any overtime)
  const otRows = useMemo(() => rows.filter(r => Number(r.overtimeHours || 0) > 0 || r.overtimeLabourCount > 0), [rows])

  // Totals
  const totalLabours  = rows.reduce((s, r) => s + r.labourCount, 0)
  const totalOTHours  = rows.reduce((s, r) => s + Number(r.overtimeHours || 0), 0)
  const totalDailyCost = rows.reduce((s, r) => s + dailyCost(r), 0)
  const totalOTCost   = rows.reduce((s, r) => s + otCost(r), 0)
  const grandTotal    = totalDailyCost + totalOTCost

  // Contractor summary
  const byContractor = useMemo(() => {
    const map: Record<string, { days: number; labours: number; dailyCost: number; otHours: number; otCost: number }> = {}
    rows.forEach(r => {
      const key = r.contractorName
      if (!map[key]) map[key] = { days: 0, labours: 0, dailyCost: 0, otHours: 0, otCost: 0 }
      map[key].days       += 1
      map[key].labours    += r.labourCount
      map[key].dailyCost  += dailyCost(r)
      map[key].otHours    += Number(r.overtimeHours || 0)
      map[key].otCost     += otCost(r)
    })
    return Object.entries(map).sort((a, b) => (b[1].dailyCost + b[1].otCost) - (a[1].dailyCost + a[1].otCost))
  }, [rows])

  function toggleSort(col: string) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  function Th({ col, label, right, val }: { col: string; label: string; right?: boolean; val?: (r: LabourEntry) => number }) {
    const active = col === sortKey
    return (
      <th onClick={() => toggleSort(col)} className={`px-3 py-2.5 cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'} hover:bg-violet-50 transition-colors`}>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-violet-700' : 'text-gray-500'}`}>
          {label}<ArrowUpDown size={9} className={active ? 'text-violet-500' : 'text-gray-300'} />
        </span>
      </th>
    )
  }

  const sourceRows = tab === 'ot' ? otRows : rows

  const filtered = useMemo(() => {
    if (!search.trim()) return sourceRows
    const q = search.toLowerCase()
    return sourceRows.filter(r => r.contractorName.toLowerCase().includes(q) || (r.notes ?? '').toLowerCase().includes(q))
  }, [sourceRows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: any, bv: any
      if (sortKey === 'dailyCost')  { av = dailyCost(a); bv = dailyCost(b) }
      else if (sortKey === 'otCost') { av = otCost(a);   bv = otCost(b) }
      else { av = (a as any)[sortKey] ?? ''; bv = (b as any)[sortKey] ?? '' }
      const na = Number(av), nb = Number(bv)
      const cmp = isNaN(na) || isNaN(nb) ? String(av).localeCompare(String(bv)) : na - nb
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-600 rounded-2xl shadow-[0_8px_40px_rgba(124,58,237,0.30)] overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Users size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Labour Report</h1>
                <p className="text-sm text-white/60 mt-0.5">Daily labour & overtime costs by contractor</p>
              </div>
            </div>
            <button onClick={() => exportCsv(rows, from, to)} disabled={rows.length === 0}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
              <Download size={11} /> Export CSV
            </button>
          </div>

          {/* Date range picker */}
          <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        </div>

        {/* Stats strip */}
        <div className={`grid grid-cols-6 divide-x divide-white/10 border-t border-white/10 mt-2 ${isFetching ? 'animate-pulse' : ''}`}>
          {[
            { label: 'Records',      value: rows.length },
            { label: 'Total Labours',value: totalLabours },
            { label: 'OT Entries',   value: otRows.length },
            { label: 'Total OT Hrs', value: n2(totalOTHours) },
            { label: 'Daily Cost',   value: inr(totalDailyCost) },
            { label: 'Grand Total',  value: inr(grandTotal) },
          ].map((c, i) => (
            <div key={i} className="px-3 py-3 text-center">
              <p className="text-sm font-bold text-white">{isFetching ? '…' : c.value}</p>
              <p className="text-[10px] text-white/50 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center gap-1 px-4 py-3 border-b bg-gray-50/80">
          {([['labour', 'Labour Entries'], ['ot', 'Overtime Entries'], ['contractor', 'By Contractor']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setSearch('') }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
              {label}
              {t === 'ot' && otRows.length > 0 && <span className="ml-1.5 bg-white/20 text-white text-[10px] px-1.5 rounded-full">{otRows.length}</span>}
            </button>
          ))}
          {tab !== 'contractor' && (
            <div className="relative ml-auto max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search contractor…" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 w-52" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={12} /></button>}
            </div>
          )}
        </div>

        {/* ── Labour tab ── */}
        {tab === 'labour' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <Th col="date"           label="Date" />
                  <Th col="contractorName" label="Contractor" />
                  <Th col="labourCount"    label="Labours"      right />
                  <Th col="ratePerDay"     label="Rate / Day"   right />
                  <Th col="dailyCost"      label="Daily Total"  right />
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isFetching ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded" /></td>)}</tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400 text-sm">No labour data for this period</td></tr>
                ) : (
                  <>
                    {sorted.map(r => {
                      const dc = dailyCost(r)
                      return (
                        <tr key={r.id} className="hover:bg-violet-50/30 transition-colors">
                          <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{dmy(r.date)}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{r.contractorName}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{r.labourCount}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{r.ratePerDay ? inr(Number(r.ratePerDay)) : '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">{dc > 0 ? inr(dc) : '—'}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[180px] truncate">{r.notes || '—'}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-violet-50/60 border-t-2 border-violet-100 font-semibold text-sm">
                      <td className="px-3 py-3 text-violet-700" colSpan={2}>Grand Total</td>
                      <td className="px-3 py-3 text-right tabular-nums">{sorted.reduce((s, r) => s + r.labourCount, 0)}</td>
                      <td />
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">{inr(sorted.reduce((s, r) => s + dailyCost(r), 0))}</td>
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── OT tab ── */}
        {tab === 'ot' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <Th col="date"               label="Date" />
                  <Th col="contractorName"     label="Contractor" />
                  <Th col="overtimeHours"      label="OT Hours"     right />
                  <Th col="overtimeLabourCount" label="OT Labours"  right />
                  <Th col="overtimeRatePerHour" label="Rate / Hr"   right />
                  <Th col="otCost"             label="OT Cost"      right />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isFetching ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded" /></td>)}</tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400 text-sm">No overtime data for this period</td></tr>
                ) : (
                  <>
                    {sorted.map(r => {
                      const oc = otCost(r)
                      return (
                        <tr key={r.id} className="hover:bg-fuchsia-50/30 transition-colors">
                          <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{dmy(r.date)}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{r.contractorName}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{n2(Number(r.overtimeHours || 0))}h</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{r.overtimeLabourCount}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{r.overtimeRatePerHour ? inr(Number(r.overtimeRatePerHour)) : '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-purple-700">{oc > 0 ? inr(oc) : '—'}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-fuchsia-50/60 border-t-2 border-fuchsia-100 font-semibold text-sm">
                      <td className="px-3 py-3 text-fuchsia-700" colSpan={2}>Grand Total</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n2(sorted.reduce((s, r) => s + Number(r.overtimeHours || 0), 0))}h</td>
                      <td className="px-3 py-3 text-right tabular-nums">{sorted.reduce((s, r) => s + r.overtimeLabourCount, 0)}</td>
                      <td />
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">{inr(sorted.reduce((s, r) => s + otCost(r), 0))}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── By Contractor tab ── */}
        {tab === 'contractor' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Contractor</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Days</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Total Labours</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Daily Cost</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">OT Hours</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">OT Cost</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isFetching ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded" /></td>)}</tr>
                  ))
                ) : byContractor.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center text-gray-400 text-sm">No data for this period</td></tr>
                ) : (
                  <>
                    {byContractor.map(([name, v]) => (
                      <tr key={name} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-gray-800">{name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{v.days}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{v.labours}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{v.dailyCost > 0 ? inr(v.dailyCost) : '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{v.otHours > 0 ? n2(v.otHours) + 'h' : '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-purple-700">{v.otCost > 0 ? inr(v.otCost) : '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">{inr(v.dailyCost + v.otCost)}</td>
                      </tr>
                    ))}
                    <tr className="bg-violet-50/60 border-t-2 border-violet-100 font-semibold text-sm">
                      <td className="px-3 py-3 text-violet-700">Grand Total</td>
                      <td className="px-3 py-3 text-right tabular-nums">{byContractor.reduce((s, [, v]) => s + v.days, 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{byContractor.reduce((s, [, v]) => s + v.labours, 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{inr(totalDailyCost)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n2(totalOTHours)}h</td>
                      <td className="px-3 py-3 text-right tabular-nums">{inr(totalOTCost)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">{inr(grandTotal)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
